import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
console.log("Connecting to:", MONGODB_URI);

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: String,
    phone: String,
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");
  const users = await User.find({});
  console.log("Users in database:");
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
