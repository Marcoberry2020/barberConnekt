const cron = require("node-cron");
const Barber = require("../models/barberModel");


// Scheduled job to check subscription expiration every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date();
    const expiredBarbers = await Barber.find({ subscriptionExpires: { $lte: now } });

    for (const barber of expiredBarbers) {
      barber.subscriptionActive = false;
      await barber.save();
    }

    console.log(`Checked subscriptions: ${expiredBarbers.length} barbers expired.`);
  } catch (error) {
    console.error("Error updating expired subscriptions:", error);
  }
});

module.exports = {};
