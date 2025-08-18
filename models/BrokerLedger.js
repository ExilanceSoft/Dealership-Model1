const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    required: [true, 'Transaction date is required']
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: [true, 'Transaction type (CREDIT/DEBIT) is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  modeOfPayment: {
    type: String,
    enum: ['Cash', 'Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'],
    required: [true, 'Mode of payment is required']
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank'
  },
  cashLocation: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashLocation'
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  remark: {
    type: String,
    trim: true,
    maxlength: [200, 'Remark cannot exceed 200 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user is required']
  }
}, { timestamps: true });

const brokerLedgerSchema = new mongoose.Schema({
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker',
    required: [true, 'Broker reference is required'],
    unique: true
  },
  currentBalance: {
    type: Number,
    default: 0,
    required: true
  },
  transactions: [transactionSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user is required']
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual population
brokerLedgerSchema.virtual('brokerDetails', {
  ref: 'Broker',
  localField: 'broker',
  foreignField: '_id',
  justOne: true
});

// Balance calculation middleware
brokerLedgerSchema.pre('save', function(next) {
  if (this.isModified('transactions')) {
    let balance = 0;
    this.transactions.forEach(txn => {
      if (txn.type === 'CREDIT') balance += txn.amount;
      else balance -= txn.amount;
    });
    this.currentBalance = balance;
    this.lastUpdatedBy = this._update?.$set?.lastUpdatedBy || this.createdBy;
  }
  next();
});

// Indexes
brokerLedgerSchema.index({ broker: 1 });
brokerLedgerSchema.index({ currentBalance: 1 });
brokerLedgerSchema.index({ 'transactions.date': 1 });
brokerLedgerSchema.index({ 'transactions.booking': 1 });

brokerLedgerSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('BrokerLedger', brokerLedgerSchema);