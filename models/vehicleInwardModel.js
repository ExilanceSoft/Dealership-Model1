const mongoose = require('mongoose');

const damageSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Damage description is required'],
    trim: true,
    maxlength: [500, 'Damage description cannot exceed 500 characters']
  },
  images: [{
    type: String,
    required: [true, 'At least one damage image is required']
  }],
  reportedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: [true, 'Model is required']
  },
  unloadLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Unload location is required']
  },
  type: {
    type: String,
    required: [true, 'Vehicle type is required (EV/ICE)'],
    enum: ['EV', 'ICE'],
    uppercase: true
  },
  colors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    required: [true, 'At least one color is required']
  }],
  batteryNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  keyNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  chassisNumber: {
    type: String,
    required: [true, 'Chassis number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  motorNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  chargerNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  engineNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  hasDamage: {
    type: Boolean,
    default: false
  },
  damages: [damageSchema],
  qrCode: {
    type: String,
    unique: true
  },
  qrCodeImage: {
    type: String
  },
  status: {
    type: String,
    enum: ['in_stock', 'in_transit', 'sold', 'service', 'damaged'],
    default: 'in_stock'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
vehicleSchema.index({ chassisNumber: 1 }, { unique: true });
vehicleSchema.index({ qrCode: 1 }, { unique: true });
vehicleSchema.index({ model: 1 });
vehicleSchema.index({ unloadLocation: 1 });
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ colors: 1 });

// Pre-save hook to generate QR code
vehicleSchema.pre('save', async function(next) {
  if (!this.qrCode) {
    this.qrCode = `VH-${this.chassisNumber}-${Date.now().toString(36)}`;
  }
  next();
});

// Pre-save hook to validate references
vehicleSchema.pre('save', async function(next) {
  try {
    if (this.isModified('model')) {
      const modelExists = await mongoose.model('Model').exists({ _id: this.model });
      if (!modelExists) throw new Error('Referenced Model does not exist');
    }
    
    if (this.isModified('unloadLocation')) {
      const branchExists = await mongoose.model('Branch').exists({ _id: this.unloadLocation });
      if (!branchExists) throw new Error('Referenced Branch does not exist');
    }
    
    if (this.isModified('colors')) {
      const colorsExist = await mongoose.model('Color').countDocuments({ _id: { $in: this.colors } });
      if (colorsExist !== this.colors.length) throw new Error('One or more Colors do not exist');
    }
    
    if (this.isModified('addedBy')) {
      const userExists = await mongoose.model('User').exists({ _id: this.addedBy });
      if (!userExists) throw new Error('Referenced User does not exist');
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// Virtuals for populated data
vehicleSchema.virtual('modelDetails', {
  ref: 'Model',
  localField: 'model',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'model_name type status prices colors createdAt'
  }
});

vehicleSchema.virtual('locationDetails', {
  ref: 'Branch',
  localField: 'unloadLocation',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'name address city state'
  }
});

vehicleSchema.virtual('colorDetails', {
  ref: 'Color',
  localField: 'colors',
  foreignField: '_id',
  options: { 
    select: 'name hex_code status models createdAt'
  }
});

vehicleSchema.virtual('addedByDetails', {
  ref: 'User',
  localField: 'addedBy',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'name email'
  }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);