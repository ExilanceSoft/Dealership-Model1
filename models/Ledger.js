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
    enum: ['BOOKING_PAYMENT', 'INSURANCE_PAYMENT', 'DEBIT_ENTRY', 'Finance Disbursement'],
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
    required: function() {
      return !this.isDebit; 
    }
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
      // Don't require cashLocation for on-account payments or when bypass flag is set
      if (this.source?.kind === 'SUBDEALER_ON_ACCOUNT') {
        return false;
      }
      return this.paymentMode === 'Cash' && this.type !== 'DEBIT_ENTRY';
    }
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: function() {
      return ['Bank', 'Exchange', 'Pay Order'].includes(this.paymentMode) && 
             this.type !== 'DEBIT_ENTRY';
    }
  },
  subPaymentMode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankSubPaymentMode',
    required: function() {
      return this.paymentMode === 'Bank' && this.type !== 'DEBIT_ENTRY';
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
  },
  source: {
    kind: String,
    refId: mongoose.Schema.Types.ObjectId,
    refModel: String,
    refReceipt: mongoose.Schema.Types.ObjectId
  },
   approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: function() {
      // Auto-approve cash payments, require approval for others
      return this.paymentMode === 'Cash' ? 'Approved' : 'Pending';
    }
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
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

ledgerSchema.virtual('subPaymentModeDetails', {
  ref: 'BankSubPaymentMode', // Make sure this matches the model name
  localField: 'subPaymentMode',
  foreignField: '_id',
  justOne: true
});

const Ledger = mongoose.model('Ledger', ledgerSchema);

module.exports = Ledger;