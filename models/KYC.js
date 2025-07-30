const mongoose = require('mongoose');
const DocumentSchema = new mongoose.Schema({
  original: {
    type: String,
    required: true
  },
  pdf: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  originalname: {
    type: String,
    required: true
  }
}, { _id: false });

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
    type: DocumentSchema,
    required: true
  },
  aadharBack: {
    type: DocumentSchema,
    required: true
  },
  panCard: {
    type: DocumentSchema,
    required: true
  },
  vPhoto: {
    type: DocumentSchema,
    required: true
  },
  chasisNoPhoto: {
    type: DocumentSchema,
    required: true
  },
  addressProof1: {
    type: DocumentSchema,
    required: true
  },
  addressProof2: {
    type: DocumentSchema,
    required: false
  },
  documentPdf: {
    type: String,
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