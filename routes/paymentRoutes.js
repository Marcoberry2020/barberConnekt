 const express = require('express');
const axios = require('axios');
const Barber = require('../models/barberModel');
const Payment = require('../models/paymentModel');
const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

router.post("/verify-payment", async (req, res) => {
  const { reference, barberId } = req.body;

  if (!barberId || !reference) {
    return res.status(400).json({
      success: false,
      message: "Barber ID and payment reference are required.",
    });
  }

  try {
    console.log('🔍 Verifying payment for reference:', reference);

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const paystackData = response.data?.data;

    console.log('🔍 Paystack verification data:', paystackData);

    if (!paystackData || paystackData.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed or not successful.",
      });
    }

    // Find the barber
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found",
      });
    }

    console.log('🔍 Barber before update:', {
      subscriptionExpires: barber.subscriptionExpires,
      subscriptionActive: barber.subscriptionActive,
      freeTrialExpires: barber.freeTrialExpires,
      visible: barber.visible,
    });

    // Calculate new subscription expiry date
    const now = new Date();
    const currentExpiry = (barber.subscriptionExpires && barber.subscriptionExpires > now)
      ? new Date(barber.subscriptionExpires)
      : now;


    const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000); // add 30 days

    // Update subscription info
    barber.subscriptionExpires = newExpiry;
    barber.subscriptionActive = true;      // explicitly set active subscription
    barber.freeTrialExpires = now;         // end free trial immediately on payment
    barber.visible = true;                 // barber should be visible after payment

    console.log('🔧 Barber before save:', {
      subscriptionExpires: barber.subscriptionExpires,
      subscriptionActive: barber.subscriptionActive,
      freeTrialExpires: barber.freeTrialExpires,
      visible: barber.visible,
    });

    await barber.save();

    // Double check saved data by reloading barber
    const updatedBarber = await Barber.findById(barberId);
    console.log('✅ Barber after save:', {
      subscriptionExpires: updatedBarber.subscriptionExpires,
      subscriptionActive: updatedBarber.subscriptionActive,
      freeTrialExpires: updatedBarber.freeTrialExpires,
      visible: updatedBarber.visible,
    });

    // Save payment record
    const payment = new Payment({
      barberId: barber._id,
      reference,
      amount: 5000,
      status: "success",
    });
    await payment.save();

    return res.json({
      success: true,
      message: "Payment successful, subscription activated",
      barber: updatedBarber.toObject(),
    });

  } catch (error) {
    console.error("❌ Error verifying payment:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message,
    });
  }
});

module.exports = router;
