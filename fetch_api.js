import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "bureauai_super_secret_jwt_key_987654321";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: String,
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB!");
  
  // Find admin user
  const admin = await User.findOne({ email: "bureauai@gmail.com" });
  if (!admin) {
    console.error("Admin user not found in DB!");
    process.exit(1);
  }
  
  console.log("Found admin:", admin._id, admin.name);
  
  // Sign token
  const token = jwt.sign({ id: admin._id.toString(), email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: "1d" });
  console.log("Generated Admin Token:", token);
  
  await mongoose.disconnect();
  
  // Fetch /api/applications
  console.log("Fetching /api/applications...");
  const res = await fetch("http://localhost:5000/api/applications", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  
  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response JSON:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
