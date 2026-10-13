package com.jobgenius.exceptions;

public class ResendCooldownException extends RuntimeException {
    public ResendCooldownException(int cooldownMinutes) {
        super("You can only request a new verification email every %d minutes."
                .formatted(cooldownMinutes));
    }
}
