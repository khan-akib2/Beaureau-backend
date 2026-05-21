import express from "express";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import User from "../models/User.js";
import UploadedDocument from "../models/UploadedDocument.js";
import Application from "../models/Application.js";
import ChatHistory from "../models/ChatHistory.js";
import EligibilityCheck from "../models/EligibilityCheck.js";
import { requireAdmin } from "../lib/auth.js";

const router = express.Router();

// GET /api/admin/analytics
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const conn = await dbConnect();

    let totalUsers = 0, totalDocuments = 0, totalApplications = 0, totalChats = 0, totalEligibilityChecks = 0;
    let docsByStatus = { verified: 0, incomplete: 0, pending: 0 };
    let appsByStatus = { submitted: 0, under_review: 0, action_required: 0, approved: 0, rejected: 0 };

    if (conn.isMock) {
      const db = getMockDb();
      totalUsers = db.users.length;
      totalDocuments = db.uploadedDocuments.length;
      db.uploadedDocuments.forEach((d) => { if (docsByStatus[d.status] !== undefined) docsByStatus[d.status]++; });
      totalApplications = db.applications.length;
      db.applications.forEach((a) => { if (appsByStatus[a.status] !== undefined) appsByStatus[a.status]++; });
      db.chatHistories.forEach((c) => { totalChats += c.messages.length; });
      totalEligibilityChecks = db.eligibilityChecks.length;
    } else {
      totalUsers = await User.countDocuments({});
      totalDocuments = await UploadedDocument.countDocuments({});
      const docStats = await UploadedDocument.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
      docStats.forEach((s) => { if (docsByStatus[s._id] !== undefined) docsByStatus[s._id] = s.count; });
      totalApplications = await Application.countDocuments({});
      const appStats = await Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
      appStats.forEach((s) => { if (appsByStatus[s._id] !== undefined) appsByStatus[s._id] = s.count; });
      const chats = await ChatHistory.find({});
      chats.forEach((c) => { totalChats += c.messages.length; });
      totalEligibilityChecks = await EligibilityCheck.countDocuments({});
    }

    const chartData = [
      { month: "Dec", activeUsers: Math.max(5, Math.floor(totalUsers * 0.4)), filesProcessed: Math.max(10, Math.floor(totalDocuments * 0.4)), aiQueries: Math.max(25, Math.floor(totalChats * 0.4)) },
      { month: "Jan", activeUsers: Math.max(8, Math.floor(totalUsers * 0.6)), filesProcessed: Math.max(15, Math.floor(totalDocuments * 0.5)), aiQueries: Math.max(45, Math.floor(totalChats * 0.5)) },
      { month: "Feb", activeUsers: Math.max(12, Math.floor(totalUsers * 0.7)), filesProcessed: Math.max(22, Math.floor(totalDocuments * 0.6)), aiQueries: Math.max(70, Math.floor(totalChats * 0.6)) },
      { month: "Mar", activeUsers: Math.max(18, Math.floor(totalUsers * 0.8)), filesProcessed: Math.max(30, Math.floor(totalDocuments * 0.75)), aiQueries: Math.max(110, Math.floor(totalChats * 0.75)) },
      { month: "Apr", activeUsers: Math.max(25, Math.floor(totalUsers * 0.9)), filesProcessed: Math.max(40, Math.floor(totalDocuments * 0.9)), aiQueries: Math.max(150, Math.floor(totalChats * 0.9)) },
      { month: "May", activeUsers: totalUsers, filesProcessed: totalDocuments, aiQueries: totalChats },
    ];

    res.json({ success: true, stats: { totalUsers, totalDocuments, docsByStatus, totalApplications, appsByStatus, totalChats, totalEligibilityChecks }, chartData });
  } catch (err) {
    console.error("Admin Analytics Error:", err);
    res.status(500).json({ error: "Failed to generate analytics." });
  }
});

// GET /api/admin/users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const conn = await dbConnect();
    let users = [];
    if (conn.isMock) {
      const db = getMockDb();
      users = db.users.map(({ password, ...u }) => u);
    } else {
      users = await User.find({}).select("-password").sort({ createdAt: -1 });
    }
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// PATCH /api/admin/users — toggle role
router.patch("/users", requireAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) return res.status(400).json({ error: "userId and role required." });
    const conn = await dbConnect();
    if (conn.isMock) {
      const db = getMockDb();
      const idx = db.users.findIndex(u => u._id === userId);
      if (idx === -1) return res.status(404).json({ error: "User not found." });
      db.users[idx].role = role;
      saveMockDb(db);
      return res.json({ success: true });
    }
    await User.findByIdAndUpdate(userId, { $set: { role } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role." });
  }
});

// DELETE /api/admin/users?userId=xxx
router.delete("/users", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required." });
    const conn = await dbConnect();
    if (conn.isMock) {
      const db = getMockDb();
      const before = db.users.length;
      db.users = db.users.filter(u => u._id !== userId);
      if (db.users.length === before) return res.status(404).json({ error: "User not found." });
      saveMockDb(db);
      return res.json({ success: true });
    }
    await User.findByIdAndDelete(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// PATCH /api/admin/documents — update doc status
router.patch("/documents", requireAdmin, async (req, res) => {
  try {
    const { documentId, status } = req.body;
    if (!documentId || !status) return res.status(400).json({ error: "documentId and status required." });
    const conn = await dbConnect();
    if (conn.isMock) {
      const db = getMockDb();
      const idx = db.uploadedDocuments.findIndex(d => d._id === documentId);
      if (idx === -1) return res.status(404).json({ error: "Document not found." });
      db.uploadedDocuments[idx].status = status;
      saveMockDb(db);
      return res.json({ success: true });
    }
    await UploadedDocument.findByIdAndUpdate(documentId, { $set: { status } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update document." });
  }
});

// PATCH /api/admin/applications — update status, progress, push timeline
router.patch("/applications", requireAdmin, async (req, res) => {
  try {
    const { applicationId, status, progress, timelineDescription } = req.body;
    if (!applicationId) return res.status(400).json({ error: "applicationId required." });
    const conn = await dbConnect();
    const newEntry = { status, description: timelineDescription, date: new Date().toISOString() };
    if (conn.isMock) {
      const db = getMockDb();
      const idx = db.applications.findIndex(a => a._id === applicationId);
      if (idx === -1) return res.status(404).json({ error: "Application not found." });
      db.applications[idx].status = status;
      db.applications[idx].progress = progress;
      db.applications[idx].timeline = [...(db.applications[idx].timeline || []), newEntry];
      saveMockDb(db);
      return res.json({ success: true, application: db.applications[idx] });
    }
    const app = await Application.findByIdAndUpdate(
      applicationId,
      { $set: { status, progress }, $push: { timeline: newEntry } },
      { new: true }
    );
    if (!app) return res.status(404).json({ error: "Application not found." });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ error: "Failed to update application." });
  }
});

export default router;
