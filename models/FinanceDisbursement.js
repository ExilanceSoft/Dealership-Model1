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
  disbursementAmount: {
    type: Number,
    required: [true, 'Disbursement amount is required'],
    min: [0, 'Disbursement amount must be positive']
  },
  receivedAmount: {
    type: Number,
    required: [true, 'Received amount is required'],
    min: [0, 'Received amount must be positive'],
    validate: {
      validator: function(v) {
        return v <= this.disbursementAmount;
      },
      message: 'Received amount cannot exceed disbursement amount'
    }
  },
  paymentMode: {
    type: String,
    enum: ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'DD', 'Other'],
    default: 'NEFT'
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank'
  },
  transactionReference: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  remark: {
    type: String,
    trim: true
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

// Virtual for remaining amount
financeDisbursementSchema.virtual('remainingAmount').get(function() {
  return this.disbursementAmount - this.receivedAmount;
});

// Indexes
financeDisbursementSchema.index({ booking: 1, status: 1 });
financeDisbursementSchema.index({ financeProvider: 1 });
financeDisbursementSchema.index({ disbursementDate: 1 });
financeDisbursementSchema.index({ disbursementReference: 1 });

financeDisbursementSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('FinanceDisbursement', financeDisbursementSchema);