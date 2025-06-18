const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  employee_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    default: function() {
      // Auto-generate employee ID with pattern: EMP-YYYYMM-XXXX
      const now = new Date();
      const yearMonth = now.getFullYear().toString() + 
                       (now.getMonth() + 1).toString().padStart(2, '0');
      const random = Math.floor(1000 + Math.random() * 9000);
      return `EMP-${yearMonth}-${random}`;
    }
  },
  full_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  contact_info: {
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[6-9]\d{9}$/.test(v);
        },
        message: props => `${props.value} is not a valid mobile number!`
      }
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: props => `${props.value} is not a valid email!`
      }
    }
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: props => `${props.value} is not a valid pincode!`
      }
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    }
  },
  joining_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'],
    default: 'ACTIVE'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtuals for populated data
EmployeeSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

EmployeeSchema.virtual('roleDetails', {
  ref: 'Role',
  localField: 'role',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name description' }
});

// Indexes
EmployeeSchema.index({ employee_id: 1 });
EmployeeSchema.index({ full_name: 1 });
EmployeeSchema.index({ branch: 1 });
EmployeeSchema.index({ role: 1 });
EmployeeSchema.index({ 'contact_info.email': 1 });
EmployeeSchema.index({ 'contact_info.phone': 1 });
EmployeeSchema.index({ status: 1 });
EmployeeSchema.index({ joining_date: -1 });

// Pre-save validation
EmployeeSchema.pre('save', function(next) {
  if (this.joining_date > new Date()) {
    const err = new Error('Joining date cannot be in the future');
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Employee', EmployeeSchema);