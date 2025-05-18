const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");


// Get all active barbers for customers
router.get("/active-barbers", async (req, res) => {
  try {
    const activeBarbers = await Barber.find({ subscriptionActive: true }).sort({ rating: -1 });
    res.json(activeBarbers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching barbers", error });
  }
});

module.exports = router;
