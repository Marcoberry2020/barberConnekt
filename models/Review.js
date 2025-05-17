const express = require('express');
const router = express.Router();
const axios = require('axios');
const Barber = require('../models/Barber');

// Utility function to verify payment validity
const isPaymentValid = (paymentData) => {
  const isTestMode = process.env.NODE_ENV !== "production";  // Check if in test mode

  const amountOk = Number(paymentData.charged_amount) >= 5000;
  const currencyOk = paymentData.currency === "NGN";
  const statusOk = paymentData.status === "successful" || paymentData.status === "completed";

  // In test mode, skip the amount check to allow mock data
  if (isTestMode) {
    console.log("🔍 Test mode - skipping amount check.");
    return statusOk && currencyOk; // Only check status and currency in test mode
  }

  // In production, validate amount, currency, and status
  return statusOk && amountOk && currencyOk;
};

// Renew Subscription Route
router.post("/renew-subscription", async (req, res) => {
  try {
    const { barberId, transactionId } = req.body;

    console.log("📥 Received request for subscription renewal:", { barberId, transactionId });

    // Step 1: Verify payment with Flutterwave
    const verifyResponse = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    console.log("🧾 Flutterwave verification response:", verifyResponse.data);

    const paymentData = verifyResponse.data?.data;

    // Step 2: Check if payment is valid
    if (!isPaymentValid(paymentData)) {
      console.warn("❌ Invalid payment detected:", paymentData);
      return res.status(400).json({
        message: "Invalid payment or amount less than ₦5000.",
      });
    }

    // Step 3: Find the barber
    const barber = await Barber.findById(barberId);
    if (!barber) {
      console.error("❌ Barber not found:", barberId);
      return res.status(404).json({ message: "Barber not found" });
    }

    // Prevent duplicate transaction usage
    const isDuplicate = barber.transactionHistory?.some(
      (tx) => tx.transactionId === transactionId
    );

    if (isDuplicate) {
      console.warn("⚠️ Duplicate transaction detected:", transactionId);
      return res.status(400).json({ message: "Transaction has already been processed." });
    }

    // Save transaction ID to history
    barber.transactionHistory = barber.transactionHistory || [];
    barber.transactionHistory.push({ transactionId });

    const now = new Date();
    const trialExpired = new Date(barber.freeTrialExpires) <= now; // Check if free trial has expired
    const currentExpiry = barber.subscriptionActive && barber.subscriptionExpires > now
      ? new Date(barber.subscriptionExpires)
      : now;

    // Step 4: Handle visibility and expiration
    if (trialExpired && !barber.subscriptionActive) {
      // Barber is on free trial and trial expired, mark as hidden
      barber.visible = false;
    }

    // Extend subscription by 1 day (for both trial and paid renewals)
    const newExpiry = new Date(currentExpiry.getTime() + 24 * 60 * 60 * 1000);
    barber.subscriptionExpires = newExpiry;
    barber.subscriptionActive = true;  // Mark as paid and active

    barber.visible = true; // Barber should be visible after renewal

    // Step 5: Call the visibility update logic (ensure this function exists in your model)
    await barber.updateVisibilityStatus();

    // Step 6: Save the updated barber
    await barber.save();

    console.log("✅ Subscription updated successfully:", {
      name: barber.name,
      expires: barber.subscriptionExpires,
      visible: barber.visible,
    });

    return res.json({
      message: "Payment verified. Subscription renewed for 1 day.",
      barber: {
        id: barber.id,
        name: barber.name,
        phone: barber.phone,
        visible: barber.visible,
        subscriptionExpires: barber.subscriptionExpires.toLocaleString(),
      },
    });

  } catch (error) {
    console.error("❌ Error processing subscription renewal:", error.response?.data || error.message || error);
    return res.status(500).json({
      message: "Error processing subscription renewal",
      error: error.message || error,
    });
  }
});

module.exports = router;
