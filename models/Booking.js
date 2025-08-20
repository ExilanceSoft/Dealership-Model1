const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

const exchangeVehicleSchema = new mongoose.Schema({
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker',
    required: function() {
      return this.parent().exchange === true;
    }
  },
  price: {
    type: Number,
    min: 0,
    required: function() {
      return this.parent().exchange === true;
    }
  },
  vehicleNumber: {
    type: String,
    trim: true,
    required: function() {
      return this.parent().exchange === true;
    }
  },
  chassisNumber: {
    type: String,
    trim: true,
    required: function() {
      return this.parent().exchange === true;
    }
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  otp: String,
  otpExpiresAt: Date,
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED'],
    default: 'PENDING'
  },
  completedAt: Date
}, { _id: false });

const paymentDetailSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CASH', 'FINANCE'],
    required: true
  },
  financer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceProvider',
    required: function() { return this.type === 'FINANCE'; }
  },
  scheme: {
    type: String,
    trim: true,
    required: function() { return this.type === 'FINANCE'; }
  },
  emiPlan: {
    type: String,
    trim: true,
    required: function() { return this.type === 'FINANCE'; }
  },
  gcApplicable: {
    type: Boolean,
    default: false
  },
  gcAmount: {
    type: Number,
    min: 0,
    required: function() { return this.gcApplicable === true; }
  }
}, { _id: false });

const accessorySchema = new mongoose.Schema({
  accessory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accessory'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    min: 0,
    default: 0
  },
  isAdjustment: {
    type: Boolean,
    default: false
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
    min: 0,
    validate: {
      validator: function(v) {
        return v <= this.originalValue;
      },
      message: 'Discounted value cannot be greater than original value'
    }
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
  approvalNote: {
    type: String,
    trim: true
  },
  appliedOn: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const claimDetailsSchema = new mongoose.Schema({
  hasClaim: {
    type: Boolean,
    required: true
  },
  priceClaim: {
    type: Number,
    min: 0,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  documents: [{
    path: String,
    originalName: String,
    size: Number,
    mimetype: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true,
    index: true
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: [true, 'Model is required']
  },
  bookingType: {
    type: String,
    enum: ['BRANCH', 'SUBDEALER'],
    required: true
  },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    required: [true, 'Color is required']
  },
  chassisNumber: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[A-Z0-9]{17}$/.test(v);
      },
      message: 'Chassis number must be 17 alphanumeric characters',
    },
  },
  chassisNumberHistory: [{
    number: String,
    changedAt: Date,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    statusAtChange: String
  }],
  chassisNumberChangeAllowed: {
    type: Boolean,
    default: true
  },
  batteryNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  keyNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  motorNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  chargerNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  engineNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  vehicleRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  customerType: {
    type: String,
    enum: ['B2B', 'B2C', 'CSD'],
    required: [true, 'Customer type is required']
  },
  isCSD: {
    type: Boolean,
    default: false,
    required: true
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
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
    required: [true, 'RTO is required']
  },
  rtoStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  rtoAmount: {
    type: Number,
    min: 0,
    required: function() {
      return this.rto === 'BH' || this.rto === 'CRTM';
    }
  },
  hpa: {
    type: Boolean,
    default: false
  },
  hypothecationCharges: {
    type: Number,
    min: 0,
    default: 0
  },
  kycStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NOT_SUBMITTED'
  },
  financeLetterStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NOT_SUBMITTED'
  },
  customerDetails: {
    salutation: {
      type: String,
      enum: ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'],
      required: [true, 'Salutation is required']
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    panNo: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: 'Invalid PAN number format'
      }
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    occupation: {
      type: String,
      trim: true,
      required: [true, 'Occupation is required']
    },
    address: {
      type: String,
      trim: true,
      required: [true, 'Address is required']
    },
    taluka: {
      type: String,
      trim: true,
      required: [true, 'Taluka is required']
    },
    district: {
      type: String,
      trim: true,
      required: [true, 'District is required']
    },
    pincode: {
      type: String,
      validate: {
        validator: function(v) {
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: 'Invalid pincode'
      },
      required: [true, 'Pincode is required']
    },
    mobile1: {
      type: String,
      required: [true, 'Primary mobile number is required'],
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
          if (!v) return true;
          return /^[0-9]{12}$/.test(v);
        },
        message: 'Invalid Aadhar number'
      }
    },
    nomineeName: {
      type: String,
      trim: true
    },
    nomineeRelation: {
      type: String,
      trim: true
    },
    nomineeAge: {
      type: Number,
      min: 0
    }
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
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },
  discountedAmount: {
    type: Number,
    required: [true, 'Discounted amount is required'],
    min: 0,
    validate: {
      validator: function(v) {
        return v <= this.totalAmount;
      },
      message: 'Discounted amount cannot be greater than total amount'
    }
  },
  receivedAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  balanceAmount: {
    type: Number,
    min: 0,
    default: function() {
      return this.discountedAmount - (this.receivedAmount || 0);
    }
  },
  claimDetails: claimDetailsSchema,
  receipts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receipt'
  }],
  ledgerEntries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  }],
  status: {
    type: String,
    enum: ['PENDING_APPROVAL', 'ALLOCATED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'KYC_PENDING', 'KYC_VERIFIED', 'PENDING_APPROVAL (Discount_Exceeded)'],
    default: 'PENDING_APPROVAL'
  },
  insuranceStatus: {
    type: String,
    enum: ['AWAITING', 'COMPLETED', 'LATER'],
    default: 'AWAITING'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: function() {
      return !this.subdealer; 
    }
  },
  subdealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subdealer',
    required: function() {
      return !this.branch; 
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user is required']
  },
  salesExecutive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.bookingType === 'BRANCH';
    },
    validate: {
      validator: async function(v) {
        try {
          if (!v) return true;
          const User = mongoose.model('User');
          const user = await User.findById(v).populate('roles');
          return user && user.status === 'ACTIVE' && user.roles.some(r => r.name === 'SALES_EXECUTIVE');
        } catch (err) {
          console.error('Error validating salesExecutive:', err);
          return false;
        }
      },
      message: 'Selected user must be an active SALES_EXECUTIVE'
    }
  },
  subdealerUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.bookingType === 'SUBDEALER';
    },
    validate: {
      validator: async function(v) {
        try {
          if (!v) return false;
          const User = mongoose.model('User');
          const user = await User.findById(v).populate('roles');
          return user && 
                 user.status === 'ACTIVE' && 
                 user.roles.some(r => r.name === 'SUBDEALER') && 
                 user.subdealer?.toString() === this.subdealer?.toString();
        } catch (err) {
          console.error('Error validating subdealerUser:', err);
          return false;
        }
      },
      message: 'Selected user must be an active SUBDEALER for this subdealer'
    }
  },
  formPath: {
    type: String,
    default: ''
  },
  formGenerated: {
    type: Boolean,
    default: false
  },
  qrCode: {
    type: String,
    default: ''
  },
  pendingUpdates: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  updateRequestStatus: {
    type: String,
    enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NONE'
  },
  updateRequestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updateApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updateRequestNote: {
    type: String,
    default: ''
  },
  updateRequestSubmitted: {
    type: Boolean,
    default: false
  },
   approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvalNote: {
    type: String,
    trim: true
  },
}, {
 timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      
      // Transform based on booking type
      if (ret.bookingType === 'SUBDEALER') {
        ret.subdealerUser = ret.subdealerUserDetails;
        delete ret.salesExecutive;
        delete ret.salesExecutiveDetails;
      } else {
        ret.salesExecutive = ret.salesExecutiveDetails;
        delete ret.subdealerUser;
        delete ret.subdealerUserDetails;
      }
      
      // Add vehicle details if available
      const vehicle = doc.vehicle || {};
      ret.batteryNumber = doc.batteryNumber || vehicle.batteryNumber || null;
      ret.keyNumber = doc.keyNumber || vehicle.keyNumber || null;
      ret.motorNumber = doc.motorNumber || vehicle.motorNumber || null;
      ret.chargerNumber = doc.chargerNumber || vehicle.chargerNumber || null;
      ret.engineNumber = doc.engineNumber || vehicle.engineNumber || null;
      
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      
      // Transform based on booking type
      if (ret.bookingType === 'SUBDEALER') {
        ret.subdealerUser = ret.subdealerUserDetails;
        delete ret.salesExecutive;
        delete ret.salesExecutiveDetails;
      } else {
        ret.salesExecutive = ret.salesExecutiveDetails;
        delete ret.subdealerUser;
        delete ret.subdealerUserDetails;
      }
      
      // Add vehicle details if available
      const vehicle = doc.vehicle || {};
      ret.batteryNumber = doc.batteryNumber || vehicle.batteryNumber || null;
      ret.keyNumber = doc.keyNumber || vehicle.keyNumber || null;
      ret.motorNumber = doc.motorNumber || vehicle.motorNumber || null;
      ret.chargerNumber = doc.chargerNumber || vehicle.chargerNumber || null;
      ret.engineNumber = doc.engineNumber || vehicle.engineNumber || null;
      
      return ret;
    }
  }
});

// Virtual populate fields
bookingSchema.virtual('subdealerDetails', {
  ref: 'Subdealer',
  localField: 'subdealer',
  foreignField: '_id',
  justOne: true
});

bookingSchema.virtual('subdealerUserDetails', {
  ref: 'User',
  localField: 'subdealerUser',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile roles' }
});

bookingSchema.virtual('salesExecutiveDetails', {
  ref: 'User',
  localField: 'salesExecutive',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile roles' }
});
bookingSchema.virtual('approvedByDetails', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile' }
});
bookingSchema.virtual('salesExecutiveDetails', {
  ref: 'User',
  localField: 'salesExecutive',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile roles' }
});

bookingSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'vehicleRef',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'batteryNumber keyNumber motorNumber chargerNumber engineNumber chassisNumber qrCode'
  }
});

bookingSchema.virtual('colorDetails', {
  ref: 'Color',
  localField: 'color',
  foreignField: '_id',
  justOne: true
});

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
  justOne: true,
  options: { select: 'name email mobile' }
});

bookingSchema.virtual('approvedByDetails', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile' }
});
bookingSchema.virtual('financeDisbursements', {
  ref: 'FinanceDisbursement',
  localField: '_id',
  foreignField: 'booking',
  options: { 
    sort: { disbursementDate: -1 },
    select: 'disbursementReference disbursementAmount receivedAmount status disbursementDate financeProvider'
  }
});

bookingSchema.virtual('totalFinanceDisbursed').get(function() {
  if (!this.financeDisbursements) return 0;
  return this.financeDisbursements.reduce((sum, d) => {
    if (d.status !== 'CANCELLED') {
      return sum + (d.receivedAmount || 0);
    }
    return sum;
  }, 0);
});
bookingSchema.virtual('fullCustomerName').get(function() {
  return `${this.customerDetails.salutation} ${this.customerDetails.name}`.trim();
});

// Pre-save hooks
bookingSchema.pre('save', async function(next) {
  // Generate booking number if not set
  if (!this.bookingNumber) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'bookingNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.bookingNumber = `BK${counter.seq.toString().padStart(6, '0')}`;
  }

  // Set RTO amount if not provided for BH/CRTM
  if ((this.rto === 'BH' || this.rto === 'CRTM') && !this.rtoAmount) {
    const model = await mongoose.model('Model').findById(this.model);
    if (model) {
      const rtoHeader = await mongoose.model('Header').findOne({
        header_key: 'RTO CHARGES'
      });
      
      if (rtoHeader) {
        const rtoPrice = model.prices.find(
          p => p.header_id.equals(rtoHeader._id) && 
               p.branch_id.equals(this.branch)
        );
        
        if (rtoPrice) {
          this.rtoAmount = rtoPrice.value;
        }
      }
    }
  }
  
  // Calculate balance amount if receivedAmount or discountedAmount changes
  if (this.isModified('receivedAmount') || this.isModified('discountedAmount')) {
    this.balanceAmount = this.discountedAmount - this.receivedAmount;
  }
  
  next();
});

// Indexes
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ model: 1 });
bookingSchema.index({ color: 1 });
bookingSchema.index({ chassisNumber: 1 });
bookingSchema.index({ rto: 1 });
bookingSchema.index({ branch: 1 });
bookingSchema.index({ subdealer: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdBy: 1 });
bookingSchema.index({ salesExecutive: 1 });
bookingSchema.index({ subdealerUser: 1 });
bookingSchema.index({ 'customerDetails.mobile1': 1 });
bookingSchema.index({ createdAt: 1 });
bookingSchema.index({ updatedAt: 1 });

bookingSchema.plugin(mongoosePaginate);

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;