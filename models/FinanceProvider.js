const mongoose = require('mongoose');

const FinanceProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Finance provider name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9&.\s-]+$/.test(v);
      },
      message: 'Provider name contains invalid characters'
    }
  },
  is_active: {
    type: Boolean,
    default: true
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
FinanceProviderSchema.index({ name: 1 }, { unique: true });
FinanceProviderSchema.index({ is_active: 1 });

// Virtuals for populated data
FinanceProviderSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

FinanceProviderSchema.virtual('updatedByDetails', {
  ref: 'User',
  localField: 'updatedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

module.exports = mongoose.model('FinanceProvider', FinanceProviderSchema);