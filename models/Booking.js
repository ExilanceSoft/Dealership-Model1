const mongoose = require('mongoose');

const exchangeVehicleSchema = new mongoose.Schema({
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker'
  },
  price: {
    type: Number,
    min: 0
  },
  vehicleNumber: String,
  chassisNumber: String
}, { _id: false });

const paymentDetailSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CASH', 'FINANCE'],
    required: true
  },
  financer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceProvider'
  },
  scheme: String,
  emiPlan: String,
  gcApplicable: Boolean,
  gcAmount: Number
}, { _id: false });

const accessorySchema = new mongoose.Schema({
  accessory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accessory',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const priceComponentSchema = new mongoose.Schema({
  header: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Header',
    required: true
  },
  originalValue: {
    type: Number,
    required: true,
    min: 0
  },
  discountedValue: {
    type: Number,
    required: true,
    min: 0
  },
  isDiscountable: {
    type: Boolean,
    default: false
  },
  isMandatory: {
    type: Boolean,
    default: false
  },
  metadata: {
    pageNo: Number,
    hsnCode: String,
    gstRate: Number
  }
}, { _id: false });

const discountSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['FIXED', 'PERCENTAGE'],
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approvalNote: String
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  color: {
    type: String,
    required: true
  },
  customerType: {
    type: String,
    enum: ['B2B', 'B2C'],
    required: true
  },
  gstin: {
    type: String,
    validate: {
      validator: function(v) {
        if (this.customerType === 'B2B') {
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        }
        return true;
      },
      message: 'Invalid GSTIN format'
    }
  },
  rto: {
    type: String,
    enum: ['MH', 'BH', 'CRTM'],
    required: true
  },
  hpa: {
    type: Boolean,
    default: false
  },
  hypothecationCharges: {
    type: Number,
    min: 0
  },
  customerDetails: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    panNo: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: 'Invalid PAN number format'
      }
    },
    dob: Date,
    occupation: String,
    address: String,
    taluka: String,
    district: String,
    pincode: {
      type: String,
      validate: {
        validator: function(v) {
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: 'Invalid pincode'
      }
    },
    mobile1: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Invalid mobile number'
      }
    },
    mobile2: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Invalid mobile number'
      }
    },
    aadharNumber: {
      type: String,
      validate: {
        validator: function(v) {
          return /^[0-9]{12}$/.test(v);
        },
        message: 'Invalid Aadhar number'
      }
    },
    nomineeName: String,
    nomineeRelation: String,
    nomineeAge: Number
  },
  exchange: {
    type: Boolean,
    default: false
  },
  exchangeDetails: exchangeVehicleSchema,
  payment: paymentDetailSchema,
  accessories: [accessorySchema],
  priceComponents: [priceComponentSchema],
  discounts: [discountSchema],
  accessoriesTotal: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate booking number before saving
bookingSchema.pre('save', async function(next) {
  if (!this.bookingNumber) {
    const count = await this.constructor.countDocuments();
    this.bookingNumber = `BK${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Indexes
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ model: 1 });
bookingSchema.index({ color: 1 });
bookingSchema.index({ rto: 1 });
bookingSchema.index({ branch: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdBy: 1 });
bookingSchema.index({ 'customerDetails.mobile1': 1 });

// Virtuals
bookingSchema.virtual('modelDetails', {
  ref: 'Model',
  localField: 'model',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('approvedByDetails', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Booking', bookingSchema);