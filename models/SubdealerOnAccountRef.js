const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const AllocationSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Allocation amount must be >= 0'],
    },
    ledger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
    },
    remark: { type: String, trim: true },
    allocatedAt: { type: Date, default: Date.now },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const SubdealerOnAccountRefSchema = new mongoose.Schema(
  {
    subdealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subdealer',
      required: [true, 'Subdealer is required'],
      index: true,
    },
    refNumber: {
      type: String,
      required: [true, 'UTR/REF number is required'],
      trim: true,
    },
    paymentMode: {
      type: String,
      enum: [
        'Cash',
        'Bank',
        'UPI',
        'NEFT',
        'RTGS',
        'Cheque',
        'Pay Order',
        'Other',
        'On-Account'
      ],
      default: 'Bank',
    },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' }, // optional for non-bank modes
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be >= 0'],
    },
    receivedDate: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remark: { type: String, trim: true },

    // Running state
    status: {
      type: String,
      enum: ['OPEN', 'PARTIAL', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    allocations: [AllocationSchema],
    allocatedTotal: {
      type: Number,
      default: 0,
      min: [0, 'Allocated total must be >= 0'],
    },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound unique: same subdealer cannot reuse same UTR/REF
SubdealerOnAccountRefSchema.index({ subdealer: 1, refNumber: 1 }, { unique: true });

// Virtual balance
SubdealerOnAccountRefSchema.virtual('balance').get(function () {
  const base = this.amount || 0;
  const used = this.allocatedTotal || 0;
  return Math.max(0, base - used);
});

// Pre-save to keep status aligned
SubdealerOnAccountRefSchema.pre('save', function (next) {
  const base = this.amount || 0;
  const used = this.allocatedTotal || 0;
  
  if (used <= 0) {
    this.status = 'OPEN';
  } else if (used < base) {
    this.status = 'PARTIAL';
  } else {
    this.status = 'CLOSED';
    if (!this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

SubdealerOnAccountRefSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SubdealerOnAccountRef', SubdealerOnAccountRefSchema);