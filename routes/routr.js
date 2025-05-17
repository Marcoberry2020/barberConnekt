const express = require("express");
const bcrypt = require("bcryptjs");
const Barber = require("../models/barberModel");

const router = express.Router();
const SALT_ROUNDS = 10;

// Debugging function
const debugLog = (message) => {
  console.log(`[DEBUG]: ${message}`);
};

// Helper function to find a barber by ID
const findBarberById = async (barberId) => {
  const barber = await Barber.findById(barberId);
  if (!barber) throw new Error("Barber not found");
  return barber;
};

// ===============================================
// 2. Signup Endpoint
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
// 3. Login Endpoint
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
// 4. Get Active Barbers (Customer View)
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
// 5. Get Barber Status by ID (Updated for Frontend Compatibility)
 
// ===============================================
// Get Barber Data by ID
// ===============================================
router.get("/:id", async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id);
    
    // Check if barber is found
    if (!barber) {
      console.log(`[DEBUG]: Barber with ID ${req.params.id} not found.`);
      return res.status(404).json({ message: "Barber not found" });
    }

    // Strip sensitive information (e.g., password) from the barber document
    const { password, ...barberDetails } = barber.toObject();

    // Log the barber's details (excluding sensitive data)
    console.log(`[DEBUG]: Returning barber details: ${JSON.stringify(barberDetails)}`);

    // Return the response with the barber's data
    res.json({
      barber: {
        _id: barberDetails._id,
        name: barberDetails.name,
        phone: barberDetails.phone,
        price: barberDetails.price,
        location: barberDetails.location,
        freeTrialExpires: barberDetails.freeTrialExpires,
        subscriptionActive: barberDetails.subscriptionActive,
        subscriptionExpires: barberDetails.subscriptionExpires,
        visible: barberDetails.visible,
      }
    });
  } catch (error) {
    // Log the error details for debugging
    console.error(`[ERROR]: Error fetching barber data for ID ${req.params.id}:`, error);
    
    // Send error response
    res.status(500).json({ message: "Error fetching barber data", error });
  }
});

// ===============================================
// 6. Subscription Payment (₦5000 for 1 Day) - Initial Subscription
// ===============================================
router.post("/subscribe", async (req, res) => {
  try {
    const { barberId, reference } = req.body;
    const barber = await findBarberById(barberId);

    const now = new Date();

    // If the barber is still within the free trial period, do not require payment
    if (barber.freeTrialExpires > now) {
      return res.status(400).json({
        message: "Free trial still active. No payment required yet.",
      });
    }

    // Simulate payment verification here (you would actually verify payment with a payment gateway)
    const paymentVerified = true; // Replace with actual payment verification logic

    if (!paymentVerified) {
      return res.status(400).json({
        message: "Payment not verified. Please confirm your payment.",
      });
    }

    // Proceed with activating the subscription for 1 day
    barber.subscriptionActive = true;
    barber.subscriptionExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
    barber.visible = true; // Make the barber visible immediately
    barber.notifications.push({
      message: "Subscription activated! You're now visible for 1 day.",
    });

    await barber.save();

    res.json({
      message: "Subscription activated! Barber is now visible for 1 day.",
      barber,
    });
  } catch (error) {
    res.status(500).json({ message: "Error processing subscription", error });
  }
});

// ===============================================
// 6. Manual Subscription Payment (₦5000 for 1 Day) - Barber Renewal
// ===============================================
router.post("/renew-subscription", async (req, res) => {
  try {
    const { barberId } = req.body;
    const barber = await findBarberById(barberId);

    const now = new Date();

    // Check if the barber is still within the free trial period
    if (barber.freeTrialExpires > now) {
      return res.status(400).json({
        message: "Free trial still active. No payment required yet.",
      });
    }

    // Simulate the payment verification here (in real life, you would use a payment gateway API)
    const paymentVerified = true; // Replace with actual payment verification logic

    if (!paymentVerified) {
      return res.status(400).json({
        message: "Payment not verified. Please confirm your payment.",
      });
    }

    // Proceed with renewing the subscription for 1 day
    barber.subscriptionActive = true;
    barber.subscriptionExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
    barber.visible = true; // Make the barber visible immediately
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
// 7. Simulate Payment Verification (for Testing)
// ===============================================
router.post("/:id/verify-payment", async (req, res) => {
  try {
    const barber = await findBarberById(req.params.id);
    // Simulate payment verification (you would actually verify payment here)
    barber.paymentVerified = true; // Set this to true once you confirm payment

    await barber.save();

    res.json({
      message: "Payment successfully verified. Barber can now renew visibility.",
    });
  } catch (error) {
    res.status(500).json({ message: "Error verifying payment", error });
  }
});

// ===============================================
// 7. Scheduled Task: Auto-Hide Expired Barbers
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
setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);

// ===============================================
// 8. Review, Service, and Availability Endpoints
// ===============================================

// Add a Review
router.post("/:id/reviews", async (req, res) => {
  try {
    const { rating, comment, userId } = req.body;
    const barber = await findBarberById(req.params.id);
    barber.reviews.push({
      user: userId,
      rating,
      comment,
      date: new Date()
    });
    const totalRatings = barber.reviews.reduce((sum, review) => sum + review.rating, 0);
    barber.averageRating = totalRatings / barber.reviews.length;

    await barber.save();
    res.status(201).json({
      message: "Review added successfully.",
      reviews: barber.reviews,
      averageRating: barber.averageRating,
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding review", error });
  }
});

// Add a Service
router.post("/:id/services", async (req, res) => {
  try {
    const { name, cost, duration } = req.body;
    const barber = await findBarberById(req.params.id);
    barber.services.push({ name, cost, duration });
    await barber.save();
    res.status(201).json({
      message: "Service added successfully.",
      services: barber.services,
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding service", error });
  }
});

// Update Availability
router.put("/:id/availability", async (req, res) => {
  try {
    const { availability } = req.body;
    const barber = await findBarberById(req.params.id);
    barber.availability = availability;
    await barber.save();
    res.status(200).json({
      message: "Availability updated successfully.",
      availability: barber.availability,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating availability", error });
  }
});

// ===============================================
// 9. Rate a Barber
// ===============================================
router.post("/:id/rate", async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }

    const barber = await findBarberById(req.params.id);
    barber.ratings.push(rating);
    const totalRatings = barber.ratings.length;
    const sumRatings = barber.ratings.reduce((sum, r) => sum + r, 0);
    barber.averageRating = sumRatings / totalRatings;

    await barber.save();

    res.json({
      message: "Rating submitted successfully.",
      averageRating: barber.averageRating.toFixed(1),
      totalRatings,
    });
  } catch (error) {
    res.status(500).json({ message: "Error submitting rating", error });
  }
});

// ===============================================
// 10. Update Price with Notification
// ===============================================
router.put("/:id/price", async (req, res) => {
  try {
    const { price } = req.body;

    if (price <= 0) {
      return res.status(400).json({ message: "Price must be greater than zero." });
    }

    const barber = await findBarberById(req.params.id);
    barber.price = price;

    barber.notifications.push({
      message: `Price updated to ₦${price}.`,
    });

    await barber.save();

    res.status(200).json({
      message: `Price updated to ₦${price}.`,
      barber,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating price", error });
  }
});

module.exports = router;
