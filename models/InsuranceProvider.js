const mongoose = require('mongoose');

const InsuranceProviderSchema = new mongoose.Schema({
  provider_name: {
    type: String,
    required: [true, 'Provider name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Provider name cannot be more than 100 characters']
  },
  is_active: {
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better performance
InsuranceProviderSchema.index({ provider_name: 1 }, { unique: true });

module.exports = mongoose.model('InsuranceProvider', InsuranceProviderSchema);