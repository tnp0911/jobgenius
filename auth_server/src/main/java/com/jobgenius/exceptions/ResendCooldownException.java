package com.jobgenius.exceptions;

public class ResendCooldownException extends RuntimeException {
    public ResendCooldownException(int cooldownMinutes) {
        super(
                ("This email has been sent for verification recently.\n " +
                "Please check your email including the spam folder or wait for %d minutes to request a new verification email.")
                .formatted(cooldownMinutes)
        );
    }
}
