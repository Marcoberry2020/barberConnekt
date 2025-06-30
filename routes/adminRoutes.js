 const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");

require("dotenv").config();

const SECRET_PASSWORD = process.env.ADMIN_PASSWORD || "marcoberry2020"; // Use .env file in production

// ✅ Admin Dashboard - merged version
router.post("/dashboard", async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== SECRET_PASSWORD) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const barbers = await Barber.find({}, "name phone price clickCount clickLogs");

    const totalBarbers = barbers.length;

    // Count only barbers who have ever paid
    const paidBarbersCount = await Barber.countDocuments({
      subscriptionExpiresAt: { $exists: true },
    });

    const totalRevenue = paidBarbersCount * 5000;

    res.json({
      totalBarbers,
      totalRevenue,
      barbers,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Error fetching admin data", error });
  }
});

// ✅ Delete Barber Endpoint
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
    console.error("Delete error:", error);
    res.status(500).json({ message: "Error deleting barber", error });
  }
});

module.exports = router;
