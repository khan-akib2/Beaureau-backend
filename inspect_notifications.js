import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const notifications = await mongoose.connection.db.collection('notifications').find({}).toArray();
  console.log("Notifications in DB:");
  notifications.forEach(n => {
    console.log(`- ID: ${n._id}, userId: ${n.userId}, title: "${n.title}", message: "${n.message}", type: "${n.type}", read: ${n.read}, createdAt: ${n.createdAt}`);
  });
  process.exit(0);
}

run().catch(console.error);
