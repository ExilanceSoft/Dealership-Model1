// models/FinanceDisbursement.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const financeDisbursementSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking is required'],
    index: true
  },
  financeProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceProvider',
    required: [true, 'Finance provider is required']
  },
  disbursementReference: {
    type: String,
    required: [true, 'Disbursement reference is required'],
    trim: true,
    unique: true
  },
  disbursementDate: {
    type: Date,
    required: [true, 'Disbursement date is required'],
    default: Date.now
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  paymentMode: {
    type: String,
    enum: ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'DD', 'Other', 'Finance Disbursement'],
    default: 'Finance Disbursement'
  },
  transactionReference: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ledgerEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
financeDisbursementSchema.index({ booking: 1, status: 1 });
financeDisbursementSchema.index({ financeProvider: 1 });
financeDisbursementSchema.index({ disbursementDate: 1 });
financeDisbursementSchema.index({ disbursementReference: 1 });

financeDisbursementSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('FinanceDisbursement', financeDisbursementSchema);