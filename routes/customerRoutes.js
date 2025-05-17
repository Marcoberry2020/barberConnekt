 const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");

// Get all active barbers for customers
router.get("/active-barbers", async (req, res) => {
  try {
    const now = new Date();

    // Find barbers who are visible and whose subscription is not expired
    const activeBarbers = await Barber.find({
      visible: true,
      subscriptionExpires: { $gt: now },
    }).sort({ rating: -1 }); // Sort by rating descending

    res.json(activeBarbers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching barbers", error });
  }
});

module.exports = router;
