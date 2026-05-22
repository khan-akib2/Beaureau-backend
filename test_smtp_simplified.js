import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function run() {
  const mailOptions = {
    from: '"Verification Service" <a66071001@smtp-brevo.com>',
    to: "sayyedyaseen419@gmail.com",
    subject: "Verify your email address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: bold;">Verification Service</h2>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">Hello <strong>yaseen</strong>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.5; margin: 0;">
            Please use the 6-digit verification code below to verify your account:
          </p>
        </div>
        <div style="text-align: center; background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; font-family: monospace;">844851</span>
          <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">This code will expire in 10 minutes.</p>
        </div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0;">If you did not request this code, please ignore this email.</p>
        </div>
      </div>
    `,
  };

  console.log("Sending simplified test email to sayyedyaseen419@gmail.com...");
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
  process.exit(0);
}

run().catch(console.error);
