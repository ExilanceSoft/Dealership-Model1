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
    min: [0, 'Amount must be greater than 0'],
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
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch is required'],
  }
}, {
  timestamps: true,
});

// Auto-generate voucherId if not set
WorkShopReciptSchema.pre('save', async function (next) {
  if (!this.voucherId) {
    // Example: WS-2025-00001
    const count = await mongoose.model('WorkShopReciptVoucher').countDocuments() + 1;
    this.voucherId = `WS-${new Date().getFullYear()}-${count.toString().padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('WorkShopReciptVoucher', WorkShopReciptSchema);
