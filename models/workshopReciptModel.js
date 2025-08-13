const mongoose = require('mongoose');

const WorkShopReceiptSchema = new mongoose.Schema({
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
  receiptType: {
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
  bankLocation: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch is required'],
  },
  bill: {
    type: String, // URL/path to uploaded file
    default: '',
  }
}, {
  timestamps: true,
});

// Auto-generate voucherId if not set
WorkShopReceiptSchema.pre('save', async function (next) {
  if (!this.voucherId) {
    const count = await mongoose.model('WorkShopReceiptVoucher').countDocuments() + 1;
    this.voucherId = `WS-${new Date().getFullYear()}-${count.toString().padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('WorkShopReceiptVoucher', WorkShopReceiptSchema);
