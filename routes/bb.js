  const express = require("express");
 const bcrypt = require("bcryptjs");
 const Barber = require("../models/barberModel");
 
 const router = express.Router();
 const SALT_ROUNDS = 10;
 
 const multer = require("multer");
 const fs = require("fs");
 const path = require("path");
 const Barber = require("../models/barberModel");
 
 // Create upload folder if it doesn't exist
 const uploadDir = path.join(__dirname, "../uploads");
 if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
 
 // Multer config
 const storage = multer.diskStorage({
   destination: function (req, file, cb) {
     cb(null, uploadDir);
   },
   filename: function (req, file, cb) {
     const ext = path.extname(file.originalname);
     cb(null, `${Date.now()}-${file.fieldname}${ext}`);
   },
 });
 const upload = multer({ storage });
 
 // Upload pictures (max 3)
 router.post("/barbers/:id/pictures", upload.array("pictures", 3), async (req, res) => {
   try {
     const barber = await Barber.findById(req.params.id);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     if (barber.pictures.length + req.files.length > 3) {
       return res.status(400).json({ message: "Maximum of 3 pictures allowed." });
     }
 
     const newPaths = req.files.map(file => `uploads/${file.filename}`);
     barber.pictures.push(...newPaths);
     await barber.save();
 
     res.json({ message: "Pictures uploaded", pictures: barber.pictures });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: "Upload failed" });
   }
 });
 
 router.delete("/barbers/:id/pictures/:filename", async (req, res) => {
   try {
     const barber = await Barber.findById(req.params.id);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     const picturePath = `uploads/${req.params.filename}`;
     barber.pictures = barber.pictures.filter(p => p !== picturePath);
     await barber.save();
 
     const fullPath = path.join(__dirname, "../", picturePath);
     if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
 
     res.json({ message: "Picture deleted", pictures: barber.pictures });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: "Delete failed" });
   }
 });
 
 
 // Helper function to update barber's visibility and subscription status
 const updateVisibilityStatus = (barber) => {
   const now = new Date();
   const subscriptionActive = barber.subscriptionExpires && new Date(barber.subscriptionExpires) > now;
   const trialActive = barber.freeTrialExpires && new Date(barber.freeTrialExpires) > now;
 
   barber.subscriptionActive = subscriptionActive;
   barber.visible = subscriptionActive || trialActive;
 };
 
 // ========================
 // 1. Signup Endpoint
 // ========================
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
       freeTrialExpires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks free trial
 
       visible: false,
       ratings: [],
       averageRating: 0,
       notifications: [],
     });
 
     updateVisibilityStatus(newBarber);
 
     await newBarber.save();
 
     res.status(201).json({
       message: "Signup successful! 2-week free trial started.",
       barber: newBarber,
     });
   } catch (error) {
     res.status(500).json({ message: "Error registering barber", error });
   }
 });
 
 // ========================
 // 2. Login Endpoint
 // ========================
 router.post('/login', async (req, res) => {
   const { phone, password } = req.body;
 
   try {
     const barber = await Barber.findOne({ phone });
     if (!barber) return res.status(404).json({ message: 'Barber not found' });
 
     const isPasswordValid = await bcrypt.compare(password, barber.password);
     if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });
 
     updateVisibilityStatus(barber);
     await barber.save();
 
     const status = barber.subscriptionActive
       ? 'Active Paid'
       : (barber.freeTrialExpires && new Date(barber.freeTrialExpires) > new Date())
         ? 'Free Trial'
         : 'Hidden';
 
     res.status(200).json({
       message: 'Login successful',
       status,
       barber,
     });
   } catch (error) {
     console.error('Login error:', error);
     res.status(500).json({ message: 'Internal server error' });
   }
 });
 
 // ========================
 // 3. Active Barbers (Customer View)
 // ========================
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
 
 // ========================
 // 4. Get Barber Status
 // ========================
 router.get("/barber-status/:barberId", async (req, res) => {
   try {
     const barber = await Barber.findById(req.params.barberId);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     const now = new Date();
     const subValid = barber.subscriptionExpires && new Date(barber.subscriptionExpires) > now;
     const trialValid = barber.freeTrialExpires && new Date(barber.freeTrialExpires) > now;
 
     const status = subValid
       ? "Active (Paid)"
       : trialValid
         ? "On Free Trial"
         : "Hidden";
 
     res.json({
       success: true,
       status,
       visible: barber.visible,
       subscriptionExpires: barber.subscriptionExpires,
       freeTrialExpires: barber.freeTrialExpires,
     });
   } catch (err) {
     console.error("Error fetching barber status:", err);
     res.status(500).json({ message: "Server error" });
   }
 });
 
 // ========================
 // 5. Scheduled Task to Auto-Hide Expired Barbers
 // ========================
 const checkExpiredSubscriptions = async () => {
   const now = new Date();
 
   await Barber.updateMany(
     { subscriptionActive: true, subscriptionExpires: { $lte: now } },
     { $set: { subscriptionActive: false, visible: false } }
   );
 
   await Barber.updateMany(
     { subscriptionActive: false, freeTrialExpires: { $lte: now } },
     { $set: { visible: false } }
   );
 };
 
 // Run every hour
 setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);
 
 // ========================
 // 6. Update Barber Price
 // ========================
 router.put("/:id/price", async (req, res) => {
   const { id } = req.params;
   const { price } = req.body;
 
   try {
     const barber = await Barber.findById(id);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     barber.price = price;
     await barber.save();
 
     res.json({ message: "Price updated successfully", barber });
   } catch (error) {
     console.error("Error updating price:", error);
     res.status(500).json({ message: "Server error" });
   }
 });
 
 // ========================
 // 7. Rate a Barber
 // ========================
 router.post("/:id/rate", async (req, res) => {
   try {
     const { id } = req.params;
     const { customerId, rating } = req.body;
 
     const barber = await Barber.findById(id);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     barber.ratings.push({ customerId, rating });
     barber.averageRating =
       barber.ratings.reduce((sum, r) => sum + r.rating, 0) / barber.ratings.length;
 
     await barber.save();
 
     res.json({ message: "Rating submitted successfully", averageRating: barber.averageRating });
   } catch (error) {
     console.error("Error rating barber:", error);
     res.status(500).json({ message: "Error rating barber", error });
   }
 });
 
 // ========================
 // 8. Get Barber By ID
 // ========================
 router.get("/:id", async (req, res) => {
   try {
     const barber = await Barber.findById(req.params.id);
     if (!barber) return res.status(404).json({ message: "Barber not found" });
 
     updateVisibilityStatus(barber);
     await barber.save();
 
     res.json(barber);
   } catch (error) {
     res.status(500).json({ message: "Error fetching barber", error });
   }
 });
 
 module.exports = router;
     