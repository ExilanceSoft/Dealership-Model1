const mongoose = require('mongoose');

const subdealerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subdealer name is required'],
    trim: true,
    maxlength: [100, 'Subdealer name cannot exceed 100 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  rateOfInterest: {
    type: Number,
    required: [true, 'Rate of interest is required'],
    min: [0, 'Rate of interest cannot be negative']
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    enum: {
      values: ['B2B', 'B2C'],
      message: 'Type must be either B2B or B2C'
    }
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate
subdealerSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Update the updatedAt field before saving
subdealerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Subdealer', subdealerSchema);