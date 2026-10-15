package com.jobgenius.services;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import com.warrenstrange.googleauth.GoogleAuthenticatorQRGenerator;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RequiredArgsConstructor
@Service
public class GoogleAuthenticatorService {
    private static final String ISSUER = "JobGenius";
    private final GoogleAuthenticator gAuth =
            new GoogleAuthenticator();
    private final Logger logger = LoggerFactory.getLogger(GoogleAuthenticatorService.class);

    // Generate a new TOTP secret key for the user
    public String generateKey() {
        GoogleAuthenticatorKey key = gAuth.createCredentials();
        return key.getKey();
    }

    // Validate the TOTP code
    public boolean isValid(String secret, int code) {
        if (secret == null || secret.isBlank()) {
            return false;
        }
        return gAuth.authorize(secret, code);
    }

    // Generate the QR code URL for the user to scan
    public String getQRBarcodeURL(String user, String secret) {
        GoogleAuthenticatorKey key = new GoogleAuthenticatorKey.Builder(secret).build();
        String otpAuthUrl = GoogleAuthenticatorQRGenerator.getOtpAuthTotpURL(ISSUER, user, key);
        try {
            return generateQRBase64(otpAuthUrl);
        } catch (Exception e) {
            logger.error("Error generating QR code for user {}: {}", user, e.getMessage());
            return null;
        }
    }

    // Generate a Base64-encoded QR code image from the URL
    private static String generateQRBase64(String qrCodeText) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            Map<EncodeHintType, Object> hintMap = new HashMap<>();
            hintMap.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            BitMatrix bitMatrix = qrCodeWriter.encode(qrCodeText, BarcodeFormat.QR_CODE, 200, 200, hintMap);
            BufferedImage bufferedImage = MatrixToImageWriter.toBufferedImage(bitMatrix);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(bufferedImage, "png", baos);
            byte[] imageBytes = baos.toByteArray();
            return Base64.getEncoder().encodeToString(imageBytes);

        } catch (IOException | WriterException e) {
            throw new RuntimeException(e);
        }
    }


}
