import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

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

console.log("Verifying SMTP connection...");
console.log("SMTP User:", process.env.SMTP_USER);

transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP verification failed:", error);
    process.exit(1);
  } else {
    console.log("SMTP server is ready to take our messages!");
    
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Verification Service" <a66071001@smtp-brevo.com>',
      to: "khanakib4212@gmail.com",
      subject: "Test SMTP Email from BureauAI",
      text: "This is a test email to verify Brevo SMTP configurations are fully functional."
    };
    
    console.log("Sending test mail to khanakib4212@gmail.com...");
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Test mail sending failed:", err);
        process.exit(1);
      } else {
        console.log("Test mail sent successfully! Info:", info);
        process.exit(0);
      }
    });
  }
});
