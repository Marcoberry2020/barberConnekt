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
    const totalRevenue = await Barber.aggregate([
      {
        $group: {
          _id: null,
          revenue: { $sum: 5000 }, // Assuming each subscription is ₦5000
        },
      },
    ]);

    const barbers = await Barber.find({}, "name price"); // Fetch barbers' names and prices

    res.json({
      totalBarbers,
      totalRevenue: totalRevenue[0]?.revenue || 0,
      barbers, // Send the list of barbers to the frontend
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin data", error });
  }
});

// 🛑 Delete Barber Endpoint
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
