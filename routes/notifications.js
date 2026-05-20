import express from "express";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../lib/auth.js";

const router = express.Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    let notifications = [];

    if (conn.isMock) {
      const db = getMockDb();
      notifications = db.notifications
        .filter((n) => n.userId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("GET Notifications Error:", err);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// PATCH /api/notifications  — mark all as read
router.patch("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      db.notifications = db.notifications.map((n) =>
        n.userId === req.user.id ? { ...n, read: true } : n
      );
      saveMockDb(db);
    } else {
      await Notification.updateMany(
        { userId: req.user.id, read: false },
        { $set: { read: true } }
      );
    }

    res.json({ success: true, message: "Notifications marked as read." });
  } catch (err) {
    console.error("PATCH Notifications Error:", err);
    res.status(500).json({ error: "Failed to update notifications." });
  }
});

export default router;
