import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import documentRoutes from "./routes/documents.js";
import notificationRoutes from "./routes/notifications.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin.js";
import { sendMail } from "./lib/email.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "http://192.168.1.40:3000",
    ],
    credentials: true, // required for httpOnly cookie to be sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Serve uploaded files as static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/test-email", async (req, res) => {
  const toEmail = req.query.to || process.env.EMAIL_USER;
  if (!toEmail) {
    return res.status(400).json({ error: "Missing recipient email. Pass ?to=your-email@example.com" });
  }

  const result = await sendMail({
    to: toEmail,
    subject: "BureauAI SMTP Configuration Test",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1e3a8a; margin-top: 0;">SMTP Connection Successful</h2>
        <p>This is a test email confirming that Nodemailer has successfully connected to your Gmail account using the App Password credentials.</p>
        <p>Recipient: <strong>${toEmail}</strong></p>
        <p>Timestamp: <strong>${new Date().toISOString()}</strong></p>
      </div>
    `,
    text: `SMTP Configuration test successful. Recipient: ${toEmail}. Timestamp: ${new Date().toISOString()}`
  });

  if (result.success) {
    res.json({ success: true, message: `Test email successfully sent to ${toEmail}`, info: result.info });
  } else {
    res.status(500).json({ success: false, error: result.error?.message || result.error });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Bureau API running on http://localhost:${PORT}`);
});
// Trigger reload: 2026-05-23 11:34

