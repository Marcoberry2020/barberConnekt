const express = require("express");
const router = express.Router();
const Barber = require("../models/barberModel");


// Generate WhatsApp chat link
router.get("/chat/:barberId", async (req, res) => {
  try {
    const { barberId } = req.params;
    const barber = await Barber.findById(barberId);
    if (!barber) return res.status(404).json({ message: "Barber not found" });

    const whatsappLink = `https://wa.me/${barber.phone}?text=Hello%20${encodeURIComponent(barber.name)},%20I'm%20interested%20in%20your%20services.`;
    res.json({ whatsappLink });
  } catch (error) {
    res.status(500).json({ message: "Error generating WhatsApp link", error });
  }
});

module.exports = router;
