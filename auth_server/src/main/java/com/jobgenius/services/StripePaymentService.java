package com.jobgenius.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.jobgenius.dto.StripePaymentRequest;
import com.jobgenius.models.Payment;
import com.jobgenius.models.PaymentMetadata;
import com.jobgenius.models.User;
import com.jobgenius.repositories.PaymentMetadataRepository;
import com.jobgenius.repositories.PaymentRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.utils.FastAPIUpdates;
import com.jobgenius.utils.PaymentStatus;
import com.stripe.exception.EventDataObjectDeserializationException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StripePaymentService extends PaymentService {
    private static final String SUBSCRIPTION_META_KEY = "Stripe_SubscriptionId";
    private static final String USER_ID_META_KEY = "userId";
    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final Logger logger = LoggerFactory.getLogger(StripePaymentService.class);

    @Value("${STRIPE_WEBHOOK_SECRET_KEY}")
    private String stripeEndpointSecretKey;

    @Value("${STRIPE_PRICE_ID}")
    private String stripePriceId;

    private final PaymentRepository paymentRepository;
    private final PaymentMetadataRepository paymentMetadataRepository;
    private final UserRepository userRepository;
    private final FastAPIUpdates fastAPIUpdates;

    @Override
    public String createPayment(Object request, Authentication authentication) throws Exception {
        StripePaymentRequest req = (StripePaymentRequest) request;

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new Exception("User not found"));

        String userId = user.getUid().toString();
        boolean alreadyUsedFreeTrial = paymentMetadataRepository.existsFreeTrialByUserId(user.getUid()) > 0;

        // userId must live on subscription_data.metadata — invoice.metadata is NOT copied from the session.
        SessionCreateParams.SubscriptionData.Builder subscriptionData =
                SessionCreateParams.SubscriptionData.builder()
                        .putMetadata(USER_ID_META_KEY, userId);
        if (!alreadyUsedFreeTrial) {
            subscriptionData.setTrialPeriodDays(14L);
        }

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setUiMode(SessionCreateParams.UiMode.HOSTED_PAGE)
                .setSuccessUrl(req.getSuccessUrl())
                .setCancelUrl(req.getCancelUrl())
                .setCustomerEmail(user.getEmail())
                .setBillingAddressCollection(SessionCreateParams.BillingAddressCollection.AUTO)
                .setPaymentMethodCollection(SessionCreateParams.PaymentMethodCollection.ALWAYS)
                .setAllowPromotionCodes(true)
                .setNameCollection(
                        SessionCreateParams.NameCollection.builder()
                                .setBusiness(
                                        SessionCreateParams.NameCollection.Business.builder()
                                                .setEnabled(true)
                                                .setOptional(true)
                                                .build())
                                .build())
                .setSubmitType(SessionCreateParams.SubmitType.AUTO)
                .setIntegrationIdentifier("hosted_web_0001")
                .setSubscriptionData(subscriptionData.build())
                .putMetadata(USER_ID_META_KEY, userId)
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPrice(stripePriceId)
                                .build())
                .setSavedPaymentMethodOptions(
                        SessionCreateParams.SavedPaymentMethodOptions.builder()
                                .setPaymentMethodSave(
                                        SessionCreateParams.SavedPaymentMethodOptions.PaymentMethodSave.ENABLED)
                                .build())
                .setOriginContext(SessionCreateParams.OriginContext.WEB)
                .build();

        Session session = Session.create(params);
        return session.getUrl();
    }

    @Override
    public String cancelSubscription(String subscriptionId) throws Exception {
        try {
            Subscription subscription = Subscription.retrieve(subscriptionId);
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(true)
                    .build();
            subscription.update(params);
            return "Subscription has been canceled and will remain active until the end of the current billing period.";
        } catch (Exception e) {
            throw new Exception("Failed to cancel subscription: " + e.getMessage());
        }
    }

    @Transactional
    @Override
    public void handleWebhook(String payload, String sigHeader)
            throws JsonProcessingException, EventDataObjectDeserializationException {

        String endpointSecret = stripeEndpointSecretKey;
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
        } catch (SignatureVerificationException e) {
            throw new RuntimeException(e);
        }
        switch (event.getType()) {
            /**
             * Seed user ↔ subscription mapping before invoice.paid (invoice.metadata is usually empty).
             */
            case "checkout.session.completed": {
                EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
                Session session;
                if (deserializer.getObject().isPresent()) {
                    session = (Session) deserializer.getObject().get();
                } else {
                    session = (Session) deserializer.deserializeUnsafe();
                }
                if (session != null) {
                    handleCheckoutSessionCompleted(session);
                }
                break;
            }
            /**
             * Invoice paid (trial $0, first charge, renewal, or Smart Retry success).
             */
            case "invoice.paid": {
                Invoice invoice = deserializeInvoice(event);
                if (invoice == null) {
                    return;
                }
                handleInvoicePaid(invoice);
                break;
            }

            /**
             * Invoice payment failed — Stripe will Smart-Retry.
             * Record FAILED only; keep PREMIUM until subscription is deleted.
             */
            case "invoice.payment_failed": {
                Invoice invoice = deserializeInvoice(event);
                if (invoice == null) {
                    return;
                }
                handleInvoicePaymentFailed(invoice);
                break;
            }

            /**
             * Subscription fully canceled (including after all retries fail)
             */
            case "customer.subscription.deleted": {
                EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
                Subscription deletedSub;
                if (deserializer.getObject().isPresent()) {
                    deletedSub = (Subscription) deserializer.getObject().get();
                } else {
                    deletedSub = (Subscription) deserializer.deserializeUnsafe();
                }

                if (deletedSub == null) {
                    return;
                }

                String uidStr = resolveUserIdFromSubscription(deletedSub);
                if (uidStr == null || uidStr.isBlank()) {
                    logger.error("subscription.deleted: could not resolve userId for {}", deletedSub.getId());
                    return;
                }

                OffsetDateTime deleteAt = deletedSub.getCanceledAt() != null
                        ? OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(deletedSub.getCanceledAt()),
                                ZoneOffset.UTC)
                        : OffsetDateTime.now(ZoneOffset.UTC);

                PaymentMetadata metadata = paymentMetadataRepository.findByKeyAndValue(
                        SUBSCRIPTION_META_KEY, deletedSub.getId());
                if (metadata != null) {
                    OffsetDateTime storedEnd = metadata.getPeriodEnd();
                    if (storedEnd != null && storedEnd.isAfter(deleteAt)) {
                        metadata.setPeriodEnd(deleteAt);
                        paymentMetadataRepository.save(metadata);
                        logger.info(
                                "subscription.deleted {}: clamped metadata periodEnd from {} to {}",
                                deletedSub.getId(),
                                storedEnd,
                                deleteAt);
                    }
                } else {
                    logger.warn(
                            "subscription.deleted {}: no payment metadata for subscription",
                            deletedSub.getId());
                }

                fastAPIUpdates.updatePlanFastAPI(uidStr, "FREE", "");
                break;
            }
            default: {
                break;
            }
        }
    }

    private void handleCheckoutSessionCompleted(Session session) {
        String subscriptionId = session.getSubscription();
        if (subscriptionId == null || subscriptionId.isBlank()) {
            logger.warn("checkout.session.completed {}: no subscription id", session.getId());
            return;
        }

        // Prefer session metadata; fall back to subscription metadata (authoritative for invoices).
        String uidStr = metadataUserId(session.getMetadata());
        if (uidStr == null || uidStr.isBlank()) {
            try {
                Subscription subscription = Subscription.retrieve(subscriptionId);
                uidStr = metadataUserId(subscription.getMetadata());
            } catch (Exception e) {
                logger.warn(
                        "checkout.session.completed {}: could not load subscription {}: {}",
                        session.getId(),
                        subscriptionId,
                        e.getMessage());
            }
        }

        if (uidStr == null || uidStr.isBlank()) {
            logger.error(
                    "checkout.session.completed {}: missing userId on session and subscription {}",
                    session.getId(),
                    subscriptionId);
            return;
        }

        PaymentMetadata existing =
                paymentMetadataRepository.findByKeyAndValue(SUBSCRIPTION_META_KEY, subscriptionId);
        if (existing != null) {
            logger.info(
                    "checkout.session.completed {}: subscription {} already mapped",
                    session.getId(),
                    subscriptionId);
            return;
        }

        Long uid = Long.parseLong(uidStr);
        User user = userRepository.findById(uid)
                .orElseThrow(() -> new RuntimeException("User not found: " + uid));

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String paymentRef = "checkout:" + session.getId();
        Payment payment = paymentRepository.findByProviderPaymentRef(paymentRef).orElseGet(Payment::new);
        if (payment.getPaymentId() == null) {
            payment.setUser(user);
            payment.setProvider("STRIPE");
            payment.setProviderPaymentRef(paymentRef);
            payment.setStatus(PaymentStatus.PENDING);
            payment.setCreatedAt(now);
        }
        payment.setUpdatedAt(now);
        paymentRepository.saveAndFlush(payment);

        // amount=1 placeholder so this seed row is not counted as a free-trial (amount=0) invoice.
        upsertSubscriptionMetadata(
                payment,
                subscriptionId,
                1L,
                "cad",
                now.plusDays(30));

        logger.info(
                "checkout.session.completed {}: mapped user {} → subscription {}",
                session.getId(),
                uid,
                subscriptionId);
    }

    private void handleInvoicePaid(Invoice invoice) {
        String subscriptionId = subscriptionIdOf(invoice);
        if (subscriptionId == null || subscriptionId.isBlank()) {
            logger.warn("invoice.paid {} has no subscription; skipping", invoice.getId());
            return;
        }

        User user = resolveUserForInvoice(invoice, subscriptionId);
        String paymentRef = paymentRefForInvoice(invoice);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        Payment payment = paymentRepository.findByProviderPaymentRef(paymentRef).orElseGet(Payment::new);
        boolean isNew = payment.getPaymentId() == null;
        if (isNew) {
            payment.setUser(user);
            payment.setProvider("STRIPE");
            payment.setProviderPaymentRef(paymentRef);
            payment.setCreatedAt(now);
        }
        payment.setStatus(PaymentStatus.PAID);
        payment.setUpdatedAt(now);
        paymentRepository.saveAndFlush(payment);

        OffsetDateTime periodEnd = periodEndOf(invoice);
        upsertSubscriptionMetadata(
                payment,
                subscriptionId,
                invoice.getAmountPaid(),
                invoice.getCurrency(),
                periodEnd);

        String planExpiry = formatPlanExpiry(periodEnd);
        fastAPIUpdates.updatePlanFastAPI(user.getUid().toString(), "PREMIUM", planExpiry);
        logger.info("invoice.paid {}: user {} PREMIUM until {}", invoice.getId(), user.getUid(), planExpiry);
    }

    private void handleInvoicePaymentFailed(Invoice invoice) {
        String subscriptionId = subscriptionIdOf(invoice);
        if (subscriptionId == null || subscriptionId.isBlank()) {
            logger.warn("invoice.payment_failed {} has no subscription; skipping", invoice.getId());
            return;
        }

        User user = resolveUserForInvoice(invoice, subscriptionId);
        String paymentRef = paymentRefForInvoice(invoice);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        Payment payment = paymentRepository.findByProviderPaymentRef(paymentRef).orElseGet(Payment::new);
        boolean isNew = payment.getPaymentId() == null;
        if (isNew) {
            payment.setUser(user);
            payment.setProvider("STRIPE");
            payment.setProviderPaymentRef(paymentRef);
            payment.setCreatedAt(now);
        }
        // Do not overwrite PAID with FAILED if a later success already landed
        if (payment.getStatus() != PaymentStatus.PAID) {
            payment.setStatus(PaymentStatus.FAILED);
        }
        payment.setUpdatedAt(now);
        paymentRepository.saveAndFlush(payment);

        OffsetDateTime periodEnd = periodEndOf(invoice);
        Long amount = invoice.getAmountDue() != null ? invoice.getAmountDue() : invoice.getAmountPaid();

        upsertSubscriptionMetadata(
                payment,
                subscriptionId,
                amount != null ? amount : 0L,
                invoice.getCurrency() != null ? invoice.getCurrency() : "cad",
                periodEnd);
        logger.warn(
                "invoice.payment_failed {}: user {} marked FAILED; Stripe will retry (sub {})",
                invoice.getId(),
                user.getUid(),
                subscriptionId);
        String expiry = formatPlanExpiry(periodEnd);
        fastAPIUpdates.updatePlanFastAPI(user.getUid().toString(), "PREMIUM", expiry);
    }

    private Invoice deserializeInvoice(Event event) throws EventDataObjectDeserializationException {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isPresent()) {
            return (Invoice) deserializer.getObject().get();
        }
        return (Invoice) deserializer.deserializeUnsafe();
    }

    /**
     * Invoice.metadata is usually empty for subscription invoices.
     * Resolve userId from: subscription.metadata → DB mapping → invoice.metadata (last resort).
     */
    private User resolveUserForInvoice(Invoice invoice, String subscriptionId) {
        String uidStr = null;

        try {
            Subscription subscription = Subscription.retrieve(subscriptionId);
            uidStr = resolveUserIdFromSubscription(subscription);
        } catch (Exception e) {
            logger.warn("Could not load subscription {} for user resolve: {}", subscriptionId, e.getMessage());
        }

        if (uidStr == null || uidStr.isBlank()) {
            PaymentMetadata bySub =
                    paymentMetadataRepository.findByKeyAndValue(SUBSCRIPTION_META_KEY, subscriptionId);
            if (bySub != null && bySub.getPayment() != null && bySub.getPayment().getUser() != null) {
                return bySub.getPayment().getUser();
            }
        }

        // Rare: only if something explicitly set invoice metadata
        if (uidStr == null || uidStr.isBlank()) {
            uidStr = metadataUserId(invoice.getMetadata());
        }

        if (uidStr == null || uidStr.isBlank()) {
            throw new RuntimeException("Could not resolve userId for invoice " + invoice.getId());
        }

        Long uid = Long.parseLong(uidStr);
        return userRepository.findById(uid)
                .orElseThrow(() -> new RuntimeException("User not found: " + uid));
    }

    private String resolveUserIdFromSubscription(Subscription subscription) {
        String fromMeta = metadataUserId(subscription.getMetadata());
        if (fromMeta != null && !fromMeta.isBlank()) {
            return fromMeta;
        }
        PaymentMetadata bySub = paymentMetadataRepository.findByKeyAndValue(
                SUBSCRIPTION_META_KEY, subscription.getId());
        if (bySub != null && bySub.getPayment() != null && bySub.getPayment().getUser() != null) {
            return bySub.getPayment().getUser().getUid().toString();
        }
        return null;
    }

    private static String metadataUserId(Map<String, String> metadata) {
        if (metadata == null) {
            return null;
        }
        return metadata.get(USER_ID_META_KEY);
    }

    private static String subscriptionIdOf(Invoice invoice) {
        if (invoice.getParent() == null
                || invoice.getParent().getSubscriptionDetails() == null) {
            return null;
        }
        String subscriptionId = invoice.getParent().getSubscriptionDetails().getSubscription();
        if (subscriptionId == null || subscriptionId.isBlank()) {
            return null;
        }
        return subscriptionId;
    }

    private static String paymentRefForInvoice(Invoice invoice) {
        return "invoice:" + invoice.getId();
    }

    private void upsertSubscriptionMetadata(
            Payment payment,
            String subscriptionId,
            Long amount,
            String currency,
            OffsetDateTime periodEnd) {
        PaymentMetadata metadata = paymentMetadataRepository
                .findByPayment_PaymentId(payment.getPaymentId())
                .orElseGet(PaymentMetadata::new);
        metadata.setPayment(payment);
        metadata.setKey(SUBSCRIPTION_META_KEY);
        metadata.setValue(subscriptionId);
        metadata.setAmount(amount != null ? amount : 0L);
        metadata.setCurrency(currency != null ? currency : "cad");
        metadata.setPeriodEnd(periodEnd);
        paymentMetadataRepository.save(metadata);
    }

    private static OffsetDateTime periodEndOf(Invoice invoice) {
        try {
            if (invoice.getLines() != null
                    && invoice.getLines().getData() != null
                    && !invoice.getLines().getData().isEmpty()
                    && invoice.getLines().getData().get(0).getPeriod() != null
                    && invoice.getLines().getData().get(0).getPeriod().getEnd() != null) {
                return OffsetDateTime.ofInstant(
                        java.time.Instant.ofEpochSecond(
                                invoice.getLines().getData().get(0).getPeriod().getEnd()),
                        ZoneOffset.UTC);
            }
        } catch (Exception ignored) {
            // fall through
        }
        return OffsetDateTime.now(ZoneOffset.UTC).plusDays(30);
    }

    private static String formatPlanExpiry(OffsetDateTime periodEnd) {
        OffsetDateTime end = periodEnd != null
                ? periodEnd
                : OffsetDateTime.now(ZoneOffset.UTC).plusDays(30);
        return end.format(ISO_OFFSET);
    }
}
