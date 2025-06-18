const mongoose = require('mongoose');

const RtoSchema = new mongoose.Schema({
  rto_code: {
    type: String,
    required: [true, 'RTO code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{2}\d{1,2}$/.test(v);
      },
      message: props => `${props.value} is not a valid RTO code! Format should be XX## (e.g., MH12)`
    }
  },
  rto_name: {
    type: String,
    required: [true, 'RTO name is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    uppercase: true
  },
  district: {
    type: String,
    required: [true, 'District is required'],
    trim: true,
    uppercase: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    uppercase: true
  },
  road_tax: {
    type: Number,
    required: [true, 'Road tax amount is required'],
    min: [0, 'Road tax cannot be negative']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(v);
      },
      message: props => `${props.value} is not a valid website URL!`
    }
  },
  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
RtoSchema.index({ rto_code: 1 }, { unique: true });
RtoSchema.index({ city: 1 });
RtoSchema.index({ state: 1 });
RtoSchema.index({ district: 1 });
RtoSchema.index({ isActive: 1 });
RtoSchema.index({ createdBy: 1 });
RtoSchema.index({ branches: 1 });

// Virtual for branch details
RtoSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branches',
  foreignField: '_id',
  justOne: false
});

// Pre-save hook to ensure RTO code uniqueness
RtoSchema.pre('save', async function(next) {
  const rto = this;
  if (rto.isModified('rto_code')) {
    const existingRto = await mongoose.model('Rto').findOne({ 
      rto_code: rto.rto_code,
      _id: { $ne: rto._id }
    });
    if (existingRto) {
      const err = new Error(`RTO code ${rto.rto_code} already exists`);
      err.name = 'DuplicateKeyError';
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Rto', RtoSchema);