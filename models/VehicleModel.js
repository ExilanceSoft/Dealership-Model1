const mongoose = require('mongoose');

const VehicleModelSchema = new mongoose.Schema({
  model_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  manufacturer: {
    type: String,
    required: true,
    trim: true
  },
  model_name: {
    type: String,
    required: true,
    trim: true
  },
  variant: {
    type: String,
    required: true,
    trim: true
  },
  engine_cc: {
    type: Number,
    required: true
  },
  ex_showroom_price: {
    type: Number,
    required: true
  },
  fuel_type: {
    type: String,
    enum: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID'],
    required: true
  },
  part_number: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  is_part_active: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DISCONTINUED'],
    default: 'ACTIVE'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
VehicleModelSchema.index({ manufacturer: 1 });
VehicleModelSchema.index({ model_name: 1 });
VehicleModelSchema.index({ fuel_type: 1 });
VehicleModelSchema.index({ status: 1 });

module.exports = mongoose.model('VehicleModel', VehicleModelSchema);