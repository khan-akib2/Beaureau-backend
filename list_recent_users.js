import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGODB_URI);
  const users = await mongoose.connection.db.collection('users')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  console.log("Recent users in DB:");
  users.forEach(u => {
    console.log(`- Name: ${u.name}, Email: ${u.email}, isVerified: ${u.isVerified}, OTP: ${u.otp}, createdAt: ${u.createdAt}`);
  });
  process.exit(0);
}

run().catch(console.error);
