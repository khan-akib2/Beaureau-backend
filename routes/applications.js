import express from "express";
import mongoose from "mongoose";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import Application from "../models/Application.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../lib/auth.js";

const router = express.Router();

// GET /api/applications
router.get("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let applications = [];

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      applications = req.user.role === "admin"
        ? db.applications
        : db.applications.filter((a) => a.userId === req.user.id);
    } else {
      applications = req.user.role === "admin"
        ? await Application.find({}).sort({ createdAt: -1 })
        : await Application.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }

    res.json({ success: true, applications });
  } catch (err) {
    console.error("GET Applications Error:", err);
    res.status(500).json({ error: "Failed to fetch applications." });
  }
});

// POST /api/applications
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, department } = req.body;
    if (!title || !department) return res.status(400).json({ error: "Title and department are required." });

    const refNumber = "B-AI-" + Math.floor(10000000 + Math.random() * 90000000);
    const estDate = new Date(Date.now() + 14 * 86400000);
    const timeline = [{ status: "submitted", description: "Application tracker initialized. Awaiting review.", date: new Date().toISOString() }];

    const conn = await dbConnect();
    let newApp = null;

    if (conn.isMock) {
      const db = getMockDb();
      newApp = { _id: "app_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, title, referenceNumber: refNumber, department, status: "submitted", progress: 15, timeline, estimatedCompletion: estDate.toISOString(), createdAt: new Date().toISOString() };
      db.applications.push(newApp);
      db.notifications.push({ _id: "notif_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, title: `Tracking Started: ${title}`, message: `Ref: ${refNumber}`, type: "info", read: false, createdAt: new Date().toISOString() });
      saveMockDb(db);
    } else {
      newApp = await Application.create({ userId: req.user.id, title, referenceNumber: refNumber, department, status: "submitted", progress: 15, timeline, estimatedCompletion: estDate });
      await Notification.create({ userId: req.user.id, title: `Tracking Started: ${title}`, message: `Ref: ${refNumber}`, type: "info" });
    }

    res.json({ success: true, application: newApp });
  } catch (err) {
    console.error("POST Application Error:", err);
    res.status(500).json({ error: "Failed to create application." });
  }
});

// PATCH /api/applications/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress, timelineDescription } = req.body;
    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const app = db.applications.find((a) => a._id === id);
      if (!app) return res.status(404).json({ error: "Application not found." });
      if (app.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Unauthorized." });
      if (status) app.status = status;
      if (progress !== undefined) app.progress = Number(progress);
      if (timelineDescription) app.timeline.push({ status: status || app.status, description: timelineDescription, date: new Date().toISOString() });
      app.updatedAt = new Date().toISOString();
      db.notifications.push({ _id: "notif_" + Math.random().toString(36).substr(2, 9), userId: app.userId, title: `Tracker Updated: ${app.title}`, message: `Status updated to "${status || app.status}".`, type: status === "approved" ? "success" : "info", read: false, createdAt: new Date().toISOString() });
      saveMockDb(db);
      return res.json({ success: true, application: app });
    }

    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ error: "Application not found." });
    if (app.userId.toString() !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Unauthorized." });

    const updates = {};
    if (status) updates.status = status;
    if (progress !== undefined) updates.progress = Number(progress);

    const updated = timelineDescription
      ? await Application.findByIdAndUpdate(id, { $set: updates, $push: { timeline: { status: status || app.status, description: timelineDescription, date: new Date() } } }, { new: true })
      : await Application.findByIdAndUpdate(id, { $set: updates }, { new: true });

    await Notification.create({ userId: app.userId, title: `Tracker Updated: ${app.title}`, message: `Status updated to "${status || app.status}".`, type: status === "approved" ? "success" : "info" });
    res.json({ success: true, application: updated });
  } catch (err) {
    console.error("PATCH Application Error:", err);
    res.status(500).json({ error: "Failed to update application." });
  }
});

// DELETE /api/applications/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const before = db.applications.length;
      db.applications = db.applications.filter((a) => !(a._id === id && (a.userId === req.user.id || req.user.role === "admin")));
      if (db.applications.length === before) return res.status(404).json({ error: "Application not found or unauthorized." });
      saveMockDb(db);
    } else {
      const query = req.user.role === "admin" ? { _id: id } : { _id: id, userId: req.user.id };
      const deleted = await Application.findOneAndDelete(query);
      if (!deleted) return res.status(404).json({ error: "Application not found or unauthorized." });
    }

    res.json({ success: true, message: "Application deleted." });
  } catch (err) {
    console.error("DELETE Application Error:", err);
    res.status(500).json({ error: "Failed to delete application." });
  }
});

export default router;
