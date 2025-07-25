// models/Insurance.js
const mongoose = require('mongoose');

const InsuranceSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    validate: {
      validator: async function(v) {
        const booking = await mongoose.model('Booking').findById(v);
        return booking && booking.status === 'APPROVED';
      },
      message: 'Booking must exist and be in APPROVED status'
    }
  },
  insuranceProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  insuranceDate: {
    type: Date,
    required: true,
    default: Date.now,
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Insurance date cannot be in the future'
    }
  },
  policyNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 5,
    maxlength: 20
  },
  rsaPolicyNumber: {
    type: String,
    trim: true,
    uppercase: true,
    minlength: 5,
    maxlength: 20
  },
  cmsPolicyNumber: {
    type: String,
    trim: true,
    uppercase: true,
    minlength: 5,
    maxlength: 20
  },
  premiumAmount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v > 0;
      },
      message: 'Premium amount must be greater than 0'
    }
  },
  validUptoDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.insuranceDate;
      },
      message: 'Valid upto date must be after insurance date'
    }
  },
  documents: [{
    url: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['POLICY', 'RECEIPT', 'FORM', 'OTHER'],
      default: 'POLICY'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  paymentMode: {
    type: String,
    enum: ['CASH', 'ONLINE', 'CHEQUE', 'OTHER'],
    required: true
  },
  paymentDetails: {
    referenceNumber: String,
    bankName: String,
    chequeNumber: String,
    transactionDate: Date
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
InsuranceSchema.index({ booking: 1 });
InsuranceSchema.index({ insuranceProvider: 1 });
InsuranceSchema.index({ policyNumber: 1 }, { unique: true });
InsuranceSchema.index({ status: 1 });
InsuranceSchema.index({ insuranceDate: -1 });
InsuranceSchema.index({ validUptoDate: -1 });
InsuranceSchema.index({ createdBy: 1 });

// Virtual population
InsuranceSchema.virtual('bookingDetails', {
  ref: 'Booking',
  localField: 'booking',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'bookingNumber model color customerDetails.name customerDetails.mobile1 status insuranceStatus'
  }
});

InsuranceSchema.virtual('providerDetails', {
  ref: 'InsuranceProvider',
  localField: 'insuranceProvider',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'name contactPerson contactNumber email'
  }
});

InsuranceSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'name email mobile'
  }
});

InsuranceSchema.virtual('approvedByDetails', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'name email mobile'
  }
});

InsuranceSchema.virtual('updatedByDetails', {
  ref: 'User',
  localField: 'updatedBy',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'name email mobile'
  }
});

// Middleware to sync insurance status with booking
InsuranceSchema.pre('save', async function(next) {
  try {
    // Only proceed if status is modified
    if (this.isModified('status')) {
      const booking = await mongoose.model('Booking').findById(this.booking);
      
      if (booking) {
        let bookingInsuranceStatus;
        
        // Map insurance status to booking insuranceStatus
        switch(this.status) {
          case 'PENDING':
            bookingInsuranceStatus = 'PENDING';
            break;
          case 'APPROVED':
            bookingInsuranceStatus = 'COMPLETED';
            break;
          case 'REJECTED':
            bookingInsuranceStatus = 'REJECTED';
            break;
          default:
            bookingInsuranceStatus = 'AWAITING';
        }
        
        // Only update if different to prevent infinite loops
        if (booking.insuranceStatus !== bookingInsuranceStatus) {
          booking.insuranceStatus = bookingInsuranceStatus;
          await booking.save();
        }
      }
    }
    
    // Set updatedBy if not set
    if (this.isModified() && !this.updatedBy) {
      this.updatedBy = this._conditions?.updatedBy || this.createdBy;
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// Middleware to validate insurance provider is active
InsuranceSchema.pre('save', async function(next) {
  if (this.isModified('insuranceProvider')) {
    const provider = await mongoose.model('InsuranceProvider').findById(this.insuranceProvider);
    if (!provider || provider.status !== 'ACTIVE') {
      throw new Error('Selected insurance provider is not active');
    }
  }
  next();
});

// Static method to get insurance by booking ID
InsuranceSchema.statics.findByBookingId = function(bookingId) {
  return this.findOne({ booking: bookingId })
    .populate('providerDetails')
    .populate('approvedByDetails');
};

// Static method to get all insurances by status
InsuranceSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('bookingDetails')
    .populate('providerDetails');
};

const Insurance = mongoose.model('Insurance', InsuranceSchema);

module.exports = Insurance;