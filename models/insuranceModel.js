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
  paymentMode: {
    type: String,
    enum: ['CASH', 'BANK', 'CARD'],
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
  status: {
    type: String,
    enum: ['COMPLETED'], // Removed 'PENDING' and 'REJECTED'
    default: 'COMPLETED' // Directly set to COMPLETED when created
  },
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'PARTIAL', 'PAID'],
    default: 'UNPAID'
  },
  paymentCompletedDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date,
    default: Date.now // Set approval date automatically
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

// Indexes
InsuranceSchema.index({ booking: 1 });
InsuranceSchema.index({ policyNumber: 1 }, { unique: true });
InsuranceSchema.index({ insuranceDate: -1 });
InsuranceSchema.index({ validUptoDate: -1 });
InsuranceSchema.index({ createdBy: 1 });
InsuranceSchema.index({ insuranceProvider: 1 });

// Virtual population
InsuranceSchema.virtual('bookingDetails', {
  ref: 'Booking',
  localField: 'booking',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'bookingNumber customerDetails chassisNumber model color branch insuranceStatus'
  }
});

InsuranceSchema.virtual('insuranceProviderDetails', {
  ref: 'InsuranceProvider',
  localField: 'insuranceProvider',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'provider_name is_active'
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
    // Automatically set approvedBy to createdBy if not set
    if (this.isNew && !this.approvedBy) {
      this.approvedBy = this.createdBy;
    }

    // Update booking insurance status to COMPLETED
    const booking = await mongoose.model('Booking').findById(this.booking);
    if (booking && booking.insuranceStatus !== 'COMPLETED') {
      booking.insuranceStatus = 'COMPLETED';
      await booking.save();
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

// Static method to get insurance by booking ID
InsuranceSchema.statics.findByBookingId = function(bookingId) {
  return this.findOne({ booking: bookingId })
    .populate('bookingDetails')
    .populate('insuranceProviderDetails')
    .populate('approvedByDetails');
};

// Static method to get all insurances
InsuranceSchema.statics.findAllInsurances = function() {
  return this.find()
    .populate('bookingDetails')
    .populate('insuranceProviderDetails')
    .populate('createdByDetails')
    .populate('approvedByDetails');
};

const Insurance = mongoose.model('Insurance', InsuranceSchema);

module.exports = Insurance;