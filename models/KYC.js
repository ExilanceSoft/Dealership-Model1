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
    type: String,
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
    type: String,
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
    required: false
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
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
KYCSchema.index({ booking: 1 });
KYCSchema.index({ status: 1 });
KYCSchema.index({ submittedBy: 1 });
KYCSchema.index({ verifiedBy: 1 });

// Virtual for submission date (using createdAt)
KYCSchema.virtual('submissionDate').get(function() {
  return this.createdAt;
});

module.exports = mongoose.model('KYC', KYCSchema);