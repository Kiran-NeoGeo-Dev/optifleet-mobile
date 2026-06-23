package com.vts.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;

/**
 * Python-compatible Fernet encryption (RFC-compatible).
 *
 * Fernet token layout (before Base64-URL encoding):
 *   0x80          (1 byte  — version)
 *   timestamp     (8 bytes — big-endian seconds since Unix epoch)
 *   IV            (16 bytes — random AES-CBC IV)
 *   ciphertext    (N bytes — AES-128-CBC with PKCS7 padding)
 *   HMAC-SHA256   (32 bytes — over all preceding bytes)
 *
 * Key layout (32 bytes decoded from Base64):
 *   bytes  0-15 → HMAC-SHA256 signing key
 *   bytes 16-31 → AES-128-CBC encryption key
 *
 * Output is Base64-URL encoded (no padding stripped) → always starts with "gAAAAA".
 */
@Component
public class FernetEncryptionUtil {

    private static final Logger log = LoggerFactory.getLogger(FernetEncryptionUtil.class);
    private static final byte FERNET_VERSION = (byte) 0x80;

    private final byte[] signingKey;    // first 16 bytes
    private final byte[] encryptionKey; // last  16 bytes

    public FernetEncryptionUtil(@Value("${tb.encryption.secret}") String secret) {
        byte[] key = Base64.getDecoder().decode(secret);
        if (key.length != 32)
            throw new IllegalStateException(
                "tb.encryption.secret must decode to exactly 32 bytes, got " + key.length);
        this.signingKey    = Arrays.copyOfRange(key, 0, 16);
        this.encryptionKey = Arrays.copyOfRange(key, 16, 32);
        log.info("FernetEncryptionUtil initialised (Fernet/AES-128-CBC+HMAC-SHA256)");
    }

    /** Encrypt plaintext → Fernet token string starting with "gAAAAA". */
    public String encrypt(String plaintext) {
        try {
            byte[] iv        = randomIv();
            long   timestamp = Instant.now().getEpochSecond();
            byte[] ciphertext = aesCbcEncrypt(plaintext.getBytes(StandardCharsets.UTF_8), iv);

            // Build the payload: version(1) + timestamp(8) + iv(16) + ciphertext
            ByteBuffer payload = ByteBuffer.allocate(1 + 8 + 16 + ciphertext.length);
            payload.put(FERNET_VERSION);
            payload.putLong(timestamp);
            payload.put(iv);
            payload.put(ciphertext);
            byte[] payloadBytes = payload.array();

            // HMAC-SHA256 over the payload
            byte[] hmac = hmacSha256(payloadBytes);

            // Final token = payload + hmac
            byte[] token = new byte[payloadBytes.length + hmac.length];
            System.arraycopy(payloadBytes, 0, token, 0, payloadBytes.length);
            System.arraycopy(hmac, 0, token, payloadBytes.length, hmac.length);

            return Base64.getUrlEncoder().encodeToString(token);
        } catch (Exception e) {
            log.error("Fernet encryption failed: {}", e.getMessage());
            throw new RuntimeException("Token encryption failed", e);
        }
    }

    /** Decrypt Fernet token → plaintext. Returns input as-is if decryption fails (legacy token). */
    public String decrypt(String fernetToken) {
        try {
            byte[] token = Base64.getUrlDecoder().decode(fernetToken);
            if (token.length < 57)
                throw new IllegalArgumentException("Token too short");
            if (token[0] != FERNET_VERSION)
                throw new IllegalArgumentException("Unknown Fernet version: " + token[0]);

            // Split: payload = token[0..len-32], hmac = token[len-32..len]
            byte[] payload = Arrays.copyOfRange(token, 0, token.length - 32);
            byte[] hmac    = Arrays.copyOfRange(token, token.length - 32, token.length);

            // Verify HMAC
            byte[] expectedHmac = hmacSha256(payload);
            if (!constantTimeEquals(hmac, expectedHmac))
                throw new SecurityException("HMAC verification failed");

            // Extract IV and ciphertext from payload
            byte[] iv         = Arrays.copyOfRange(payload, 9, 25);
            byte[] ciphertext = Arrays.copyOfRange(payload, 25, payload.length);

            return new String(aesCbcDecrypt(ciphertext, iv), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Fernet decryption failed — returning as-is (legacy token): {}", e.getMessage());
            return fernetToken;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private byte[] aesCbcEncrypt(byte[] data, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE,
                new SecretKeySpec(encryptionKey, "AES"),
                new IvParameterSpec(iv));
        return cipher.doFinal(data);
    }

    private byte[] aesCbcDecrypt(byte[] data, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE,
                new SecretKeySpec(encryptionKey, "AES"),
                new IvParameterSpec(iv));
        return cipher.doFinal(data);
    }

    private byte[] hmacSha256(byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private byte[] randomIv() {
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);
        return iv;
    }

    private boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a.length != b.length) return false;
        int diff = 0;
        for (int i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
