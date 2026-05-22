import "dotenv/config";
import mongoose from "mongoose";
import dbConnect from "./lib/db.js";
import Application from "./models/Application.js";
import User from "./models/User.js";


async function run() {
  await dbConnect();
  console.log("DB Connected!");

  const rawApps = await Application.find({}).populate("userId", "name email avatar").sort({ createdAt: -1 });
  console.log("Populated apps from query:");
  rawApps.forEach(app => {
    console.log(`App Title: ${app.title}`);
    console.log(`userId raw:`, app.userId);
    console.log(`typeof userId:`, typeof app.userId);
    if (app.userId) {
      console.log(`userId name:`, app.userId.name);
      console.log(`userId email:`, app.userId.email);
    }
    console.log("------------------------");
  });

  process.exit(0);
}

run().catch(console.error);
