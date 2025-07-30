const mongoose = require('mongoose');

const InsuranceReciptSchema = new mongoose.Schema({
  C_Name: {
    type: String,
    required: true,
    trim: true,
  },
  Chasis_No: {
    type: String,
    required: true,
    trim: true,
  },
  Insurance_Date: {
    type: Date,
    required: true,
  },
  PolicyNo: {
    type: String,
    required: true,
    trim: true,
  },
  PSAPollicyNo: {
    type: String,
    trim: true,
    default: '',
  },
  CMSpolicyNo: {
    type: String,
    trim: true,
    default: '',
  },
  PremiumAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  validUpto: {
    type: Date,
    required: true,
  },
  Model: {
    type: String,
    trim: true,
  },
  vehicleRegNo: {
    type: String,
    required: true,
    trim: true,
  },
  InsuranceCompany: {
    type: String,
    required: true,
    trim: true,
  },
  MobileNO: {
    type: String,
    required: true,
    match: /^[6-9]\d{9}$/, 
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'],
    required: true
  },
  Status: {
    type: String,
    enum: ['Active', 'Expired', 'Pending'],
    default: 'Active',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('InsuranceRecipt', InsuranceReciptSchema);
