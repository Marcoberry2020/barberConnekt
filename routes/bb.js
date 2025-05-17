  const express = require("express");
 const bcrypt = require("bcryptjs");
 const Barber = require("../models/barberModel");
 const Payment = require("../models/paymentModel");
 const axios = require('axios');
 const router = express.Router();
 const SALT_ROUNDS = 10;
 
 const PAYSTACK_SECRET_KEY = 'sk_test_35615e95d939d005a75568b752c0a550c762c0ed'; // Replace with live key for production
 
 // Helper function to find a barber by ID
 const findBarberById = async (barberId) => {
   const barber = await Barber.findById(barberId);
   if (!barber) throw new Error("Barber not found");
   return barber;
 };
 
 // Debugging function
 const debugLog = (message) => {
   console.log(`[DEBUG]: ${message}`);
 };
 
 // ===============================================
 // 1. Signup Endpoint
 // ===============================================
 router.post("/signup", async (req, res) => {
   try {
     const { name, phone, price, location, password } = req.body;
 
     if (!password) {
       return res.status(400).json({ message: "Password is required." });
     }
 
     const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
 
     const newBarber = new Barber({
       name,
       phone,
       price,
       location,
       password: hashedPassword,
       subscriptionActive: false,
       subscriptionExpires: null,
       freeTrialExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
       visible: false,
       ratings: [],
       averageRating: 0,
       notifications: [],
     });
 
     await newBarber.save();
     res.status(201).json({
       message: "Signup successful! 1-day free trial started.",
       barber: newBarber,
     });
   } catch (error) {
     res.status(500).json({ message: "Error registering barber", error });
   }
 });
 
 // ===============================================
 // 2. Login Endpoint
 // ===============================================
 router.post("/login", async (req, res) => {
   try {
     const { phone, password } = req.body;
     if (!phone || !password) {
       return res.status(400).json({ message: "Phone and password are required." });
     }
 
     const barber = await Barber.findOne({ phone });
     if (!barber) {
       return res.status(404).json({ message: "Barber not found." });
     }
 
     const isMatch = await bcrypt.compare(password, barber.password);
     if (!isMatch) {
       return res.status(401).json({ message: "Invalid password." });
     }
 
     res.json({
       message: "Login successful.",
       barber,
     });
   } catch (error) {
     res.status(500).json({ message: "Error logging in", error });
   }
 });
 
 // ===============================================
 // 3. Verify Payment and Activate Subscription
 // ===============================================
 router.post("/verify-payment", async (req, res) => {
   const { reference, barberId } = req.body;
 
   try {
     const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
       headers: {
         Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
       },
     });
 
     const paystackData = response.data?.data;
     if (paystackData?.status !== "success") {
       return res.status(400).json({ success: false, message: "Payment verification failed" });
     }
 
     const barber = await Barber.findById(barberId);
     if (!barber) {
       return res.status(404).json({ success: false, message: "Barber not found" });
     }
 
     const now = new Date();
     const latestExpiry = new Date(barber.subscriptionExpires || now);
     const baseTime = latestExpiry > now ? latestExpiry : now;
 
     barber.subscriptionExpires = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);
     barber.subscriptionActive = true;
     barber.freeTrialExpires = now;
     barber.visible = true;
 
     await Payment.create({
       barberId,
       reference,
       amount: 5000,
       status: "success",
     });
 
     console.log("[DEBUG] Barber data before save:", barber);
     await barber.save();
 
     const updatedBarber = {
       ...barber.toObject(),
       id: barber._id,
     };
 
     console.log("[DEBUG] Updated barber data:", updatedBarber);
 
     return res.json({
       success: true,
       message: "Payment successful, subscription activated",
       barber: updatedBarber,
     });
   } catch (error) {
     console.error("Error verifying payment:", error.response?.data || error.message);
     return res.status(500).json({
       success: false,
       message: "Error verifying payment",
       error: error.message,
     });
   }
 });
 
 // ===============================================
 // 4. Active Barbers (Customer View)
 // ===============================================
 router.get("/active-barbers", async (req, res) => {
   try {
     const now = new Date();
     const activeBarbers = await Barber.find({
       $or: [
         { freeTrialExpires: { $gt: now } },
         { subscriptionActive: true, subscriptionExpires: { $gt: now } },
       ],
     });
 
     res.json(activeBarbers);
   } catch (error) {
     res.status(500).json({ message: "Error fetching barbers", error });
   }
 });
 
 // ===============================================
 // 5. Manual Subscription Renewal (₦5000 for 1 Day)
 // ===============================================
 router.post("/renew-subscription", async (req, res) => {
   try {
     const { barberId } = req.body;
     const barber = await findBarberById(barberId);
 
     const now = new Date();
 
     if (barber.freeTrialExpires > now) {
       return res.status(400).json({
         message: "Free trial still active. No payment required yet.",
       });
     }
 
     const paymentVerified = true; // Replace with real logic if needed
 
     if (!paymentVerified) {
       return res.status(400).json({
         message: "Payment not verified. Please confirm your payment.",
       });
     }
 
     barber.subscriptionActive = true;
     barber.subscriptionExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
     barber.visible = true;
     barber.notifications.push({
       message: "Subscription renewed! You're now visible for 1 more day.",
     });
 
     await barber.save();
 
     res.json({
       message: "Subscription renewed! Barber is now visible for 1 more day.",
       barber,
     });
   } catch (error) {
     res.status(500).json({ message: "Error renewing subscription", error });
   }
 });
 
 // ===============================================
 // 6. Scheduled Task: Auto-Hide Expired Barbers
 // ===============================================
 const checkExpiredSubscriptions = async () => {
   const now = new Date();
   await Barber.updateMany(
     {
       subscriptionActive: true,
       subscriptionExpires: { $lte: now },
     },
     { $set: { subscriptionActive: false, visible: false } }
   );
   await Barber.updateMany(
     {
       subscriptionActive: false,
       freeTrialExpires: { $lte: now },
     },
     { $set: { visible: false } }
   );
 };
 
 setInterval(checkExpiredSubscriptions, 60 * 60 * 1000); // Run every hour
 // Update barber price
 router.put("/:id/price", async (req, res) => {
   const { id } = req.params;
   const { price } = req.body;
 
   try {
     const barber = await Barber.findById(id);
     if (!barber) {
       return res.status(404).json({ message: "Barber not found" });
     }
 
     barber.price = price;
     await barber.save();
 
     res.json({ message: "Price updated successfully", barber });
   } catch (error) {
     console.error("Error updating price:", error);
     res.status(500).json({ message: "Server error" });
   }
 });
 
 // ===============================================
 // 7. Rate a Barber
 // ===============================================
 router.post("/:id/rate", async (req, res) => {
   try {
     const { id } = req.params;
     const { customerId, rating } = req.body;
 
     const barber = await Barber.findById(id);
     if (!barber) {
       return res.status(404).json({ message: "Barber not found" });
     }
 
     // Check if this customer already rated this barber
     const existingRating = barber.ratings.find(r => r.customerId.toString() === customerId);
     if (existingRating) {
       return res.status(400).json({ message: "You have already rated this barber." });
     }
 
     // Save the rating
     barber.ratings.push({ customerId, rating });
 
     // Recalculate average rating
     const total = barber.ratings.reduce((sum, r) => sum + r.rating, 0);
     barber.averageRating = total / barber.ratings.length;
 
     await barber.save();
 
     res.json({ message: "Rating submitted successfully", averageRating: barber.averageRating });
   } catch (error) {
     console.error("Error rating barber:", error);
     res.status(500).json({ message: "Error rating barber", error });
   }
 });
 
 // ===============================================
 // 8. GET /:id - Must be LAST to avoid conflicts
 // ===============================================
 router.get("/:id", async (req, res) => {
   try {
     const barber = await Barber.findById(req.params.id);
     if (!barber) {
       return res.status(404).json({ message: "Barber not found" });
     }
     res.json(barber);
   } catch (error) {
     res.status(500).json({ message: "Error fetching barber", error });
   }
 });
 
 module.exports = router;
 