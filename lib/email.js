import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local first, then fallback to .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Reusable sendMail function with error handling and logging
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"BureauAI Portal" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS] Email sent to ${to}: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
};

/**
 * Helper to generate official Government/Enterprise styled email template
 */
const getGovTemplate = ({ title, bodyContent, otp }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- National Tricolor Accent Bar -->
      <div style="height: 4px; display: flex; width: 100%;">
        <div style="flex: 1; background-color: #FF9933;"></div>
        <div style="flex: 1; background-color: #FFFFFF;"></div>
        <div style="flex: 1; background-color: #138808;"></div>
      </div>
      
      <div style="padding: 32px 24px;">
        <!-- Header Emblem -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase;">
            Bureau<span style="color: #3b82f6;">AI</span>
          </div>
          <div style="font-size: 9px; font-weight: bold; color: #64748b; uppercase; tracking: 1.5px; margin-top: 4px;">
            Ministry of Digital Governance · Government of India
          </div>
        </div>

        <!-- Banner Divider -->
        <div style="border-bottom: 1px solid #f1f5f9; margin-bottom: 24px;"></div>

        <!-- Title -->
        <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0;">${title}</h2>

        <!-- Body Content -->
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
          ${bodyContent}
        </div>

        <!-- OTP Display Box -->
        ${otp ? `
        <div style="text-align: center; background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: 'Courier New', Courier, monospace; margin-bottom: 6px;">${otp}</div>
          <div style="font-size: 11px; font-weight: bold; color: #64748b;">This OTP code is valid for 10 minutes. Do not share it with anyone.</div>
        </div>
        ` : ""}

        <!-- Safety Notice -->
        <div style="padding: 16px; border-left: 4px solid #f97316; border-radius: 6px; background-color: #fffaf0; margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: bold; color: #c2410c;">Security Warning:</div>
          <p style="font-size: 11px; color: #7c2d12; margin: 4px 0 0 0; line-height: 1.4;">
            Official representatives of BureauAI will never ask you for your credentials, password, or verification code. Do not share this OTP with anyone for security reasons.
          </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0 0 4px 0;">This is an automated system-generated secure email. Please do not reply directly to this message.</p>
          <p style="margin: 0;">© 2026 BureauAI Portal · Government of India. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

/**
 * Sends generic signup/login verification OTP email
 */
export const sendOtpEmail = async (to, name, otp) => {
  const bodyContent = `
    Hello <strong>${name}</strong>,<br/><br/>
    Thank you for registering on the BureauAI Portal. To verify your email address and activate your account, please use the 6-digit verification code (OTP) below:
  `;
  
  const html = getGovTemplate({
    title: "Verify Your Email Address",
    bodyContent,
    otp,
  });

  // Always log OTP in terminal for local development troubleshooting
  console.log("\n==========================================");
  console.log(`[DEV OTP] Verification code for ${to}: ${otp}`);
  console.log("==========================================\n");

  return sendMail({
    to,
    subject: "BureauAI Email Verification - OTP",
    html,
    text: `Hello ${name}, your BureauAI OTP is ${otp}. Valid for 10 minutes.`,
  });
};

/**
 * Sends a generic notification update email
 */
export const sendNotificationEmail = async (to, name, title, message) => {
  const bodyContent = `
    Hello <strong>${name}</strong>,<br/><br/>
    You have a new update in your BureauAI dashboard:<br/><br/>
    <strong>${title}</strong><br/>
    ${message}
  `;

  const html = getGovTemplate({
    title: "Account Notification",
    bodyContent,
  });

  return sendMail({
    to,
    subject: `BureauAI Notification: ${title}`,
    html,
    text: `Hello ${name}, you have a new update: ${title} - ${message}`,
  });
};

/**
 * Sends role change administration update email
 */
export const sendRoleChangeEmail = async (to, name, newRole) => {
  const isAdmin = newRole === "admin";
  const title = isAdmin ? "Administrator Access Granted" : "Administrator Access Revoked";
  const message = isAdmin
    ? "Your BureauAI account has been promoted to administrator. You can now access the admin panel after signing in."
    : "Your BureauAI administrator access has been removed. Your account will continue as a regular user account.";

  const bodyContent = `
    Hello <strong>${name || "User"}</strong>,<br/><br/>
    This is to notify you that your account role has been updated:<br/><br/>
    ${message}<br/><br/>
    Current account status: <strong>${isAdmin ? "Administrator" : "Citizen User"}</strong>
  `;

  const html = getGovTemplate({
    title,
    bodyContent,
  });

  return sendMail({
    to,
    subject: `BureauAI: Account Access Update`,
    html,
    text: `Hello ${name}, your account access status has been updated: ${isAdmin ? "Administrator" : "Citizen User"}.`,
  });
};

/**
 * Sends Aadhaar linking OTP email
 */
export const sendAadhaarOtpEmail = async (to, name, otp, aadhaarNum) => {
  const maskedAadhaar = "XXXX XXXX " + aadhaarNum.slice(-4);
  const bodyContent = `
    Hello <strong>${name}</strong>,<br/><br/>
    A request has been initiated to verify identity credentials ending in <strong>${maskedAadhaar.slice(-4)}</strong>.<br/><br/>
    Please use the following One-Time Password (OTP) to link your Aadhaar number to your BureauAI profile:
  `;

  const html = getGovTemplate({
    title: "Identity Verification OTP - Aadhaar Linking",
    bodyContent,
    otp,
  });

  // Always log Aadhaar OTP in terminal for local development troubleshooting
  console.log("\n==========================================");
  console.log(`[DEV AADHAAR OTP] Verification code for ${to}: ${otp}`);
  console.log("==========================================\n");

  return sendMail({
    to,
    subject: "Aadhaar Identity Verification OTP - BureauAI",
    html,
    text: `Hello ${name}, your Aadhaar verification OTP is ${otp}. Valid for 10 minutes.`,
  });
};

/**
 * Sends forgot password OTP email
 */
export const sendForgotPasswordOtpEmail = async (to, name, otp) => {
  const bodyContent = `
    Hello <strong>${name}</strong>,<br/><br/>
    We received a request to reset the password for your BureauAI account. To reset your password, please use the 6-digit verification code (OTP) below:
  `;
  
  const html = getGovTemplate({
    title: "Reset Your Password",
    bodyContent,
    otp,
  });

  // Always log OTP in terminal for local development troubleshooting
  console.log("\n==========================================");
  console.log(`[DEV FORGOT PASSWORD OTP] Reset code for ${to}: ${otp}`);
  console.log("==========================================\n");

  return sendMail({
    to,
    subject: "BureauAI Password Reset - OTP",
    html,
    text: `Hello ${name}, your BureauAI password reset OTP is ${otp}. Valid for 10 minutes.`,
  });
};
