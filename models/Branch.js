const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Branch name is required'],
    trim: true,
    maxlength: [100, 'Branch name cannot exceed 100 characters']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [50, 'City name cannot exceed 50 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [50, 'State name cannot exceed 50 characters']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[1-9][0-9]{5}$/.test(v);
      },
      message: props => `${props.value} is not a valid pincode!`
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid mobile number!`
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  gst_number: {
    type: String,
    required: [true, 'GST number is required'],
    unique: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: props => `${props.value} is not a valid GST number!`
    }
  },
  is_active: {
    type: Boolean,
    default: true
  },
  logo1: {
    type: String,
    default: ''
  },
  logo2: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true, 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
BranchSchema.index({ name: 1 });
BranchSchema.index({ city: 1 });
BranchSchema.index({ state: 1 });
BranchSchema.index({ is_active: 1 });
BranchSchema.index({ email: 1 }, { unique: true });
BranchSchema.index({ gst_number: 1 }, { unique: true });

// Virtual for user who created the branch
BranchSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile' }
});

module.exports = mongoose.model('Branch', BranchSchema);