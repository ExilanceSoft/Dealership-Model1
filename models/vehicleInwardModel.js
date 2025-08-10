// const mongoose = require('mongoose');

// const damageSchema = new mongoose.Schema({
//   description: {
//     type: String,
//     required: [true, 'Damage description is required'],
//     trim: true,
//     maxlength: [500, 'Damage description cannot exceed 500 characters']
//   },
//   images: [{
//     type: String,
//     required: [true, 'At least one damage image is required']
//   }],
//   reportedAt: {
//     type: Date,
//     default: Date.now
//   },
//   reportedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }
// }, { _id: false });

// const vehicleSchema = new mongoose.Schema({
//   model: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Model',
//     required: [true, 'Model is required']
//   },
//    modelName: {
//   type: String,
//   required: [true, 'Model name is required']
// },

//   unloadLocation: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Branch',
//     required: [true, 'Unload location is required'],
//     // immutable: true // Prevents changing branch after creation
//   },
//   type: {
//     type: String,
//     required: [true, 'Vehicle type is required (EV/ICE)'],
//     enum: ['EV', 'ICE'],
//     uppercase: true
//   },
//   color: {
//     id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Color',
//       required: [true, 'Color ID is required']
//     },
//     name: {
//       type: String,
//       required: [true, 'Color name is required'],
//       trim: true
//     }
//   },
//   batteryNumber: {
//     type: String,
//     trim: true,
//     uppercase: true,
//     sparse: true // Allows null but enforces uniqueness for non-null
//   },
//   keyNumber: {
//     type: String,
//     trim: true,
//     uppercase: true,
//     sparse: true
//   },
//   chassisNumber: {
//     type: String,
//     required: [true, 'Chassis number is required'],
//     unique: true, // Globally unique across all branches
//     trim: true,
//     uppercase: true,
//     immutable: true
//   },
//   motorNumber: {
//     type: String,
//     trim: true,
//     uppercase: true,
//     required: function() { return this.type === 'EV'; },
//     sparse: true
//   },
//   chargerNumber: {
//     type: String,
//     trim: true,
//     uppercase: true,
//     required: function() { return this.type === 'EV'; },
//     sparse: true
//   },
//   engineNumber: {
//     type: String,
//     trim: true,
//     uppercase: true,
//     required: function() { return this.type === 'ICE'; },
//     sparse: true
//   },
//   hasDamage: {
//     type: Boolean,
//     default: false
//   },
//   damages: [damageSchema],
//   qrCode: {
//     type: String,
//     unique: true,
//     immutable: true
//   },
//   qrCodeImage: String,
//  status: {
//   type: String,
//   enum: ['not_approved', 'in_stock', 'in_transit', 'sold', 'service', 'damaged'],
//   default: 'not_approved'
// },
//   addedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     immutable: true
//   },
//   lastUpdatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true },
//   strict: 'throw' // Throws error for unknown fields
// });

// // Indexes for performance
// vehicleSchema.index({ chassisNumber: 1 }, { unique: true });
// vehicleSchema.index({ unloadLocation: 1 });
// vehicleSchema.index({ type: 1 });
// vehicleSchema.index({ status: 1 });
// vehicleSchema.index({ model: 1 });
// vehicleSchema.index({ 'color.name': 1 });

// // Virtuals for populated data
// vehicleSchema.virtual('branchDetails', {
//   ref: 'Branch',
//   localField: 'unloadLocation',
//   foreignField: '_id',
//   justOne: true,
//   options: { select: 'name address city state' }
// });

// vehicleSchema.virtual('addedByDetails', {
//   ref: 'User',
//   localField: 'addedBy',
//   foreignField: '_id',
//   justOne: true,
//   options: { select: 'name email role' }
// });

// // Pre-save hooks
// vehicleSchema.pre('save', async function(next) {
//   // Auto-generate QR code if not set
//   if (!this.qrCode) {
//     this.qrCode = `VH-${this.chassisNumber}-${Date.now().toString(36).toUpperCase()}`;
//   }

//   // Validate branch exists
//   const branchExists = await mongoose.model('Branch').exists({ _id: this.unloadLocation });
//   if (!branchExists) {
//     throw new Error(`Branch ${this.unloadLocation} does not exist`);
//   }

//   // Validate color exists
//   if (this.color?.id) {
//     const colorExists = await mongoose.model('Color').exists({ _id: this.color.id });
//     if (!colorExists) {
//       throw new Error(`Color ${this.color.id} does not exist`);
//     }
//   }

//   next();
// });

// // Prevent branch changes
// // vehicleSchema.pre('findOneAndUpdate', function(next) {
// //   if (this._update.unloadLocation) {
// //     throw new Error('Cannot change vehicle branch after creation');
// //   }
// //   next();
// // });

// // Duplicate chassis number check (extra protection)
// vehicleSchema.post('save', function(error, doc, next) {
//   if (error.name === 'MongoError' && error.code === 11000) {
//     next(new Error(`Chassis number ${doc.chassisNumber} already exists in the system`));
//   } else {
//     next(error);
//   }
// });

// module.exports = mongoose.model('Vehicle', vehicleSchema);

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
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  model: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Model' // Removed required: true
},
modelName: {
  type: String,
  required: [true, 'Model name is required']
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
  color: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Color',
      required: [true, 'Color ID is required']
    },
    name: {
      type: String,
      required: [true, 'Color name is required'],
      trim: true
    }
  },
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
    uppercase: true,
    required: function() { return this.type === 'EV'; }
  },
  chargerNumber: {
    type: String,
    trim: true,
    uppercase: true,
    required: function() { return this.type === 'EV'; }
  },
  engineNumber: {
    type: String,
    trim: true,
    uppercase: true,
    required: function() { return this.type === 'ICE'; }
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
  qrCodeImage: String,
  status: {
    type: String,
    enum: ['not_approved', 'in_stock', 'in_transit', 'sold', 'service', 'damaged'],
    default: 'not_approved'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strict: 'throw'
});

// Indexes for performance
vehicleSchema.index({ chassisNumber: 1 }, { unique: true });
vehicleSchema.index({ qrCode: 1 }, { unique: true });
vehicleSchema.index({ model: 1 });
vehicleSchema.index({ unloadLocation: 1 });
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ 'color.name': 1 });
vehicleSchema.index({ 'color.id': 1 });

// Pre-save hooks
vehicleSchema.pre('save', async function(next) {
  // Auto-generate QR code if not set
  if (!this.qrCode) {
    this.qrCode = `VH-${this.chassisNumber}-${Date.now().toString(36).toUpperCase()}`;
  }

  // Validate references exist
  try {
    // Only validate model if it's provided
    if (this.model && this.isModified('model')) {
      const modelExists = await mongoose.model('Model').exists({ _id: this.model });
      if (!modelExists) throw new Error('Referenced Model does not exist');
    }
   
    if (this.isModified('unloadLocation')) {
      const branchExists = await mongoose.model('Branch').exists({ _id: this.unloadLocation });
      if (!branchExists) throw new Error('Referenced Branch does not exist');
    }
   
    if (this.isModified('colors') || this.isModified('color.id')) {
      const colorExists = await mongoose.model('Color').exists({ _id: this.color.id });
      if (!colorExists) throw new Error('Referenced Color does not exist');
      
      // Ensure color.id is in colors array
      if (!this.colors.includes(this.color.id)) {
        this.colors = [...new Set([this.color.id, ...this.colors])];
      }
    }
   
    if (this.isModified('addedBy')) {
      const userExists = await mongoose.model('User').exists({ _id: this.addedBy });
      if (!userExists) throw new Error('Referenced User does not exist');
    }

    // Sync color name if not set or if color ID changed
    if (!this.color.name || this.isModified('color.id')) {
      const colorDoc = await mongoose.model('Color').findById(this.color.id).select('name');
      if (colorDoc) {
        this.color.name = colorDoc.name;
      }
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
// Duplicate chassis number check (extra protection)
vehicleSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error(`Chassis number ${doc.chassisNumber} already exists in the system`));
  } else {
    next(error);
  }
});
module.exports = mongoose.model('Vehicle', vehicleSchema);

