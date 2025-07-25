const mongoose = require('mongoose');

const declarationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Declaration title is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Declaration content is required']
  },
  formType: {
    type: String,
    required: [true, 'Form type is required'],
    enum: ['loan', 'account', 'kyc', 'other'] // Add more as needed
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
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

// Add virtual for createdBy details
declarationSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Update timestamps on save
declarationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Declaration = mongoose.model('Declaration', declarationSchema);

module.exports = Declaration;