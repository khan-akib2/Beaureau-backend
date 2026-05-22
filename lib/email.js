import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (to, name, otp) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Bureau AI" <no-reply@bureauai.gov.in>',
    to,
    subject: "Verify Your Email - Bureau AI",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1a56db; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Bureau<span style="color: #1e3a5f;">AI</span></h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Ministry of Digital Governance · Government of India</p>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">Namaste <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.5; margin: 0;">
            Thank you for creating an account with Bureau AI. To complete your registration and verify your email address, please use the 6-digit verification code below:
          </p>
        </div>
        <div style="text-align: center; background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1a56db; font-family: monospace;">${otp}</span>
          <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">This OTP will expire in 10 minutes.</p>
        </div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0;">If you did not request this code, please ignore this email. Do not share this OTP with anyone for security reasons.</p>
          <p style="margin: 8px 0 0 0; text-align: center;">© 2026 Bureau AI. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Email sent successfully:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error };
  }
};
