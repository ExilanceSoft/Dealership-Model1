// models/FinanceLetter.js
const mongoose = require('mongoose');

const FinanceLetterSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true
  },
  financeLetter: {
    type: String, // Path to the uploaded file
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationNote: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
FinanceLetterSchema.index({ booking: 1 });
FinanceLetterSchema.index({ status: 1 });

module.exports = mongoose.model('FinanceLetter', FinanceLetterSchema);