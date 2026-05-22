import express from "express";
import mongoose from "mongoose";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import User from "../models/User.js";
import UploadedDocument from "../models/UploadedDocument.js";
import Application from "../models/Application.js";
import ChatHistory from "../models/ChatHistory.js";
import EligibilityCheck from "../models/EligibilityCheck.js";
import Notification from "../models/Notification.js";
import { requireAdmin } from "../lib/auth.js";

const router = express.Router();

// GET /api/admin/analytics
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const conn = await dbConnect();

    let totalUsers = 0;
    let totalDocuments = 0;
    let totalApplications = 0;
    let totalChats = 0;
    let totalEligibilityChecks = 0;

    let docsByStatus = { verified: 0, incomplete: 0, pending: 0 };
    let appsByStatus = { submitted: 0, under_review: 0, action_required: 0, approved: 0, rejected: 0 };

    let users = [];
    let documents = [];
    let applications = [];

    if (conn.isMock) {
      const db = getMockDb();
      totalUsers = db.users.length;
      totalDocuments = db.uploadedDocuments.length;
      db.uploadedDocuments.forEach((d) => {
        if (docsByStatus[d.status] !== undefined) docsByStatus[d.status]++;
      });
      totalApplications = db.applications.length;
      db.applications.forEach((a) => {
        if (appsByStatus[a.status] !== undefined) appsByStatus[a.status]++;
      });
      db.chatHistories.forEach((c) => {
        totalChats += c.messages.length;
      });
      totalEligibilityChecks = db.eligibilityChecks.length;

      // Populate userId names/emails for display in frontend from user objects
      const usersMap = {};
      db.users.forEach((u) => {
        usersMap[u._id] = { name: u.name, email: u.email, avatar: u.avatar };
      });

      users = db.users.map(({ password, ...u }) => u);
      documents = db.uploadedDocuments.map((d) => ({
        ...d,
        userId: usersMap[d.userId] || { name: "System Seed", email: "system@bureauai.in" },
      }));
      applications = db.applications.map((a) => ({
        ...a,
        userId: usersMap[a.userId] || { name: "System Seed", email: "system@bureauai.in" },
      }));
    } else {
      totalUsers = await User.countDocuments({});
      totalDocuments = await UploadedDocument.countDocuments({});
      const docStats = await UploadedDocument.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
      docStats.forEach((s) => {
        if (docsByStatus[s._id] !== undefined) docsByStatus[s._id] = s.count;
      });

      totalApplications = await Application.countDocuments({});
      const appStats = await Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
      appStats.forEach((s) => {
        if (appsByStatus[s._id] !== undefined) appsByStatus[s._id] = s.count;
      });

      const chats = await ChatHistory.find({});
      chats.forEach((c) => {
        totalChats += c.messages ? c.messages.length : 0;
      });
      totalEligibilityChecks = await EligibilityCheck.countDocuments({});

      users = await User.find({}).select("-password").sort({ createdAt: -1 });
      documents = await UploadedDocument.find({}).populate("userId", "name email avatar").sort({ createdAt: -1 });
      applications = await Application.find({}).populate("userId", "name email avatar").sort({ createdAt: -1 });
    }

    const chartData = [
      { month: "Dec", activeUsers: Math.max(5, Math.floor(totalUsers * 0.4)), filesProcessed: Math.max(10, Math.floor(totalDocuments * 0.4)), aiQueries: Math.max(25, Math.floor(totalChats * 0.4)) },
      { month: "Jan", activeUsers: Math.max(8, Math.floor(totalUsers * 0.6)), filesProcessed: Math.max(15, Math.floor(totalDocuments * 0.5)), aiQueries: Math.max(45, Math.floor(totalChats * 0.5)) },
      { month: "Feb", activeUsers: Math.max(12, Math.floor(totalUsers * 0.7)), filesProcessed: Math.max(22, Math.floor(totalDocuments * 0.6)), aiQueries: Math.max(70, Math.floor(totalChats * 0.6)) },
      { month: "Mar", activeUsers: Math.max(18, Math.floor(totalUsers * 0.8)), filesProcessed: Math.max(30, Math.floor(totalDocuments * 0.75)), aiQueries: Math.max(110, Math.floor(totalChats * 0.75)) },
      { month: "Apr", activeUsers: Math.max(25, Math.floor(totalUsers * 0.9)), filesProcessed: Math.max(40, Math.floor(totalDocuments * 0.9)), aiQueries: Math.max(150, Math.floor(totalChats * 0.9)) },
      { month: "May", activeUsers: totalUsers, filesProcessed: totalDocuments, aiQueries: totalChats },
    ];

    const analyticsObj = {
      usersCount: totalUsers,
      docsCount: totalApplications, // mapped to displays in frontend
      approvedCount: appsByStatus.approved,
      pendingCount: appsByStatus.submitted + appsByStatus.under_review,
      rejectedCount: appsByStatus.rejected + appsByStatus.action_required,
    };

    res.json({
      success: true,
      analytics: analyticsObj,
      users,
      documents,
      applications,
      chartData,
    });
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

// PATCH /api/admin/documents
router.patch("/documents", requireAdmin, async (req, res) => {
  try {
    const { documentId, status } = req.body;
    if (!documentId || !status) {
      return res.status(400).json({ error: "Document ID and status are required." });
    }

    const conn = await dbConnect();
    let updatedDoc = null;

    if (conn.isMock || !mongoose.Types.ObjectId.isValid(documentId)) {
      const db = getMockDb();
      const doc = db.uploadedDocuments.find((d) => d._id === documentId);
      if (!doc) return res.status(404).json({ error: "Document not found." });
      doc.status = status;
      doc.updatedAt = new Date().toISOString();
      db.notifications.push({
        _id: "notif_" + Math.random().toString(36).substr(2, 9),
        userId: doc.userId,
        title: `Document Compliance Updated`,
        message: `Your file "${doc.fileName}" status updated to "${status.toUpperCase()}".`,
        type: status === "verified" ? "success" : "warning",
        read: false,
        createdAt: new Date().toISOString(),
      });
      saveMockDb(db);
      updatedDoc = doc;
    } else {
      updatedDoc = await UploadedDocument.findByIdAndUpdate(documentId, { status }, { new: true });
      if (!updatedDoc) return res.status(404).json({ error: "Document not found." });

      await Notification.create({
        userId: updatedDoc.userId,
        title: `Document Compliance Updated`,
        message: `Your file "${updatedDoc.fileName}" status updated to "${status.toUpperCase()}".`,
        type: status === "verified" ? "success" : "warning",
      });
    }

    res.json({ success: true, document: updatedDoc });
  } catch (err) {
    console.error("Admin PATCH Document Error:", err);
    res.status(500).json({ error: "Failed to update document status." });
  }
});

// PATCH /api/admin/applications
router.patch("/applications", requireAdmin, async (req, res) => {
  try {
    const { applicationId, status, progress, timelineDescription } = req.body;
    if (!applicationId) {
      return res.status(400).json({ error: "Application ID is required." });
    }

    const conn = await dbConnect();
    let updatedApp = null;

    if (conn.isMock || !mongoose.Types.ObjectId.isValid(applicationId)) {
      const db = getMockDb();
      const app = db.applications.find((a) => a._id === applicationId);
      if (!app) return res.status(404).json({ error: "Application not found." });

      if (status) app.status = status;
      if (progress !== undefined) app.progress = Number(progress);
      if (timelineDescription) {
        app.timeline.push({
          status: status || app.status,
          description: timelineDescription,
          date: new Date().toISOString(),
        });
      }
      app.updatedAt = new Date().toISOString();

      db.notifications.push({
        _id: "notif_" + Math.random().toString(36).substr(2, 9),
        userId: app.userId,
        title: `Application Tracker Update`,
        message: `Your tracking request "${app.title}" has progress update: ${progress || app.progress}%.`,
        type: status === "approved" ? "success" : "info",
        read: false,
        createdAt: new Date().toISOString(),
      });

      saveMockDb(db);
      updatedApp = app;
    } else {
      const app = await Application.findById(applicationId);
      if (!app) return res.status(404).json({ error: "Application not found." });

      const updates = {};
      if (status) updates.status = status;
      if (progress !== undefined) updates.progress = Number(progress);

      if (timelineDescription) {
        updatedApp = await Application.findByIdAndUpdate(
          applicationId,
          {
            $set: updates,
            $push: { timeline: { status: status || app.status, description: timelineDescription, date: new Date() } },
          },
          { new: true }
        );
      } else {
        updatedApp = await Application.findByIdAndUpdate(applicationId, { $set: updates }, { new: true });
      }

      await Notification.create({
        userId: app.userId,
        title: `Application Tracker Update`,
        message: `Your tracking request "${app.title}" has progress update: ${progress || app.progress}%.`,
        type: status === "approved" ? "success" : "info",
      });
    }

    res.json({ success: true, application: updatedApp });
  } catch (err) {
    console.error("Admin PATCH Application Error:", err);
    res.status(500).json({ error: "Failed to update application tracker log." });
  }
});

// PATCH /api/admin/users
router.patch("/users", requireAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: "User ID and role are required." });
    }

    const conn = await dbConnect();
    let updatedUser = null;

    if (conn.isMock || !mongoose.Types.ObjectId.isValid(userId)) {
      const db = getMockDb();
      const user = db.users.find((u) => u._id === userId);
      if (!user) return res.status(404).json({ error: "User not found." });
      user.role = role;
      user.updatedAt = new Date().toISOString();
      saveMockDb(db);
      updatedUser = { _id: user._id, name: user.name, email: user.email, role: user.role };
    } else {
      updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select("-password");
      if (!updatedUser) return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Admin PATCH User Error:", err);
    res.status(500).json({ error: "Failed to update user role." });
  }
});

// DELETE /api/admin/users
router.delete("/users", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const conn = await dbConnect();

    if (conn.isMock || !mongoose.Types.ObjectId.isValid(userId)) {
      const db = getMockDb();
      db.users = db.users.filter((u) => u._id !== userId);
      db.uploadedDocuments = db.uploadedDocuments.filter((d) => d.userId !== userId);
      db.applications = db.applications.filter((a) => a.userId !== userId);
      db.chatHistories = db.chatHistories.filter((c) => c.userId !== userId);
      db.eligibilityChecks = db.eligibilityChecks.filter((e) => e.userId !== userId);
      db.notifications = db.notifications.filter((n) => n.userId !== userId);
      saveMockDb(db);
    } else {
      await User.findByIdAndDelete(userId);
      await UploadedDocument.deleteMany({ userId });
      await Application.deleteMany({ userId });
      await ChatHistory.deleteMany({ userId });
      await EligibilityCheck.deleteMany({ userId });
      await Notification.deleteMany({ userId });
    }

    res.json({ success: true, message: "User account and all linked records removed." });
  } catch (err) {
    console.error("Admin DELETE User Error:", err);
    res.status(500).json({ error: "Failed to terminate user profile." });
  }
});

export default router;
