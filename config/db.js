const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      family: 4, // Force IPv4 (fixes some DNS issues)
      retryWrites: true, 
      w: "majority"
    });
    console.log("✅ MongoDB Connected to Atlas...");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
