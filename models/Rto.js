const mongoose = require('mongoose');

const RTOSchema = new mongoose.Schema({
  rto_code: {
    type: String,
    required: [true, 'RTO code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [10, 'RTO code cannot be more than 10 characters']
  },
  rto_name: {
    type: String,
    required: [true, 'RTO name is required'],
    trim: true,
    maxlength: [100, 'RTO name cannot be more than 100 characters']
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
RTOSchema.index({ rto_code: 1 }, { unique: true });

module.exports = mongoose.model('RTO', RTOSchema);