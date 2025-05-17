const cron = require("node-cron");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

// Resolve the correct path for the Barber model
const barberPath = path.resolve(__dirname, "./models/Barber.js");
console.log("Resolved path:", barberPath);
console.log("File exists:", fs.existsSync(barberPath));

const Barber = require(barberPath);

// Ensure MongoDB is connected before running cron jobs
if (mongoose.connection.readyState === 1) {
  console.log("✅ MongoDB is connected. Starting cron jobs...");

  // 🔴 CRON JOB: Auto-Hide Barbers After Free Trial / Expired Subscription
  cron.schedule("0 * * * *", async () => { // Runs every hour
    try {
      const now = new Date();
      await Barber.updateMany(
        {
          $or: [
            { freeTrialExpires: { $lte: now }, subscriptionActive: false }, // Free trial expired, not subscribed
            { subscriptionExpires: { $lte: now } }, // Subscription expired
          ],
        },
        {
          subscriptionActive: false,
        }
      );
      console.log("Checked and updated expired barber subscriptions.");
    } catch (error) {
      console.error("Error running cron job:", error);
    }
  });
} else {
  console.warn("⚠️ MongoDB is not connected yet. Cron jobs will not start.");
}
