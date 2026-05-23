import "dotenv/config";
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dbConnect from './lib/db.js';
import User from './models/User.js';
import Notification from './models/Notification.js';

async function run() {
  try {
    console.log("Connecting to DB...");
    await dbConnect();
    console.log("Connected. Fetching users...");
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users.`);

    const title = "Test Broadcast Title";
    const message = "Test Broadcast Message";
    const type = "info";

    const newNotifications = allUsers.map((u) => ({
      userId: u._id,
      title,
      message,
      type: type || "info",
      read: false
    }));

    console.log("Attempting to insertMany notifications...");
    const res = await Notification.insertMany(newNotifications);
    console.log("Insert success! Inserted count:", res.length);
    
    // Now delete the test ones we just inserted
    const ids = res.map(n => n._id);
    await Notification.deleteMany({ _id: { $in: ids } });
    console.log("Deleted test notifications.");
    process.exit(0);
  } catch (err) {
    console.error("Test broadcast failed with error:", err);
    process.exit(1);
  }
}

run();
