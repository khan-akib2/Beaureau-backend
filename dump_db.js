import "dotenv/config";
import mongoose from "mongoose";
import dbConnect, { getMockDb } from "./lib/db.js";
import User from "./models/User.js";
import Notification from "./models/Notification.js";

async function run() {
  try {
    const conn = await dbConnect();
    console.log("Database connected!");

    console.log("--- MONGODB ATLAS USERS ---");
    const atlasUsers = await User.find({});
    console.log(atlasUsers.map(u => ({ id: u._id, email: u.email, role: u.role, name: u.name })));

    console.log("--- MONGODB ATLAS NOTIFICATIONS ---");
    const atlasNotifs = await Notification.find({});
    console.log(atlasNotifs.map(n => ({ id: n._id, userId: n.userId, title: n.title, message: n.message, read: n.read })));

    console.log("--- MOCK DATABASE USERS ---");
    const mockDb = getMockDb();
    console.log(mockDb.users.map(u => ({ id: u._id, email: u.email, role: u.role, name: u.name })));

    console.log("--- MOCK DATABASE NOTIFICATIONS ---");
    console.log(mockDb.notifications.map(n => ({ id: n._id, userId: n.userId, title: n.title, message: n.message, read: n.read })));

    process.exit(0);
  } catch (err) {
    console.error("Dump failed:", err);
    process.exit(1);
  }
}

run();
