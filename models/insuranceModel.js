const mongoose = require('mongoose');

const InsuranceSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    validate: {
      validator: async function (v) {
        const booking = await mongoose.model('Booking').findById(v);
        return !!booking; 
      },
      message: 'Booking must exist'
    }
  },
  insuranceProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  insuranceDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function (v) {
        return v <= new Date();
      },
      message: 'Insurance date cannot be in the future'
    }
  },
  policyNumber: {
    type: String,
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
  documents: {
  type: [{
    url: {
      type: String,
    },
    name: {
      type: String,
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
  }],},
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'LATER'],
    default: 'PENDING'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
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
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Indexes
InsuranceSchema.index({ booking: 1 }, { unique: true });
InsuranceSchema.index({ policyNumber: 1 }, { sparse: true, unique: true });
InsuranceSchema.index({ insuranceDate: -1 });
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

// Middleware to sync insurance status with booking
InsuranceSchema.pre('save', async function (next) {
  try {
    if (this.isNew && !this.approvedBy && this.status === 'COMPLETED') {
      this.approvedBy = this.createdBy;
      this.approvalDate = new Date();
    }

    const booking = await mongoose.model('Booking').findById(this.booking);
    if (booking) {
      // Sync booking.insuranceStatus based on insurance.status
      booking.insuranceStatus = this.status;
      await booking.save();
    }

    this.updatedBy = this.updatedBy || this.createdBy;
    next();
  } catch (err) {
    next(err);
  }
});

// Static methods
InsuranceSchema.statics.findByBookingId = function (bookingId) {
  return this.findOne({ booking: bookingId })
    .populate('bookingDetails')
    .populate('insuranceProviderDetails')
    .populate('approvedBy');
};

InsuranceSchema.statics.findAllInsurances = function () {
  return this.find()
    .populate('bookingDetails')
    .populate('insuranceProviderDetails')
    .populate('createdBy')
    .populate('approvedBy');
};

module.exports = mongoose.model('Insurance', InsuranceSchema);
