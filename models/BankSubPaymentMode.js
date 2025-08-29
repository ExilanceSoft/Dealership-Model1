const mongoose = require('mongoose');

const BankSubPaymentModeSchema = new mongoose.Schema({
  payment_mode: {
    type: String,
    required: [true, 'payment mode is required'],
    unique: true,
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Remove the incorrect index or replace with correct one
// BankSubPaymentModeSchema.index({ rto_code: 1 }, { unique: true }); // ❌ Remove this

// Add correct index if needed (optional)
BankSubPaymentModeSchema.index({ payment_mode: 1 }); // ✅ Correct index

module.exports = mongoose.model('BankSubPaymentMode', BankSubPaymentModeSchema);