package com.jobgenius.services.mailing;

import com.jobgenius.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ForgotPassword_EmailService {

    private final EmailService emailService;
    private final AuthService authService;

    public void sendForgotPasswordTokenVerificationLink(String email) {
        String link = authService.forgotPasswordTokenVerificationLink(email);
        String plainText = """
                Hi there,

                We noticed that you requested a password reset for your JobGenius account.

                Please click the link below to verify your request and reset your password:
                %s

                This link will expire in %d minutes.

                If you did not request this reset, please contact our support team immediately.

                Best regards,
                The JobGenius Team
                """.formatted(link, 15);

        String htmlBody = """
                <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
                  <p style="margin:0 0 16px;">Hi there,</p>
                  <p style="margin:0 0 16px;">We noticed that you requested a password reset for your JobGenius account.</p>
                  <p style="margin:0 0 24px;">Please click the button below to to verify your request and reset your password:</p>
                  <p style="margin:0 0 24px;text-align:center;">
                    <a href="%s"
                       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">
                      Reset Password
                    </a>
                  </p>
                  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
                    This link will expire in %d minutes.
                  </p>
                  <p style="margin:0 0 16px;">If you did not request this verification, please contact our support team immediately.</p>
                  <p style="margin:0;">Best regards,<br>The JobGenius Team</p>
                </div>
                """.formatted(link, 15);

        emailService.sendHtmlEmail(
                email,
                "JobGenius Password Reset Request",
                plainText,
                htmlBody
        );
    }
}
