const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  modeOfPayment: {
    type: String,
    enum: ['Cash', 'Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'],
    required: [true, 'Mode of payment is required']
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: function() {
      return this.modeOfPayment === 'Bank';
    }
  },
  cashLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashLocation',
    required: function() {
      return this.modeOfPayment === 'Cash';
    }
  },
  remark: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const brokerLedgerSchema = new mongoose.Schema({
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker',
    required: [true, 'Broker reference is required'],
    unique: true
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },
  balanceAmount: {
    type: Number,
    default: 0,
    min: [0, 'Balance amount cannot be negative']
  },
  payments: [paymentSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for broker details
brokerLedgerSchema.virtual('brokerDetails', {
  ref: 'Broker',
  localField: 'broker',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name mobile email brokerId' }
});

// Virtual for createdBy details
brokerLedgerSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Update balance when a payment is added
brokerLedgerSchema.pre('save', function(next) {
  if (this.isModified('payments')) {
    this.balanceAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }
  next();
});

const BrokerLedger = mongoose.model('BrokerLedger', brokerLedgerSchema);

module.exports = BrokerLedger;