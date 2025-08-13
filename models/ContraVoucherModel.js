const mongoose = require('mongoose');

const ContraVoucherSchema = new mongoose.Schema({
  voucherId: {
    type: String,
    unique: true,
    trim: true,
    // ❌ No `required: true` here — will be auto-generated
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
    required: [true, 'Branch is required']
  }
}, {
  timestamps: true,
});

// Auto-generate voucherId before saving
ContraVoucherSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  try {
    const year = new Date().getFullYear();

    // Get the last voucher of this year
    const lastVoucher = await this.constructor.findOne({
      voucherId: new RegExp(`^CONTRA-${year}-\\d{4}$`)
    }).sort({ createdAt: -1 });

    let nextNumber = 1;
    if (lastVoucher) {
      const lastNumber = parseInt(lastVoucher.voucherId.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }

    this.voucherId = `CONV-${year}-${String(nextNumber).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('ContraVoucher', ContraVoucherSchema);
