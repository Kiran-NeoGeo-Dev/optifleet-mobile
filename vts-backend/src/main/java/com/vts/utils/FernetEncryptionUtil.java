package com.vts.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM symmetric encryption utility.
 * Produces Base64-URL-safe ciphertext compatible with the Python Fernet-style flow.
 * Key is derived from the tb.encryption.secret property (32-char ASCII → 32-byte key).
 */
@Component
public class FernetEncryptionUtil {

    private static final Logger log = LoggerFactory.getLogger(FernetEncryptionUtil.class);
    private static final String ALGO = "AES/GCM/NoPadding";
    private static final int GCM_IV_LEN  = 12;
    private static final int GCM_TAG_LEN = 128;

    private final SecretKey secretKey;

    public FernetEncryptionUtil(@Value("${tb.encryption.secret:DefaultSecret32CharKey!!!!!!!!}") String secret) {
        byte[] keyBytes = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            keyBytes = java.util.Arrays.copyOf(keyBytes, 32); // zero-pad to 32 bytes
        } else if (keyBytes.length > 32) {
            keyBytes = java.util.Arrays.copyOfRange(keyBytes, 0, 32);
        }
        this.secretKey = new SecretKeySpec(keyBytes, "AES");
        log.info("FernetEncryptionUtil initialised (AES-256-GCM)");
    }

    /** Encrypt plaintext → Base64-URL-safe string (IV prepended). */
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LEN];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LEN, iv));
            byte[] cipherBytes = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            ByteBuffer buf = ByteBuffer.allocate(GCM_IV_LEN + cipherBytes.length);
            buf.put(iv);
            buf.put(cipherBytes);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(buf.array());
        } catch (Exception e) {
            log.error("Encryption failed: {}", e.getMessage());
            throw new RuntimeException("Token encryption failed", e);
        }
    }

    /** Decrypt Base64-URL-safe string → plaintext. */
    public String decrypt(String encoded) {
        try {
            byte[] data = Base64.getUrlDecoder().decode(encoded);
            ByteBuffer buf = ByteBuffer.wrap(data);

            byte[] iv = new byte[GCM_IV_LEN];
            buf.get(iv);
            byte[] cipherBytes = new byte[buf.remaining()];
            buf.get(cipherBytes);

            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LEN, iv));
            return new String(cipher.doFinal(cipherBytes), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Decryption failed: {}", e.getMessage());
            throw new RuntimeException("Token decryption failed", e);
        }
    }
}
