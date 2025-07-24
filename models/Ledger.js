const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cashLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashLocation',
    required: function() {
      return this.paymentMode === 'Cash';
    }
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: function() {
      return ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(this.paymentMode);
    }
  },
  transactionReference: {
    type: String,
    trim: true,
    required: function() {
      return ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(this.paymentMode);
    }
  },
  remark: {
    type: String,
    trim: true
  },
  receiptDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ledgerSchema.index({ booking: 1 });
ledgerSchema.index({ paymentMode: 1 });
ledgerSchema.index({ receiptDate: 1 });

// Virtuals
ledgerSchema.virtual('bankDetails', {
  ref: 'Bank',
  localField: 'bank',
  foreignField: '_id',
  justOne: true
});

ledgerSchema.virtual('cashLocationDetails', {
  ref: 'CashLocation',
  localField: 'cashLocation',
  foreignField: '_id',
  justOne: true
});

ledgerSchema.virtual('receivedByDetails', {
  ref: 'User',
  localField: 'receivedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

module.exports = mongoose.model('Ledger', ledgerSchema);