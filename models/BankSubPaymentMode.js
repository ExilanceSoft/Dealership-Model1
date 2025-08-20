const mongoose = require('mongoose');

const BankSubPaymentModeSchema = new mongoose.Schema({
  payment_mode: {
    type: String,
    required: [true, 'payment mode is required'],
    unique: true,
    trim: true,
  },
  payment_description: {
    type: String,
    required: [true, 'RTO name is required'],
    trim: true,
    maxlength: [100, 'RTO name cannot be more than 100 characters']
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

// Index for better performance
BankSubPaymentModeSchema.index({ rto_code: 1 }, { unique: true });

module.exports = mongoose.model('bankSubPaymentModeSchema', BankSubPaymentModeSchema);