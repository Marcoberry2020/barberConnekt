 const mongoose = require('mongoose');

// Define the schema for payments
const paymentSchema = new mongoose.Schema({
  barberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  // Remove status field from schema if not needed
}, { timestamps: true });

// Check if the model already exists in the Mongoose models cache
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
