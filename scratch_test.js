import "dotenv/config";
import mongoose from "mongoose";
import dbConnect from "./lib/db.js";
import User from "./models/User.js";
import Notification from "./models/Notification.js";

async function run() {
  try {
    const conn = await dbConnect();
    console.log("Database connected!");

    const title = "Broadcast Test Title " + Date.now();
    const message = "Broadcast Test Message";
    const type = "info";

    console.log("Fetching users from MongoDB Atlas...");
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users.`);

    const realNotifications = allUsers.map((u) => ({
      userId: u._id,
      title,
      message,
      type: type || "info",
      read: false
    }));

    console.log("Calling Notification.insertMany...");
    const res = await Notification.insertMany(realNotifications);
    console.log("Successfully inserted real notifications. Count:", res.length);

    // Clean up
    const ids = res.map(n => n._id);
    await Notification.deleteMany({ _id: { $in: ids } });
    console.log("Cleaned up real notifications.");

    process.exit(0);
  } catch (err) {
    console.error("Broadcast test failed with error:", err);
    process.exit(1);
  }
}

run();
