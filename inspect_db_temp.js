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
  },
  { collection: "users" }
);

const ApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: String,
    referenceNumber: String,
    department: String,
    status: String,
  },
  { collection: "applications" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Application = mongoose.models.Application || mongoose.model("Application", ApplicationSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");
  const users = await User.find({});
  console.log("--- USERS ---");
  console.log(users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role })));

  const apps = await Application.find({});
  console.log("--- APPLICATIONS RAW ---");
  console.log(apps.map(a => ({ id: a._id.toString(), userId: a.userId, title: a.title, ref: a.referenceNumber })));

  console.log("--- APPLICATIONS POPULATED ---");
  const populatedApps = await Application.find({}).populate("userId", "name email");
  console.log(JSON.stringify(populatedApps, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
