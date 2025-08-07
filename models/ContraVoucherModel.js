const mongoose = require('mongoose');

const ContraVoucherSchema = new mongoose.Schema({
  receipantName: {
    type: String,
    required: true,
    trim: true,
  },
  contraType: {
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('ContraVoucher', ContraVoucherSchema);
