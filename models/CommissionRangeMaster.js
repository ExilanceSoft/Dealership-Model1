// models/CommissionRangeMaster.js
const mongoose = require('mongoose');

const CommissionRangeSchema = new mongoose.Schema({
  minAmount: {
    type: Number,
    required: [true, 'Minimum amount is required'],
    min: [0, 'Minimum amount cannot be negative']
  },
  maxAmount: {
    type: Number,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || v > this.minAmount;
      },
      message: 'Maximum amount must be greater than minimum amount'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user reference is required']
  }
}, { timestamps: true });

CommissionRangeSchema.index({ minAmount: 1, maxAmount: 1 }, { unique: true });
CommissionRangeSchema.index({ isActive: 1 });

module.exports = mongoose.model('CommissionRangeMaster', CommissionRangeSchema);