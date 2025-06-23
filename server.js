  // Load environment variables 
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();  // Loading environment variables
const morgan = require("morgan");

// Import Routes
const barberRoutes = require("./routes/barberRoutes");
const customerRoutes = require("./routes/customerRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const callRoutes = require("./routes/callRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Import Models
const Barber = require("./models/barberModel");
const Payment = require("./models/paymentModel");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" })); // Allow all origins (can be restricted for security)
app.use(morgan("dev"));

// MongoDB Connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}
connectDB();

// API Routes
app.use("/api/barbers", barberRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Hardcoded Paystack Secret Key and Frontend URL
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Payment Route for Initiating Payment (using Paystack)
app.post("/api/paystack/initiate-payment", async (req, res) => {
  const { barberId } = req.body;

  try {
    console.log("Paystack Key:", PAYSTACK_SECRET_KEY);

    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    const tx_ref = `SUB_${Date.now()}_${barberId}`;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: barber.email,
        amount: 5000 * 100,
        currency: "NGN",
        callback_url: `${FRONTEND_URL}/payment-success`,
        reference: tx_ref,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status) {
      return res.json({
        paymentUrl: response.data.data.authorization_url,
        tx_ref: tx_ref,
      });
    } else {
      return res.status(400).json({ message: "Failed to create payment link" });
    }
  } catch (error) {
    console.error("Payment initiation error:", error);
    return res.status(500).json({
      message: "Failed to initiate payment",
      error: error.message,
    });
  }
});

// ✅ UPDATED Payment Verification Route
 app.post("/api/paystack/verify-payment", async (req, res) => {
  const { reference, barberId } = req.body;

  if (!barberId || !reference) {
    return res.status(400).json({ message: "Barber ID and payment reference are required." });
  }

  try {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    // Verify with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.data.status !== "success") {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Set expiration: if current is in the future, extend it; else, start from now
    const now = new Date();
    const currentExpiry = barber.subscriptionExpires && barber.subscriptionExpires > now
      ? new Date(barber.subscriptionExpires)
      : now;
    const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000); // add 30 days


    // Update barber
    barber.subscriptionExpires = newExpiry;
    barber.subscriptionActive = true;
    barber.freeTrialExpires = now; // End trial now
    barber.visible = true;

    await barber.save();

    // Save payment record if needed
    const payment = new Payment({
      barberId: barber._id,
      reference,
      amount: 5000,
    });
    await payment.save();

    return res.json({
      message: "Payment successful, subscription activated",
      barber,
    });

  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      message: "Failed to verify payment",
      error: error.message,
    });
  }
});

// Barber Status Route (Option 2 - standalone route for frontend convenience)
app.get("/api/barber-status/:barberId", async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.barberId);
    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    const now = new Date();
    const subValid = barber.subscriptionExpiresAt && new Date(barber.subscriptionExpiresAt) > now;
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
      subscriptionExpiresAt: barber.subscriptionExpiresAt,
      freeTrialExpires: barber.freeTrialExpires,
    });
  } catch (err) {
    console.error("Error fetching barber status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Subscription Management Function
const updateSubscriptionStatus = async () => {
  try {
    const barbers = await Barber.find();
    barbers.forEach(async (barber) => {
      if (barber.subscriptionStatus === "Active Paid") {
        const now = new Date();
        if (new Date(barber.subscriptionExpiresAt) <= now) {
          barber.subscriptionStatus = "Hidden";
          barber.visible = false;
          await barber.save();
          console.log(`Barber ${barber._id} subscription expired and visibility set to hidden.`);
        }
      }
    });
  } catch (err) {
    console.error("Error updating subscription status:", err);
  }
};

// Run subscription update every 24 hours
setInterval(updateSubscriptionStatus, 24 * 60 * 60 * 1000);

// Default Route
app.get("/", (req, res) => {
  res.send("🚀 BarberConnect API is running...");
});

// Catch all undefined routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
