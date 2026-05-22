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
import { sendNotificationEmail } from "../lib/email.js";

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

    // Arrays to hold all records for dynamic telemetry calculations
    let allUsers = [];
    let allDocuments = [];
    let allChats = [];
    let allEligibilityChecks = [];

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

      allUsers = db.users;
      allDocuments = db.uploadedDocuments;
      allChats = db.chatHistories;
      allEligibilityChecks = db.eligibilityChecks;
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
      const rawApps = await Application.find({}).populate("userId", "name email avatar").sort({ createdAt: -1 });

      // Robust post-populate: resolve any unpopulated userId fields
      const usersMapById = {};
      users.forEach(u => { usersMapById[u._id.toString()] = { _id: u._id, name: u.name, email: u.email, avatar: u.avatar }; });
      applications = rawApps.map(app => {
        const appObj = app.toObject ? app.toObject() : app;
        const isPopulated = appObj.userId && typeof appObj.userId === "object" && typeof appObj.userId.name === "string";
        if (!isPopulated) {
          const rawId = appObj.userId ? appObj.userId.toString() : "";
          appObj.userId = usersMapById[rawId] || { _id: rawId || "unknown", name: "Deleted User", email: "" };
        }
        return appObj;
      });

      allUsers = users;
      allDocuments = documents;
      allChats = chats;
      allEligibilityChecks = await EligibilityCheck.find({});
    }

    // Helper to get last 6 months dynamically based on system time
    function getLastSixMonths() {
      const months = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = monthNames[d.getMonth()];
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        months.push({
          label,
          end: endOfMonth,
        });
      }
      return months;
    }

    const months = getLastSixMonths();
    const chartData = months.map(({ label, end }) => {
      // 1. activeUsers: count of users with createdAt <= end
      const activeUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) <= end).length;

      // 2. filesProcessed: count of documents with createdAt <= end
      const filesProcessed = allDocuments.filter(d => d.createdAt && new Date(d.createdAt) <= end).length;

      // 3. aiQueries: messages <= end + eligibility checks <= end
      let chatMsgsCount = 0;
      allChats.forEach(c => {
        if (c.messages) {
          c.messages.forEach(m => {
            const msgTime = m.timestamp || c.createdAt || c.updatedAt;
            if (msgTime && new Date(msgTime) <= end) {
              chatMsgsCount++;
            }
          });
        }
      });

      const eligibilityCount = allEligibilityChecks.filter(ec => ec.createdAt && new Date(ec.createdAt) <= end).length;

      const aiQueries = chatMsgsCount + eligibilityCount;

      return {
        month: label,
        activeUsers,
        filesProcessed,
        aiQueries
      };
    });

    // Calculate real dynamic insights based on active database collections
    let insightDemand = { title: "Scholarship & Welfare Surge", value: "28% Demand Increase", description: "Gemini flagged abnormally high application interest in post-matric student welfare schemes over the last 72 hours." };
    if (applications.length > 0) {
      const deptCounts = {};
      applications.forEach(a => {
        if (a.department) deptCounts[a.department] = (deptCounts[a.department] || 0) + 1;
      });
      let maxDept = "";
      let maxCount = 0;
      Object.entries(deptCounts).forEach(([dept, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxDept = dept;
        }
      });
      if (maxDept) {
        const maxPct = Math.round((maxCount / applications.length) * 100);
        insightDemand = {
          title: `Surge in ${maxDept} Requests`,
          value: `${maxPct}% of Total Apps`,
          description: `${maxDept} represents the highest administrative demand on the portal, with ${maxCount} active application(s) currently tracked.`
        };
      }
    }

    let insightCompliance = { title: "Most Rejected: Address Proof", value: "74% of Audit Rejections", description: "Blurred copies or missing local municipal stamps represent the highest frequency of rejected documents this cycle." };
    const incompleteDocs = documents.filter(d => d.status === "incomplete");
    if (incompleteDocs.length > 0) {
      const typeCounts = {};
      incompleteDocs.forEach(d => {
        const type = d.documentType || "Government Document";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      let maxType = "";
      let maxCount = 0;
      Object.entries(typeCounts).forEach(([type, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxType = type;
        }
      });
      if (maxType) {
        const maxPct = Math.round((maxCount / incompleteDocs.length) * 100);
        insightCompliance = {
          title: `Most Incomplete: ${maxType}`,
          value: `${maxPct}% of Audit Failures`,
          description: `${maxType} represents the highest frequency of document validation errors, with ${maxCount} flagged as incomplete.`
        };
      }
    }

    let insightOperations = { title: "Peak Load: 7 PM - 10 PM", value: "3x Evening Activity", description: "Citizen activity increases by 3x in evening hours. Server load balancing and autoscaling are fully active." };
    if (applications.length > 0) {
      let sumProgress = 0;
      applications.forEach(a => {
        sumProgress += a.progress || 0;
      });
      const avgProgress = Math.round(sumProgress / applications.length);
      insightOperations = {
        title: "Mean Tracked Progress",
        value: `${avgProgress}% Average Progress`,
        description: `The current average administrative milestone completion rate across all active citizen applications on the portal.`
      };
    }

    let insightVerification = { title: "AI Verification Accuracy", value: "89% Auto-Approve", description: "Document pre-vetting automation verified 9 out of 10 incoming citizen uploads without human-in-the-loop intervention." };
    if (documents.length > 0) {
      const verifiedDocs = documents.filter(d => d.status === "verified");
      const rate = Math.round((verifiedDocs.length / documents.length) * 100);
      insightVerification = {
        title: "AI Verification Success",
        value: `${rate}% Verification Rate`,
        description: `Gemini AI governance filters have successfully audited and verified ${verifiedDocs.length} out of ${documents.length} total citizen files.`
      };
    }

    const analyticsObj = {
      usersCount: totalUsers,
      docsCount: totalApplications, // mapped to displays in frontend
      approvedCount: appsByStatus.approved,
      pendingCount: appsByStatus.submitted + appsByStatus.under_review,
      rejectedCount: appsByStatus.rejected + appsByStatus.action_required,
      aiProcessesCount: totalChats + totalEligibilityChecks,
    };

    res.json({
      success: true,
      analytics: analyticsObj,
      users,
      documents,
      applications,
      chartData,
      insights: {
        demand: insightDemand,
        compliance: insightCompliance,
        operations: insightOperations,
        verification: insightVerification
      }
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
      const owner = db.users.find((u) => u._id === doc.userId);
      if (owner) {
        sendNotificationEmail(owner.email, owner.name, `Document Compliance Updated`, `Your file "${doc.fileName}" status updated to "${status.toUpperCase()}".`);
      }
      updatedDoc = doc;
    } else {
      updatedDoc = await UploadedDocument.findByIdAndUpdate(documentId, { status }, { returnDocument: 'after' });
      if (!updatedDoc) return res.status(404).json({ error: "Document not found." });

      await Notification.create({
        userId: updatedDoc.userId,
        title: `Document Compliance Updated`,
        message: `Your file "${updatedDoc.fileName}" status updated to "${status.toUpperCase()}".`,
        type: status === "verified" ? "success" : "warning",
      });
      const owner = await User.findById(updatedDoc.userId);
      if (owner) {
        sendNotificationEmail(owner.email, owner.name, `Document Compliance Updated`, `Your file "${updatedDoc.fileName}" status updated to "${status.toUpperCase()}".`);
      }
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
      const owner = db.users.find((u) => u._id === app.userId);
      if (owner) {
        sendNotificationEmail(owner.email, owner.name, `Application Tracker Update`, `Your tracking request "${app.title}" has progress update: ${progress || app.progress}%.`);
      }
      const usersMap = {};
      db.users.forEach((u) => {
        usersMap[u._id] = { _id: u._id, name: u.name, email: u.email, avatar: u.avatar };
      });
      updatedApp = {
        ...app,
        userId: usersMap[app.userId] || { _id: app.userId, name: "System Seed", email: "system@bureauai.in" }
      };
    } else {
      const app = await Application.findById(applicationId);
      if (!app) return res.status(404).json({ error: "Application not found." });

      const updates = {};
      if (status) updates.status = status;
      if (progress !== undefined) updates.progress = Number(progress);

      let savedApp = null;
      if (timelineDescription) {
        savedApp = await Application.findByIdAndUpdate(
          applicationId,
          {
            $set: updates,
            $push: { timeline: { status: status || app.status, description: timelineDescription, date: new Date() } },
          },
          { returnDocument: 'after' }
        );
      } else {
        savedApp = await Application.findByIdAndUpdate(applicationId, { $set: updates }, { returnDocument: 'after' });
      }

      await Notification.create({
        userId: app.userId,
        title: `Application Tracker Update`,
        message: `Your tracking request "${app.title}" has progress update: ${progress || app.progress}%.`,
        type: status === "approved" ? "success" : "info",
      });
      const owner = await User.findById(app.userId);
      if (owner) {
        sendNotificationEmail(owner.email, owner.name, `Application Tracker Update`, `Your tracking request "${app.title}" has progress update: ${progress || app.progress}%.`);
      }
      updatedApp = await Application.findById(applicationId).populate("userId", "name email avatar");
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

    if (req.user.email !== "bureauai@gmail.com") {
      return res.status(403).json({ error: "Unauthorized: Only the super admin (bureauai@gmail.com) can promote or demote administrators." });
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
      updatedUser = await User.findByIdAndUpdate(userId, { role }, { returnDocument: 'after' }).select("-password");
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

    if (req.user.email !== "bureauai@gmail.com") {
      return res.status(403).json({ error: "Unauthorized: Only the super admin (bureauai@gmail.com) can terminate user profiles." });
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
