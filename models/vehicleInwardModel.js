const mongoose = require('mongoose');
const logger = require('../config/logger');

const damageSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  severity: {
    type: String,
    enum: ['minor', 'medium', 'major'],
    default: 'minor'
  }
}, { _id: false });

const vehicleInwardSchema = new mongoose.Schema({
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  type: {
    type: String,
    enum: ['EV', 'ICE'],
    required: true,
    uppercase: true
  },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    required: true
  },
  unloadLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  batteryNumber: String,
  keyNumber: String,
  chassisNumber: {
    type: String,
    required: true,
    unique: true
  },
  motorNumber: String,
  chargerNumber: String,
  engineNumber: String,
  hasDamage: {
    type: Boolean,
    default: false
  },
  damages: [damageSchema],
  qrCode: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['inwarded', 'inspected', 'approved', 'rejected', 'dispatched'],
    default: 'inwarded'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals for populated data
vehicleInwardSchema.virtual('modelDetails', {
  ref: 'Model',
  localField: 'model',
  foreignField: '_id',
  justOne: true
});

vehicleInwardSchema.virtual('colorDetails', {
  ref: 'Color',
  localField: 'color',
  foreignField: '_id',
  justOne: true
});

vehicleInwardSchema.virtual('unloadLocationDetails', {
  ref: 'Branch',
  localField: 'unloadLocation',
  foreignField: '_id',
  justOne: true
});

vehicleInwardSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

vehicleInwardSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true
});

// Indexes
vehicleInwardSchema.index({ chassisNumber: 1 }, { unique: true });
vehicleInwardSchema.index({ qrCode: 1 }, { unique: true });
vehicleInwardSchema.index({ model: 1 });
vehicleInwardSchema.index({ type: 1 });
vehicleInwardSchema.index({ status: 1 });
vehicleInwardSchema.index({ unloadLocation: 1 });
vehicleInwardSchema.index({ branch: 1 });

// Pre-save hook to generate QR code
vehicleInwardSchema.pre('save', async function(next) {
  if (!this.qrCode) {
    const qrData = `${this.model}|${this.chassisNumber}|${this.color}|${this.unloadLocation}|${this.status}`;
    this.qrCode = require('crypto').createHash('sha256').update(qrData).digest('hex');
  }
  next();
});

module.exports = mongoose.model('VehicleInward', vehicleInwardSchema);