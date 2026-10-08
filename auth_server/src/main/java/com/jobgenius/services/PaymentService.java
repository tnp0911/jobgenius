package com.jobgenius.services;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.util.List;

@RequiredArgsConstructor
public abstract class PaymentService {
    public abstract String createPayment(Object request, Authentication authentication) throws Exception;

    public abstract String cancelSubscription(String subscriptionId) throws Exception;

    public abstract List<String> getAllInvoicesByUserId(Authentication authentication) throws Exception;

    public abstract String getInvoiceById(String invoiceId) throws Exception;

    public abstract String changePaymentMethod(String subscriptionId) throws Exception;

    public abstract LocalDate getNextBillingDate(String subscriptionId) throws Exception;
}
