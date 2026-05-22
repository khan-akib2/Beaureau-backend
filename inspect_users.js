import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is missing from backend/.env");
    process.exit(1);
  }
  console.log("Connecting to database:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log("Users in DB:");
  users.forEach(u => {
    console.log(`- ID: ${u._id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
    console.log(`  isVerified: ${u.isVerified}, otp: ${u.otp}, otpExpires: ${u.otpExpires}`);
    console.log(`  aadhaarNum: ${u.aadhaarNum}, aadhaarOtp: ${u.aadhaarOtp}, aadhaarOtpExpires: ${u.aadhaarOtpExpires}`);
  });
  process.exit(0);
}

run().catch(console.error);
