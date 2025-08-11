const mongoose = require('mongoose');

const WorkShopReciptSchema = new mongoose.Schema({
  voucherId: {
    type: String,
    unique: true,
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  voucherType: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  recipientName: { 
    type: String,
    required: true,
    trim: true,
  },
  reciptType: {
     type: String,
    enum: ['Workshop', 'Other'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMode: {
    type: String,
    enum: ['cash'], 
    default: 'cash',
    required: true,
  },
  remark: {
    type: String,
    default: '',
    trim: true,
  },
  bankName: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  bankLocation: {
    type: String,
    required: true,
    trim: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('WorkShopReciptVoucher', WorkShopReciptSchema);
