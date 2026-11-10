package com.jobgenius.controllers;

import com.jobgenius.dto.StripePaymentRequest;
import com.jobgenius.repositories.PaymentMetadataRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.services.StripePaymentService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class GeneralPaymentController {
    private final StripePaymentService stripePaymentService;
    private final UserRepository userRepository;
    private final PaymentMetadataRepository paymentMetadataRepository;

    private final Logger logger = LoggerFactory.getLogger(GeneralPaymentController.class);

    @PostMapping("/create-checkout-session")
    public ResponseEntity<Map> createCheckoutSession(@RequestBody StripePaymentRequest request,
            Authentication authentication) throws Exception {
        String url = stripePaymentService.createPayment(request, authentication);
        return ResponseEntity.ok(Map.of(
                "checkoutUrl", url));
    }

    @PostMapping("/cancel-subscription")
    public ResponseEntity<Map> cancelSubscription(Authentication authentication) throws Exception {
        Long userId = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getUid();

        String subscriptionId = paymentMetadataRepository.findLatestSubscriptionIdByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Subscription not found"));

        String message = stripePaymentService.cancelSubscription(subscriptionId);
        return ResponseEntity.ok(Map.of(
                "message", message));
    }

    @GetMapping("/invoices")
    public ResponseEntity<Map> getAllInvoices(Authentication authentication) throws Exception {
        return ResponseEntity.ok(Map.of(
                "invoices", stripePaymentService.getAllInvoicesByUserId(authentication)));
    }

    @GetMapping("/invoices/{invoiceId}")
    public ResponseEntity<Map> getInvoiceById(@PathVariable String invoiceId) throws Exception {
        return ResponseEntity.ok(Map.of(
                "invoice", stripePaymentService.getInvoiceById(invoiceId)));
    }

    @PostMapping("/change-payment-method")
    public ResponseEntity<Map> changePaymentMethod(Authentication authentication) throws Exception {
        Map<String, Long> details = (Map<String, Long>) authentication.getDetails();
        Long userId = details.get("user_id");

        Optional<String> subscriptionId = paymentMetadataRepository.findLatestSubscriptionIdByUserId(userId);

        if (subscriptionId.isEmpty()) {
            logger.error("Subscription not found to change the payment method for user ID: {}", userId);
            return ResponseEntity.badRequest().body(
                    Map.of(
                        "error", "BAD_REQUEST",
                        "message", "Subscription not found"
                        )
            );
        }

        String message = stripePaymentService.changePaymentMethod(String.valueOf(subscriptionId));
        return ResponseEntity.ok(Map.of(
                "stripeUrl", message));
    }

    @GetMapping("/next-billing-date")
    public ResponseEntity<Map> getNextBillingDate(Authentication authentication) throws Exception {
        Map<String, Long> details = (Map<String, Long>) authentication.getDetails();
        Long userId = details.get("user_id");

        Optional<String> subscriptionId = paymentMetadataRepository.findLatestSubscriptionIdByUserId(userId);

        if (subscriptionId.isEmpty()) {
            logger.error("Subscription not found to get the next billing date for user ID: {}", userId);
            return ResponseEntity.badRequest().body(
                    Map.of(
                        "error", "BAD_REQUEST",
                        "message", "Subscription not found"
                        )
            );
        }

        return ResponseEntity.ok(stripePaymentService.getNextBillingDate(String.valueOf(subscriptionId)));
    }
}
