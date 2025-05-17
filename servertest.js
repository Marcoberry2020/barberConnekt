 // Load environment variables 
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();  // Loading environment variables

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

  try {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    console.log("Paystack Verification Response:", response.data);

    if (response.data.data.status === "success") {
      barber.subscriptionStatus = "Active Paid";
      barber.subscriptionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      barber.visible = true;

      await barber.save();

      const payment = new Payment({
        barberId: barber._id,
        reference: reference,
        amount: 5000,
      });
      await payment.save();

      return res.json({
        message: "Payment successful, subscription activated",
        barber,
      });
    } else {
      return res.status(400).json({
        message: "Payment verification failed",
        error: response.data,
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      message: "Failed to verify payment",
      error: error.message,
    });
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

const morgan = require("morgan");
app.use(morgan("dev"));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
