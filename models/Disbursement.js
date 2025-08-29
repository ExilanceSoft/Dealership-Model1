const mongoose = require('mongoose');

const disbursementSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required']
  },
  disbursementAmount: {
    type: Number,
    required: [true, 'Disbursement amount is required'],
    min: [0, 'Disbursement amount cannot be negative']
  },
  disbursementDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user is required']
  },
  deviationApplied: {
    type: Boolean,
    default: false
  },
  deviationAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  managerApproval: {
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    notes: String
  }
}, {
  timestamps: true
});

// Index for better query performance
disbursementSchema.index({ booking: 1 });
disbursementSchema.index({ disbursementDate: 1 });
disbursementSchema.index({ createdBy: 1 });
disbursementSchema.index({ status: 1 });

// Virtual for formatted disbursement date
disbursementSchema.virtual('formattedDate').get(function() {
  return this.disbursementDate.toISOString().split('T')[0];
});

// Virtual for booking details
disbursementSchema.virtual('bookingDetails', {
  ref: 'Booking',
  localField: 'booking',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'bookingNumber customerDetails.name model totalAmount discountedAmount payment' 
  }
});

// Virtual for createdBy details
disbursementSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile totalDeviationAmount perTransactionDeviationLimit currentDeviationUsage' }
});

// Transform output
disbursementSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

disbursementSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Pre-save hook to update deviation info
disbursementSchema.pre('save', function(next) {
  if (this.isModified('deviationApplied') && this.deviationApplied) {
    this.deviationAmount = this.disbursementAmount;
  }
  next();
});

module.exports = mongoose.model('Disbursement', disbursementSchema);