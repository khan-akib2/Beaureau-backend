import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


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
        password: "$2a$10$Wp.uM8mkyhI3U/l32yB63eWwFvHhO2yR3R3vG/lUaZ.rIpe1m9u6a",
        role: "user",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Aarav",
        createdAt: new Date().toISOString(),
      },
      {
        _id: "user_admin_123",
        name: "Super Admin",
        email: "admin@bureauai.in",
        password: "$2a$10$Wp.uM8mkyhI3U/l32yB63eWwFvHhO2yR3R3vG/lUaZ.rIpe1m9u6a",
        role: "admin",
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

// ── Mongoose connection ───────────────────────────────────────────────────────
let cached = { conn: null, promise: null };

async function dbConnect() {
  if (!MONGODB_URI) {
    seedMockDb();
    return { isMock: true };
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m)
      .catch((err) => {
        console.error("MongoDB connection failed, using mock DB:", err.message);
        seedMockDb();
        return { isMock: true, error: err.message };
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    seedMockDb();
    return { isMock: true, error: e.message };
  }

  return cached.conn;
}

export default dbConnect;
