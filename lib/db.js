import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import Application from "../models/Application.js";
import UploadedDocument from "../models/UploadedDocument.js";
import Notification from "../models/Notification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI;
const MOCK_DB_PATH = path.join(__dirname, "..", "mock-db.json");

// ── Mock DB helpers ───────────────────────────────────────────────────────────
export const getMockDb = () => {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      const initial = {
        users: [],
        uploadedDocuments: [],
        applications: [],
        chatHistories: [],
        notifications: [],
        eligibilityChecks: [],
      };
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(MOCK_DB_PATH, "utf8"));
  } catch (err) {
    console.error("Error reading mock DB:", err);
    return { users: [], uploadedDocuments: [], applications: [], chatHistories: [], notifications: [], eligibilityChecks: [] };
  }
};

export const saveMockDb = (data) => {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing mock DB:", err);
  }
};

export const seedMockDb = () => {
  const db = getMockDb();
  let updated = false;

  if (db.users.length === 0) {
    db.users.push(
      {
        _id: "user_demo_123",
        name: "Aarav Sharma",
        email: "demo@bureauai.in",
        password: "$2a$10$dgloRQQf8WNJhc1843KWEeD43zdLVhOBFsHuCRmU1t1crtBISYJLG",
        role: "user",
        phone: "9920136318",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Aarav",
        createdAt: new Date().toISOString(),
      },
      {
        _id: "user_admin_123",
        name: "Admin",
        email: "bureauai@gmail.com",
        password: "$2b$10$C1totIwSykTfnidmGGWhbOLPglvCcTfJPx6Sk8t6aazFvAVMcDGuq",
        role: "admin",
        phone: "9876543210",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin",
        createdAt: new Date().toISOString(),
      }
    );
    updated = true;
  }

  if (db.applications.length === 0) {
    db.applications.push(
      {
        _id: "app_1",
        userId: "user_demo_123",
        title: "Aadhaar Card Address Update",
        referenceNumber: "AD-98273618",
        department: "UIDAI",
        status: "under_review",
        progress: 60,
        timeline: [
          { status: "submitted", description: "Application submitted online with address proof", date: new Date(Date.now() - 3 * 86400000).toISOString() },
          { status: "under_review", description: "Verification officer assigned & reviewing documents", date: new Date(Date.now() - 86400000).toISOString() },
        ],
        estimatedCompletion: new Date(Date.now() + 8 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        _id: "app_2",
        userId: "user_demo_123",
        title: "Income Certificate Application",
        referenceNumber: "IC-2026-9081",
        department: "Revenue Department, Maharashtra",
        status: "action_required",
        progress: 40,
        timeline: [
          { status: "submitted", description: "Income details and forms uploaded", date: new Date(Date.now() - 5 * 86400000).toISOString() },
          { status: "under_review", description: "Tahsildar Office verified salary slips", date: new Date(Date.now() - 4 * 86400000).toISOString() },
          { status: "action_required", description: "Clarification required: Please upload Form 16 or Land tax receipt.", date: new Date(Date.now() - 2 * 86400000).toISOString() },
        ],
        estimatedCompletion: new Date(Date.now() + 13 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      }
    );
    updated = true;
  }

  if (db.notifications.length === 0) {
    db.notifications.push(
      {
        _id: "notif_1",
        userId: "user_demo_123",
        title: "Document Verified Successfully",
        message: "Your PAN Card details have been processed by Gemini and marked as Valid.",
        type: "success",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "notif_2",
        userId: "user_demo_123",
        title: "Action Required on Income Certificate",
        message: "Tahsildar office requested additional salary documents. Check Application Tracker.",
        type: "warning",
        read: false,
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      }
    );
    updated = true;
  }

  if (updated) saveMockDb(db);
};

// Seed Real MongoDB Database
export const seedRealDb = async () => {
  try {
    console.log("Checking and seeding admin & demo user credentials...");
    
    // 1. Ensure Demo User exists and is verified
    let demoUser = await User.findOne({ email: "demo@bureauai.in" });
    const demoPayload = {
      name: "Aarav Sharma",
      email: "demo@bureauai.in",
      password: "$2a$10$dgloRQQf8WNJhc1843KWEeD43zdLVhOBFsHuCRmU1t1crtBISYJLG", // password: demo
      role: "user",
      phone: "9920136318",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Aarav",
      isVerified: true,
    };

    if (!demoUser) {
      demoUser = await User.create(demoPayload);
      console.log("Demo user created.");
    } else {
      demoUser.password = demoPayload.password;
      demoUser.isVerified = true;
      await demoUser.save();
      console.log("Demo user updated and verified.");
    }

    // 2. Ensure Admin User exists and is verified
    let adminUser = await User.findOne({ email: "bureauai@gmail.com" });
    if (!adminUser) {
      // Fallback: check if old admin user exists and rename/update them
      adminUser = await User.findOne({ email: "admin@bureauai.in" });
    }
    const adminPayload = {
      name: "Admin",
      email: "bureauai@gmail.com",
      password: "$2b$10$C1totIwSykTfnidmGGWhbOLPglvCcTfJPx6Sk8t6aazFvAVMcDGuq", // password: bureau123
      role: "admin",
      phone: "9876543210",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin",
      isVerified: true,
    };

    if (!adminUser) {
      adminUser = await User.create(adminPayload);
      console.log("Admin user created.");
    } else {
      adminUser.name = adminPayload.name;
      adminUser.email = adminPayload.email;
      adminUser.password = adminPayload.password;
      adminUser.isVerified = true;
      await adminUser.save();
      console.log("Admin user updated and verified.");
    }

    // 3. Ensure Demo User has Applications
    const appCount = await Application.countDocuments({ userId: demoUser._id });
    if (appCount === 0) {
      console.log("Seeding demo user applications...");
      await Application.create([
        {
          userId: demoUser._id,
          title: "Aadhaar Card Address Update",
          referenceNumber: "AD-98273618",
          department: "UIDAI",
          status: "under_review",
          progress: 60,
          timeline: [
            { status: "submitted", description: "Application submitted online with address proof", date: new Date(Date.now() - 3 * 86400000) },
            { status: "under_review", description: "Verification officer assigned & reviewing documents", date: new Date(Date.now() - 86400000) },
          ],
          estimatedCompletion: new Date(Date.now() + 8 * 86400000),
          createdAt: new Date(Date.now() - 3 * 86400000),
        },
        {
          userId: demoUser._id,
          title: "Income Certificate Application",
          referenceNumber: "IC-2026-9081",
          department: "Revenue Department, Maharashtra",
          status: "action_required",
          progress: 40,
          timeline: [
            { status: "submitted", description: "Income details and forms uploaded", date: new Date(Date.now() - 5 * 86400000) },
            { status: "under_review", description: "Tahsildar Office verified salary slips", date: new Date(Date.now() - 4 * 86400000) },
            { status: "action_required", description: "Clarification required: Please upload Form 16 or Land tax receipt.", date: new Date(Date.now() - 2 * 86400000) },
          ],
          estimatedCompletion: new Date(Date.now() + 13 * 86400000),
          createdAt: new Date(Date.now() - 5 * 86400000),
        }
      ]);
    }

    // 4. Ensure Demo User has Notifications
    const notifCount = await Notification.countDocuments({ userId: demoUser._id });
    if (notifCount === 0) {
      console.log("Seeding demo user notifications...");
      await Notification.create([
        {
          userId: demoUser._id,
          title: "Document Verified Successfully",
          message: "Your PAN Card details have been processed by Gemini and marked as Valid.",
          type: "success",
        },
        {
          userId: demoUser._id,
          title: "Action Required on Income Certificate",
          message: "Tahsildar office requested additional salary documents. Check Application Tracker.",
          type: "warning",
          createdAt: new Date(Date.now() - 12 * 3600000),
        }
      ]);
    }

    console.log("Real DB check & seeding completed successfully!");
  } catch (err) {
    console.error("Failed to seed real MongoDB database:", err.message);
  }
};

// ── Mongoose connection ───────────────────────────────────────────────────────
let cached = { conn: null, promise: null };

async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing! MongoDB is required for real data.");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then(async (m) => {
        // Run database seed check
        await seedRealDb();
        return m;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
