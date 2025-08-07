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
    enum: ['loan', 'account', 'kyc', 'other']
  },
  priority: {
    type: Number,
    required: [true, 'Priority number is required'],
    min: [1, 'Priority must be at least 1'],
    validate: {
      validator: async function(value) {
        // Check if priority is unique for this formType
        const existing = await mongoose.model('Declaration').findOne({
          formType: this.formType,
          priority: value,
          _id: { $ne: this._id }
        });
        return !existing;
      },
      message: 'Priority must be unique for this form type'
    }
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