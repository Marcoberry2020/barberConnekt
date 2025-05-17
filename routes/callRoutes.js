const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");


// Generate Phone Call Link
router.get("/call/:barberId", async (req, res) => {
  try {
    const { barberId } = req.params;
    const barber = await Barber.findById(barberId);
    if (!barber) return res.status(404).json({ message: "Barber not found" });

    const callLink = `tel:${barber.phone}`;
    res.json({ callLink });
  } catch (error) {
    res.status(500).json({ message: "Error generating call link", error });
  }
});

module.exports = router;
