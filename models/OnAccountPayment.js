// models/OnAccountPayment.js
const mongoose = require('mongoose');

const onAccountPaymentSchema = new mongoose.Schema({
  subdealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subdealer',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  utrReference: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_USED', 'FULLY_USED', 'CANCELLED'],
    default: 'PENDING'
  },
  remainingAmount: {
    type: Number,
    default: function() {
      return this.amount;
    }
  },
  allocations: [{
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    amount: {
      type: Number,
      min: 0
    },
    allocatedAt: {
      type: Date,
      default: Date.now
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank'
  },
  remark: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
onAccountPaymentSchema.index({ subdealer: 1 });
onAccountPaymentSchema.index({ utrReference: 1 });
onAccountPaymentSchema.index({ status: 1 });
onAccountPaymentSchema.index({ receivedDate: -1 });

// Virtuals
onAccountPaymentSchema.virtual('subdealerDetails', {
  ref: 'Subdealer',
  localField: 'subdealer',
  foreignField: '_id',
  justOne: true
});

onAccountPaymentSchema.virtual('receivedByDetails', {
  ref: 'User',
  localField: 'receivedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

onAccountPaymentSchema.virtual('bankDetails', {
  ref: 'Bank',
  localField: 'bank',
  foreignField: '_id',
  justOne: true
});

const OnAccountPayment = mongoose.model('OnAccountPayment', onAccountPaymentSchema);
module.exports = OnAccountPayment;