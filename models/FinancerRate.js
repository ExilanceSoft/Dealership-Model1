const mongoose = require('mongoose');

const FinanceRateSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  financeProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceProvider',
    required: [true, 'Finance provider reference is required']
  },
  gcRate: {
    type: Number,
    required: [true, 'GC Rate is required'],
    min: [0, 'Rate cannot be negative'],
    max: [100, 'Rate cannot exceed 100%'],
    set: v => parseFloat(v.toFixed(2))
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
FinanceRateSchema.index({ branch: 1, financeProvider: 1 }, { unique: true });
FinanceRateSchema.index({ is_active: 1 });

// Virtuals for populated data
FinanceRateSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city' }
});

FinanceRateSchema.virtual('financeProviderDetails', {
  ref: 'FinanceProvider',
  localField: 'financeProvider',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name' }
});

FinanceRateSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

FinanceRateSchema.virtual('updatedByDetails', {
  ref: 'User',
  localField: 'updatedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

module.exports = mongoose.model('FinanceRate', FinanceRateSchema);