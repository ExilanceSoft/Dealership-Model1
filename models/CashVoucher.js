const mongoose = require('mongoose');

const CashVoucherSchema = new mongoose.Schema(
  {
    voucherId: {
      type: String,
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          return typeof v === 'string' && v.trim().length > 0;
        },
        message: 'Voucher ID could not be generated.',
      },
    },
    date: {
      type: Date,
      default: Date.now,
    },
    voucherType: {
      type: String,
      enum: ['credit', 'debit'],
      required: [true, 'Voucher type is required'],
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be a positive value'],
    },
    paymentMode: {
      type: String,
      enum: ['cash'],
      default: 'cash',
    },
    remark: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    cashLocation: {
      type: String,
      required: [true, 'Cash location is required'],
      trim: true,
    },
    expenseType: {
      type: String,
      required: [true, 'Expense type is required'],
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    billUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate voucherId before saving
CashVoucherSchema.pre('save', async function (next) {
  if (!this.isNew || this.voucherId) return next();

  try {
    const year = new Date().getFullYear();
    const lastVoucher = await this.constructor
      .findOne({ voucherId: new RegExp(`^CV-${year}-\\d{4}$`) })
      .sort({ createdAt: -1 });

    let nextNumber = 1;
    if (lastVoucher) {
      const lastNumber = parseInt(lastVoucher.voucherId.split('-')[2], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.voucherId = `CV-${year}-${String(nextNumber).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('CashVoucher', CashVoucherSchema);
