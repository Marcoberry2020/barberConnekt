 const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");

require("dotenv").config();

const SECRET_PASSWORD = process.env.ADMIN_PASSWORD || "marcoberry2020";

// Admin dashboard stats with barber status
router.post("/dashboard", async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== SECRET_PASSWORD) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const totalBarbers = await Barber.countDocuments();

    const totalRevenueAgg = await Barber.aggregate([
      {
        $match: { subscriptionExpires: { $gt: new Date() } } // Only active paid subscriptions count
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: 5000 }, // ₦5000 per paid subscription
        },
      },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.revenue || 0;

    // Fetch barbers with necessary fields to calculate status
    const barbers = await Barber.find(
      {},
      "name price freeTrialExpires subscriptionExpires"
    );

    const now = new Date();
    const barbersWithStatus = barbers.map((barber) => {
      let status = "Hidden";

      if (barber.freeTrialExpires && barber.freeTrialExpires > now) {
        status = "Free Trial Active";
      } else if (barber.subscriptionExpires && barber.subscriptionExpires > now) {
        status = "Visible (Paid)";
      }

      return {
        _id: barber._id,
        name: barber.name,
        price: barber.price,
        status,
      };
    });

    res.json({
      totalBarbers,
      totalRevenue,
      barbers: barbersWithStatus,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin data", error });
  }
});

// Delete Barber Endpoint
router.delete("/delete-barber/:id", async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== SECRET_PASSWORD) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { id } = req.params;
    const deletedBarber = await Barber.findByIdAndDelete(id);

    if (!deletedBarber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    res.json({ message: "Barber deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting barber", error });
  }
});

module.exports = router;
