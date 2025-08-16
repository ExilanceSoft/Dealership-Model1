const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ledgerSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  type: {
    type: String,
    enum: ['BOOKING_PAYMENT', 'INSURANCE_PAYMENT', 'DEBIT_ENTRY'],
    default: 'BOOKING_PAYMENT'
  },
  paymentMode: {
    type: String,
    enum: [
      'Cash', 
      'Bank', 
      'Finance Disbursement', 
      'Exchange', 
      'Pay Order',
      'Late Payment',
      'Penalty',
      'Cheque Bounce',
      'Insurance Endorsement',
      'Other Debit'
    ],
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
      return this.paymentMode === 'Cash' && this.type !== 'DEBIT_ENTRY';
    }
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: function() {
      return ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(this.paymentMode) && 
             this.type !== 'DEBIT_ENTRY';
    }
  },
  transactionReference: {
    type: String,
    trim: true
  },
  debitReason: {
    type: String,
    required: function() {
      return this.isDebit;
    }
  },
  remark: {
    type: String,
    trim: true
  },
  isDebit: {
    type: Boolean,
    default: false
  },
  debitStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
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

// Apply pagination plugin
ledgerSchema.plugin(mongoosePaginate);

// Indexes
ledgerSchema.index({ booking: 1 });
ledgerSchema.index({ isDebit: 1 });
ledgerSchema.index({ debitStatus: 1 });
ledgerSchema.index({ receiptDate: -1 });

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

ledgerSchema.virtual('bookingDetails', {
  ref: 'Booking',
  localField: 'booking',
  foreignField: '_id',
  justOne: true,
  options: { select: 'bookingNumber customerDetails.name modelDetails.name' }
});

const Ledger = mongoose.model('Ledger', ledgerSchema);

module.exports = Ledger;