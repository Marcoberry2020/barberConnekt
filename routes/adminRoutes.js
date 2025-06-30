 const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");

require("dotenv").config();

const SECRET_PASSWORD = process.env.ADMIN_PASSWORD || "marcoberry2020"; // Store in .env file

// Admin dashboard stats
router.post("/dashboard", async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== SECRET_PASSWORD) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const totalBarbers = await Barber.countDocuments();

    // Count only barbers who have ever paid (subscriptionExpiresAt exists)
    const paidBarbersCount = await Barber.countDocuments({
      subscriptionExpiresAt: { $exists: true },
    });

    const totalRevenue = paidBarbersCount * 5000;

    // Fetch all barbers with their name and price
    const barbers = await Barber.find({}, "name price");

    res.json({
      totalBarbers,
      totalRevenue,
      barbers,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin data", error });
  }
});
// clicks
 router.post("/dashboard", async (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const barbers = await Barber.find().select("name price clickCount clickLogs");
  const totalBarbers = barbers.length;
  const totalRevenue = totalBarbers * 5000; // or your logic

  res.json({ totalBarbers, totalRevenue, barbers });
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
