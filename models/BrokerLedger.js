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
    enum: ['Cash', 'Bank', 'Finance Disbursement', 'Exchange', 'Pay Order','Commission']
  },
  subPaymentMode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankSubPaymentMode',
    required: function() {
      return this.modeOfPayment === 'Bank';
    }
  },
  referenceNumber: {
    type: String,
    trim: true
  },
   autoAllocationStatus: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'COMPLETED'],
    default: 'PENDING'
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
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  remark: {
    type: String,
    trim: true,
    maxlength: [200, 'Remark cannot exceed 200 characters']
  },
  isOnAccount: {
    type: Boolean,
    default: false
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
    date: {
      type: Date,
      default: Date.now
    },
    // Add allocation type to track auto vs manual
    allocationType: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
      default: 'MANUAL'
    }
  }],
  adjustedAgainst: [{
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    amount: {
      type: Number,
      min: 0
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user is required']
  },
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: function() {
      return this.modeOfPayment === 'Cash' ? 'Approved' : 'Pending';
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
}, { timestamps: true });

const brokerLedgerSchema = new mongoose.Schema({
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker',
    required: [true, 'Broker reference is required']
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  currentBalance: {
    type: Number,
    default: 0,
    required: true
  },
  onAccount: {
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

// Compound index for broker+branch uniqueness
brokerLedgerSchema.index({ broker: 1, branch: 1 }, { unique: true });

// In BrokerLedger.js, update the virtual property to include pending transactions
// In BrokerLedger.js - update the virtual property
brokerLedgerSchema.virtual('onAccountBalance').get(function() {
  // Sum of approved on-account CREDIT transactions
  const approvedOnAccountCredits = this.transactions.filter(tx => 
    tx.type === 'CREDIT' && 
    tx.isOnAccount && 
    tx.approvalStatus === 'Approved'
  );
  
  const totalOnAccount = approvedOnAccountCredits.reduce((sum, tx) => sum + tx.amount, 0);
  
  // Sum of all allocations from on-account credits
  const totalAllocated = approvedOnAccountCredits.reduce((sum, tx) => {
    const txAllocations = tx.allocations?.reduce((allocSum, alloc) => 
      allocSum + (alloc.amount || 0), 0) || 0;
    return sum + txAllocations;
  }, 0);
  
  return Math.max(0, totalOnAccount - totalAllocated);
});

// Virtual population
brokerLedgerSchema.virtual('brokerDetails', {
  ref: 'Broker',
  localField: 'broker',
  foreignField: '_id',
  justOne: true
});

brokerLedgerSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true
});

// Balance calculation middleware
brokerLedgerSchema.pre('save', function(next) {
  if (this.isModified('transactions')) {
    let balance = 0;
    this.transactions.forEach(txn => {
      // Only consider approved transactions for balance calculation
      if (txn.approvalStatus === 'Approved') {
        if (txn.type === 'CREDIT') balance += txn.amount;
        else balance -= txn.amount;
      }
    });
    this.currentBalance = balance;
    this.lastUpdatedBy = this._update?.$set?.lastUpdatedBy || this.createdBy;
  }
  next();
});

// Indexes
brokerLedgerSchema.index({ broker: 1 });
brokerLedgerSchema.index({ branch: 1 });
brokerLedgerSchema.index({ currentBalance: 1 });
brokerLedgerSchema.index({ 'transactions.date': 1 });
brokerLedgerSchema.index({ 'transactions.booking': 1 });

brokerLedgerSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('BrokerLedger', brokerLedgerSchema);