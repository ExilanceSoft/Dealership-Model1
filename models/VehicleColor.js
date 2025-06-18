const mongoose = require('mongoose');

const VehicleColorSchema = new mongoose.Schema({
  color_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  color_name: {
    type: String,
    required: true,
    trim: true
  },
  hex_code: {
    type: String,
    trim: true,
    default: '#000000'
  },
  model_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleModel',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DISCONTINUED'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
VehicleColorSchema.index({ model_id: 1 });
VehicleColorSchema.index({ status: 1 });

// Virtual for model details
VehicleColorSchema.virtual('modelDetails', {
  ref: 'VehicleModel',
  localField: 'model_id',
  foreignField: '_id',
  justOne: true,
  options: { select: 'model_name manufacturer variant' }
});

module.exports = mongoose.model('VehicleColor', VehicleColorSchema);