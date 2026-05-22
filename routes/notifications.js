import express from "express";
import mongoose from "mongoose";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { requireAuth } from "../lib/auth.js";

const router = express.Router();

// POST /api/notifications — dispatch a notification to a user or all users (Admins only)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ error: "Missing required fields: userId, title, message." });
    }

    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let currentUser = null;
    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      currentUser = db.users.find((u) => u._id === req.user.id);
    } else {
      currentUser = await User.findById(req.user.id);
    }

    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized access. Admins only." });
    }

    if (userId === "all") {
      if (conn.isMock) {
        const db = getMockDb();
        const newNotifications = db.users.map((u) => ({
          _id: "notif_" + Math.random().toString(36).substr(2, 9),
          userId: u._id,
          title,
          message,
          type: type || "info",
          read: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        db.notifications.push(...newNotifications);
        saveMockDb(db);
      } else {
        const allUsers = await User.find({});
        const newNotifications = allUsers.map((u) => ({
          userId: u._id,
          title,
          message,
          type: type || "info",
          read: false
        }));
        await Notification.insertMany(newNotifications);
      }
      return res.json({ success: true, message: "Broadcast notification dispatched." });
    }

    let newNotification = null;
    if (conn.isMock || !mongoose.Types.ObjectId.isValid(userId)) {
      const db = getMockDb();
      newNotification = {
        _id: "notif_" + Math.random().toString(36).substr(2, 9),
        userId,
        title,
        message,
        type: type || "info",
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.notifications.push(newNotification);
      saveMockDb(db);
    } else {
      newNotification = await Notification.create({
        userId,
        title,
        message,
        type: type || "info",
        read: false
      });
    }

    res.json({ success: true, notification: newNotification });
  } catch (err) {
    console.error("POST Notification Error:", err);
    res.status(500).json({ error: "Failed to dispatch notification." });
  }
});

// GET /api/notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let notifications = [];

    if (conn.isMock || !isRealObjectId) {
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

// PATCH /api/notifications/:id — mark single as read
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      db.notifications = db.notifications.map((n) =>
        n._id === req.params.id && n.userId === req.user.id ? { ...n, read: true } : n
      );
      saveMockDb(db);
    } else {
      await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: { read: true } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification." });
  }
});

// DELETE /api/notifications/:id — delete single notification
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      db.notifications = db.notifications.filter(
        (n) => !(n._id === req.params.id && n.userId === req.user.id)
      );
      saveMockDb(db);
    } else {
      await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notification." });
  }
});

// PATCH /api/notifications  — mark all as read
router.patch("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
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
