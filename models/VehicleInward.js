const mongoose = require('mongoose');

const VehicleInwardSchema = new mongoose.Schema({
  inward_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  model_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleModel',
    required: true
  },
  color_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleColor',
    required: true
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  chassis_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  engine_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  battery_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  motor_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  key_number: {
    type: String,
    trim: true,
    uppercase: true
  },
  purchase_invoice: {
    type: String, 
    trim: true
  },
  qr_code: {
    type: String,
    trim: true
  },
  vehicle_status: {
    type: String,
    enum: ['MAIN_BRANCH', 'GO_DOWN', 'DAMAGED', 'SOLD', 'UNDER_REPAIR'],
    default: 'MAIN_BRANCH'
  },
  damage_description: {
    type: String,
    trim: true
  },
  is_damage_approved: {
    type: Boolean,
    default: false
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Indexes
VehicleInwardSchema.index({ chassis_number: 1 });
VehicleInwardSchema.index({ engine_number: 1 });
VehicleInwardSchema.index({ branch_id: 1 });
VehicleInwardSchema.index({ vehicle_status: 1 });
VehicleInwardSchema.index({ is_damage_approved: 1 });

// Virtuals for related data
VehicleInwardSchema.virtual('modelDetails', {
  ref: 'VehicleModel',
  localField: 'model_id',
  foreignField: '_id',
  justOne: true,
  options: { select: 'model_name manufacturer variant fuel_type' }
});

VehicleInwardSchema.virtual('colorDetails', {
  ref: 'VehicleColor',
  localField: 'color_id',
  foreignField: '_id',
  justOne: true,
  options: { select: 'color_name hex_code' }
});

VehicleInwardSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch_id',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city' }
});

// Pre-save hook to generate QR code
VehicleInwardSchema.pre('save', async function(next) {
  if (!this.qr_code && this.chassis_number && this.model_id) {
    const model = await mongoose.model('VehicleModel').findById(this.model_id);
    if (model) {
      this.qr_code = `${model.variant}|${this.chassis_number}|${this.color_id}`;
    }
  }
  next();
});

module.exports = mongoose.model('VehicleInward', VehicleInwardSchema);