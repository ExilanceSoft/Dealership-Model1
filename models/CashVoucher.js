const mongoose = require('mongoose');

const CashVoucherSchema = new mongoose.Schema({
  receipantName: {
    type: String,
    required: true,
    trim: true,
  },
  expenseType: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  remark: {
    type: String,
    trim: true,
  },
  cashLocation: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('CashVoucher', CashVoucherSchema);
