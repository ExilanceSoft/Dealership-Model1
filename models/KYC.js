// models/KYC.js
const mongoose = require('mongoose');

const KYCSchema = new mongoose.Schema({
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
  address: {
    type: String,
    required: true
  },
  aadharFront: {
    type: String, // Path to the uploaded file
    required: true
  },
  aadharBack: {
    type: String,
    required: true
  },
  panCard: {
    type: String,
    required: true
  },
  vPhoto: {
    type: String, // Vehicle photo
    required: true
  },
  chasisNoPhoto: {
    type: String,
    required: true
  },
  addressProof1: {
    type: String,
    required: true
  },
  addressProof2: {
    type: String,
    required: false // Optional
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
KYCSchema.index({ booking: 1 });
KYCSchema.index({ status: 1 });

module.exports = mongoose.model('KYC', KYCSchema);