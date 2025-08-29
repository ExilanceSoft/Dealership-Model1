// models/CommissionPayment.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const bookingCommissionSchema = new mongoose.Schema({
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  booking_number: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  booking_date: {
    type: Date,
    required: true
  },
  customer_name: {
    type: String,
    required: true
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },
  total_commission: {
    type: Number,
    required: true,
    min: 0
  },
  commission_breakdown: [{
    header_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Header'
    },
    header_key: {
      type: String,
      required: true
    },
    base: {
      type: Number,
      required: true,
      min: 0
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    commission: {
      type: Number,
      required: true,
      min: 0
    },
    applicable_from: Date,
    applicable_to: Date
  }]
}, { _id: false });

const commissionPaymentSchema = new mongoose.Schema({
  subdealer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subdealer',
    required: [true, 'Subdealer ID is required'],
    index: true
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12,
    index: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    index: true
  },
  total_commission: {
    type: Number,
    required: [true, 'Total commission is required'],
    min: 0
  },
  payment_method: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['ON_ACCOUNT', 'BANK_TRANSFER', 'UPI', 'CHEQUE'],
    index: true
  },
  transaction_reference: {
    type: String,
    trim: true,
    required: function() {
      return this.payment_method !== 'ON_ACCOUNT';
    },
    validate: {
      validator: function(v) {
        if (this.payment_method === 'ON_ACCOUNT') return true;
        return v && v.trim().length > 0;
      },
      message: 'Transaction reference is required for non-ON_ACCOUNT payments'
    }
  },
  on_account_receipt_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubdealerOnAccountRef',
    required: function() {
      return this.payment_method === 'ON_ACCOUNT';
    }
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  remarks: {
    type: String,
    trim: true
  },
  booking_commissions: [bookingCommissionSchema],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to ensure no duplicate payments for same subdealer, month, and year
commissionPaymentSchema.index(
  { subdealer_id: 1, month: 1, year: 1 }, 
  { unique: true, 
    partialFilterExpression: { 
      status: { $in: ['PENDING', 'PROCESSED'] } 
    } 
  }
);

// Virtual for subdealer details
commissionPaymentSchema.virtual('subdealer_details', {
  ref: 'Subdealer',
  localField: 'subdealer_id',
  foreignField: '_id',
  justOne: true
});

// Virtual for created by user details
commissionPaymentSchema.virtual('created_by_details', {
  ref: 'User',
  localField: 'created_by',
  foreignField: '_id',
  justOne: true
});

// Virtual for on-account receipt details
commissionPaymentSchema.virtual('on_account_receipt_details', {
  ref: 'SubdealerOnAccountRef',
  localField: 'on_account_receipt_id',
  foreignField: '_id',
  justOne: true
});
// Pre-save validation
commissionPaymentSchema.pre('save', function(next) {
  // Validate payment method specific requirements
  if (this.payment_method !== 'ON_ACCOUNT' && !this.transaction_reference) {
    return next(new Error('Transaction reference is required for non-ON_ACCOUNT payments'));
  }
  
  if (this.payment_method === 'ON_ACCOUNT' && !this.on_account_receipt_id) {
    return next(new Error('On-account receipt ID is required for ON_ACCOUNT payments'));
  }
  
  next();
});

commissionPaymentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('CommissionPayment', commissionPaymentSchema);