  const express = require('express');
 const axios = require('axios');
 const Barber = require('../models/barberModel');
 const Payment = require('../models/paymentModel');
 const router = express.Router();
 
 // ⚠️ Use a live secret key in production
 const PAYSTACK_SECRET_KEY = 'sk_test_35615e95d939d005a75568b752c0a550c762c0ed';
 
 // ===============================================
 // VERIFY PAYMENT AND ACTIVATE BARBER SUBSCRIPTION
 // ===============================================
  // VERIFY PAYMENT AND ACTIVATE BARBER SUBSCRIPTION
 router.post("/verify-payment", async (req, res) => {
   const { reference, barberId } = req.body;
 
   try {
     // ✅ Check for required fields
     if (!barberId || !reference) {
       return res.status(400).json({
         success: false,
         message: "Barber ID and payment reference are required.",
       });
     }
 
     // ✅ 1. Verify payment with Paystack
     const response = await axios.get(
       `https://api.paystack.co/transaction/verify/${reference}`,
       {
         headers: {
           Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
         },
       }
     );
 
     const paystackData = response.data?.data;
     if (!paystackData || paystackData.status !== "success") {
       return res.status(400).json({
         success: false,
         message: "Payment verification failed or not successful.",
       });
     }
 
     // ✅ 2. Find the barber
     const barber = await Barber.findById(barberId);
     if (!barber) {
       return res.status(404).json({
         success: false,
         message: "Barber not found",
       });
     }
 
     // ✅ 3. Update subscription and visibility
     const now = new Date();
     const currentExpiry = new Date(barber.subscriptionExpires || now);
     const baseTime = currentExpiry > now ? currentExpiry : now;
     const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
 
     barber.subscriptionExpires = newExpiry;
     barber.subscriptionActive = true;
     barber.visible = true;
     barber.freeTrialExpires = now; // Expire free trial to prevent conflict
 
     // ✅ 4. Save payment record
     const payment = new Payment({
       barberId: barber._id,
       reference: reference,
       amount: 5000,
       status: "success",
     });
 
     await payment.save();
 
     // ✅ 5. Save updated barber
     await barber.save();
 
     // ✅ 6. Return updated barber data
     return res.json({
       success: true,
       message: "Payment successful, subscription activated",
       barber: {
         ...barber.toObject(),
         id: barber._id,
       },
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
 