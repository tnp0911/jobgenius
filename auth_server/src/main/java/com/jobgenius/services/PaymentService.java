package com.jobgenius.services;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
public abstract class PaymentService {
    public abstract String createPayment(Object request, Authentication authentication) throws Exception;

    public abstract String cancelSubscription(String subscriptionId) throws Exception;

    public abstract List<String> getAllInvoicesByUserId(Authentication authentication) throws Exception;

    public abstract String getInvoiceById(String invoiceId) throws Exception;

    public abstract String changePaymentMethod(String subscriptionId) throws Exception;

    public abstract Map<String, Object> getNextBillingDate(String subscriptionId) throws Exception;
}
