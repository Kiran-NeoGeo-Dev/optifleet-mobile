package com.vts.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${mail.from}")
    private String fromAddress;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /** Sends welcome credentials email — used on Create User & Admin Recovery */
    @Async
    public void sendCredentialsEmail(String toEmail, String fullName, String username, String password) {
        if (toEmail == null || toEmail.isBlank()) {
            log.warn("sendCredentialsEmail: no email address provided, skipping.");
            return;
        }
        try {
            log.info("[EMAIL] Attempting to send to={} from={} host={}",
                toEmail, fromAddress,
                mailSender instanceof org.springframework.mail.javamail.JavaMailSenderImpl
                    ? ((org.springframework.mail.javamail.JavaMailSenderImpl) mailSender).getHost() : "unknown");

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject("Welcome to OptiFleet \u2013 A Solution by NeoGeoInfo Technologies!");
            String displayName = (fullName != null && !fullName.isBlank()) ? fullName : username;
            helper.setText(buildWelcomeHtml(displayName, username, password), true);
            mailSender.send(message);
            log.info("[EMAIL] SUCCESS \u2014 sent to {}", toEmail);
        } catch (Exception e) {
            log.error("[EMAIL] FAILED to send to={} | error={} | cause={}",
                toEmail, e.getMessage(),
                e.getCause() != null ? e.getCause().getMessage() : "none", e);
        }
    }

    /** Sends updated credentials email — used on Edit User */
    @Async
    public void sendUpdatedCredentialsEmail(String toEmail, String fullName, String username, String password) {
        if (toEmail == null || toEmail.isBlank()) {
            log.warn("sendUpdatedCredentialsEmail: no email address, skipping.");
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject("Your OptiFleet Login Credentials Have Been Updated");
            String displayName = (fullName != null && !fullName.isBlank()) ? fullName : username;
            helper.setText(buildUpdatedHtml(displayName, username, password), true);
            mailSender.send(message);
            log.info("[EMAIL] Updated credentials sent to {}", toEmail);
        } catch (Exception e) {
            log.error("[EMAIL] Failed to send updated credentials to {}: {}", toEmail, e.getMessage());
        }
    }

    private String buildWelcomeHtml(String displayName, String username, String password) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
            "<style>" +
            "body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}" +
            ".wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10)}" +
            ".header{background:linear-gradient(135deg,#0A1F44,#1565C0);padding:32px 28px;text-align:center}" +
            ".header h1{color:#fff;margin:0;font-size:26px;letter-spacing:1px}" +
            ".header p{color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;letter-spacing:2px}" +
            ".body{padding:28px 32px}" +
            ".body p{color:#333;font-size:15px;line-height:1.7;margin:0 0 16px}" +
            ".cred-box{background:#F6F1E9;border-radius:10px;padding:20px 24px;margin:20px 0;border:1px solid rgba(160,90,30,0.20)}" +
            ".cred-title{font-size:16px;font-weight:700;color:#0A1F44;margin:0 0 16px}" +
            ".cred-row{margin-bottom:14px}" +
            ".cred-label{font-size:12px;font-weight:700;color:#4A6A8E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}" +
            ".cred-value{font-size:17px;font-weight:800;color:#0D1B3E;background:#fff;border-radius:8px;padding:10px 14px;border:1px solid rgba(21,101,192,0.15);letter-spacing:0.5px}" +
            ".divider{height:1px;background:rgba(160,90,30,0.15);margin:4px 0 14px}" +
            ".footer{background:#0A1F44;padding:20px 28px;text-align:center}" +
            ".footer p{color:rgba(255,255,255,0.65);font-size:12px;margin:4px 0}" +
            ".footer strong{color:#fff}" +
            "</style></head><body>" +
            "<div class='wrap'>" +
            "<div class='header'><h1>OptiFleet</h1><p>SMART FLEET MANAGEMENT</p></div>" +
            "<div class='body'>" +
            "<p>Dear <strong>" + escHtml(displayName) + "</strong>,</p>" +
            "<p>Welcome aboard! We're excited to have you with us.</p>" +
            "<p>Your account is now fully set up and ready to use. Below are your login details:</p>" +
            "<div class='cred-box'>" +
            "<p class='cred-title'>&#128273; Your Login Credentials</p>" +
            "<div class='cred-row'><div class='cred-label'>Username</div><div class='cred-value'>" + escHtml(username) + "</div></div>" +
            "<div class='divider'></div>" +
            "<div class='cred-row'><div class='cred-label'>Password</div><div class='cred-value'>" + escHtml(password) + "</div></div>" +
            "</div>" +
            "<p>We look forward to helping you optimize your fleet operations!</p>" +
            "<p>Best regards,<br><strong>The OptiFleet Team</strong><br>NeoGeoInfo Technologies</p>" +
            "</div>" +
            "<div class='footer'><p><strong>NeoGeoInfo Technologies</strong></p><p>This is an automated message. Please do not reply.</p></div>" +
            "</div></body></html>";
    }

    private String buildUpdatedHtml(String displayName, String username, String password) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
            "<style>" +
            "body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}" +
            ".wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10)}" +
            ".header{background:linear-gradient(135deg,#0A1F44,#1565C0);padding:32px 28px;text-align:center}" +
            ".header h1{color:#fff;margin:0;font-size:26px;letter-spacing:1px}" +
            ".header p{color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;letter-spacing:2px}" +
            ".body{padding:28px 32px}" +
            ".body p{color:#333;font-size:15px;line-height:1.7;margin:0 0 16px}" +
            ".cred-box{background:#F6F1E9;border-radius:10px;padding:20px 24px;margin:20px 0;border:1px solid rgba(160,90,30,0.20)}" +
            ".cred-title{font-size:16px;font-weight:700;color:#0A1F44;margin:0 0 16px}" +
            ".cred-row{margin-bottom:14px}" +
            ".cred-label{font-size:12px;font-weight:700;color:#4A6A8E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}" +
            ".cred-value{font-size:17px;font-weight:800;color:#0D1B3E;background:#fff;border-radius:8px;padding:10px 14px;border:1px solid rgba(21,101,192,0.15);letter-spacing:0.5px}" +
            ".divider{height:1px;background:rgba(160,90,30,0.15);margin:4px 0 14px}" +
            ".footer{background:#0A1F44;padding:20px 28px;text-align:center}" +
            ".footer p{color:rgba(255,255,255,0.65);font-size:12px;margin:4px 0}" +
            ".footer strong{color:#fff}" +
            "</style></head><body>" +
            "<div class='wrap'>" +
            "<div class='header'><h1>OptiFleet</h1><p>SMART FLEET MANAGEMENT</p></div>" +
            "<div class='body'>" +
            "<p>Dear <strong>" + escHtml(displayName) + "</strong>,</p>" +
            "<p>Your OptiFleet account credentials have been updated successfully.</p>" +
            "<p>Below are your updated login details:</p>" +
            "<div class='cred-box'>" +
            "<p class='cred-title'>&#128273; Updated Login Credentials</p>" +
            "<div class='cred-row'><div class='cred-label'>Username</div><div class='cred-value'>" + escHtml(username) + "</div></div>" +
            "<div class='divider'></div>" +
            "<div class='cred-row'><div class='cred-label'>Password</div><div class='cred-value'>" + escHtml(password) + "</div></div>" +
            "</div>" +
            "<p>Please use these updated credentials for future logins.</p>" +
            "<p>Best regards,<br><strong>The OptiFleet Team</strong><br>NeoGeoInfo Technologies</p>" +
            "</div>" +
            "<div class='footer'><p><strong>NeoGeoInfo Technologies</strong></p><p>This is an automated message. Please do not reply.</p></div>" +
            "</div></body></html>";
    }

    private String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
