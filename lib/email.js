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
    from: process.env.SMTP_FROM || '"Verification Service" <a66071001@smtp-brevo.com>',
    to,
    subject: "Verify Your Email Address",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Verification Service</h2>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">Hello <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.5; margin: 0;">
            Thank you for registering. To verify your email address, please use the 6-digit verification code below:
          </p>
        </div>
        <div style="text-align: center; background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; font-family: monospace;">${otp}</span>
          <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">This verification code will expire in 10 minutes.</p>
        </div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0;">If you did not request this code, please ignore this email. Do not share this code with anyone for security reasons.</p>
          <p style="margin: 8px 0 0 0; text-align: center;">© 2026 Verification Service. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  // Always log OTP in terminal for local development troubleshooting
  console.log("\n==========================================");
  console.log(`[DEV OTP] Verification code for ${to}: ${otp}`);
  console.log("==========================================\n");

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Email sent successfully:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error };
  }
};

export const sendNotificationEmail = async (to, name, title, message) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Notification Service" <a66071001@smtp-brevo.com>',
    to,
    subject: `Notification Alert: ${title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Notification Service</h2>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">Hello <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #1e293b; font-weight: bold; margin-top: 16px; margin-bottom: 8px;">
            ${title}
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0;">
            ${message}
          </p>
        </div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0;">You received this email because you are registered. You can manage your notification preferences in your Account Settings.</p>
          <p style="margin: 8px 0 0 0; text-align: center;">© 2026 Notification Service. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Notification Email sent successfully:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("Error sending notification email:", error);
    return { success: false, error };
  }
};

export const sendAadhaarOtpEmail = async (to, name, otp, aadhaarNum) => {
  const maskedAadhaar = "XXXX XXXX " + aadhaarNum.slice(-4);
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Identity Verification" <a66071001@smtp-brevo.com>',
    to,
    subject: "Identity Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="padding: 24px;">
          <!-- Header -->
          <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
            <div style="font-size: 20px; font-weight: bold; color: #1e293b; letter-spacing: 0.5px;">
              Identity Verification Service
            </div>
          </div>
          
          <!-- Content -->
          <div style="margin-bottom: 24px; color: #334155; line-height: 1.6;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 14px; margin-bottom: 16px;">
              A request has been initiated to verify identity credentials ending in <strong>${maskedAadhaar.slice(-4)}</strong>.
            </p>
            <p style="font-size: 14px; margin-bottom: 20px;">
              Please use the following One-Time Password (OTP) to verify your identity. This OTP is valid for <strong>10 minutes</strong>.
            </p>
            
            <div style="text-align: center; background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 18px; border-radius: 8px; margin: 24px 0;">
              <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #0284c7; font-family: monospace;">${otp}</span>
              <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Do not share this OTP with anyone for security reasons.</div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <p style="margin: 0 0 4px 0;">This is an automated system-generated email. Please do not reply to this email.</p>
            <p style="margin: 0;">© 2026 Verification Service. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  };

  // Always log Aadhaar OTP in terminal for local development troubleshooting
  console.log("\n==========================================");
  console.log(`[DEV AADHAAR OTP] Verification code for ${to}: ${otp}`);
  console.log("==========================================\n");

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Aadhaar OTP Email sent successfully:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("Error sending Aadhaar OTP email:", error);
    return { success: false, error };
  }
};


