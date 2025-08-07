const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle reference is required'],
    immutable: true
  },
  status: {
    type: String,
    enum: ['in_stock','completed', 'cancelled'],
    default: 'in_stock'
  },
  receivedAt: Date,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  _id: false,
  timestamps: false
});

const stockTransferSchema = new mongoose.Schema({
  fromBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Source branch is required'],
    immutable: true
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Destination branch is required'],
    immutable: true
  },
  transferDate: {
    type: Date,
    required: [true, 'Transfer date is required'],
    default: Date.now,
    immutable: true
  },
  expectedDeliveryDate: Date,
  items: {
    type: [transferItemSchema],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'At least one item is required for transfer'
    }
  },
  status: {
    type: String,
    enum: ['in_stock', 'completed', 'cancelled'],
    default: 'in_stock'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  trackingNumber: {
    type: String,
    unique: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  optimisticConcurrency: true
});

// Indexes
stockTransferSchema.index({ fromBranch: 1, status: 1 });
stockTransferSchema.index({ toBranch: 1, status: 1 });
stockTransferSchema.index({ initiatedBy: 1, status: 1 });
stockTransferSchema.index({ 'items.vehicle': 1, status: 1 });
stockTransferSchema.index({ transferDate: -1 });

// Generate tracking number before save
stockTransferSchema.pre('save', async function(next) {
  if (!this.trackingNumber) {
    this.trackingNumber = `TR-${Date.now().toString(36).toUpperCase()}`;
  }
  next();
});

// Validate transfer data before saving
stockTransferSchema.pre('save', async function(next) {
  try {
    // Skip validation if not modified
    if (!this.isModified()) return next();
   
    // Validate branches are different
    if (this.fromBranch.equals(this.toBranch)) {
      throw new Error('Source and destination branches cannot be the same');
    }

    // Validate branches exist
    const [fromBranch, toBranch] = await Promise.all([
      mongoose.model('Branch').findById(this.fromBranch).select('_id is_active'),
      mongoose.model('Branch').findById(this.toBranch).select('_id is_active')
    ]);

    if (!fromBranch || !toBranch) {
      throw new Error('One or both branches do not exist');
    }
    if (!fromBranch.is_active || !toBranch.is_active) {
      throw new Error('One or both branches are inactive');
    }

    // Validate vehicles exist and are at source branch
    if (this.isNew || this.isModified('items')) {
      const vehicleIds = this.items.map(item => item.vehicle);
      const vehicles = await mongoose.model('Vehicle').find(
        { _id: { $in: vehicleIds } },
        { _id: 1, unloadLocation: 1, status: 1, chassisNumber: 1 }
      );

      // Check all vehicles exist
      if (vehicles.length !== vehicleIds.length) {
        const missingIds = vehicleIds.filter(id =>
          !vehicles.some(v => v._id.equals(id))
        );
        throw new Error(`Vehicles not found: ${missingIds.join(', ')}`);
      }

      // Verify vehicles are at source branch and in stock
      const invalidLocation = vehicles.filter(v =>
        !v.unloadLocation.equals(this.fromBranch)
      );
      const invalidStatus = vehicles.filter(v =>
        v.status !== 'in_stock'
      );

      if (invalidLocation.length > 0) {
        throw new Error(
          `Some vehicles are not at source branch: ${
            invalidLocation.map(v => `${v.chassisNumber} (${v._id})`).join(', ')
          }`
        );
      }

      if (invalidStatus.length > 0) {
        throw new Error(
          `Some vehicles are not in 'in_stock' status: ${
            invalidStatus.map(v => `${v.chassisNumber} (${v._id} - ${v.status})`).join(', ')
          }`
        );
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Update vehicle locations when status is pending
// In stockTransferModel.js
stockTransferSchema.post('save', async function(doc, next) {
  try {
    if (doc.status === 'in_stock') { // Update immediately when transfer is created
      const vehicleIds = doc.items.map(item => item.vehicle);
      
      await mongoose.model('Vehicle').updateMany(
        { _id: { $in: vehicleIds } },
        {
          unloadLocation: doc.toBranch, // Update to destination branch
          status: 'in_stock' // Keep status as in_stock
        }
      );
    }
    next();
  } catch (err) {
    console.error('Error updating vehicle locations:', err);
    next(err);
  }
});

// Virtuals for populated data
stockTransferSchema.virtual('fromBranchDetails', {
  ref: 'Branch',
  localField: 'fromBranch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

stockTransferSchema.virtual('toBranchDetails', {
  ref: 'Branch',
  localField: 'toBranch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

stockTransferSchema.virtual('initiatedByDetails', {
  ref: 'User',
  localField: 'initiatedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email role' }
});

stockTransferSchema.virtual('receivedByDetails', {
  ref: 'User',
  localField: 'receivedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email role' }
});

stockTransferSchema.virtual('vehicleDetails', {
  ref: 'Vehicle',
  localField: 'items.vehicle',
  foreignField: '_id',
  options: {
    select: 'chassisNumber model type color status unloadLocation', // Keep color as embedded
    populate: [
      { path: 'model', select: 'model_name type' }
    ]
  }
});

// Method to mark transfer as in transit
stockTransferSchema.methods.markAsInTransit = async function(userId) {
  if (this.status !== 'in_stock') {
    throw new Error('Only in_stock transfers can be marked as in transit');
  }
 
  this.status = 'in_stock';
 
  // Update vehicle statuses to in_transit
  const vehicleIds = this.items.map(item => item.vehicle);
  await mongoose.model('Vehicle').updateMany(
    { _id: { $in: vehicleIds } },
    {
      status: 'in_stock'
    }
  );
 
  return this.save();
};

// Method to complete a transfer
// In stockTransferModel.js
stockTransferSchema.methods.completeTransfer = async function(userId) {
  this.status = 'completed';
  this.receivedBy = userId;
  this.receivedAt = new Date();
  
  this.items.forEach(item => {
    item.status = 'completed';
    item.receivedAt = new Date();
    item.receivedBy = userId;
  });

  return this.save();
};

// Method to cancel a transfer
stockTransferSchema.methods.cancelTransfer = async function(userId, reason) {
  if (this.status === 'completed') {
    throw new Error('Completed transfers cannot be cancelled');
  }
 
  this.status = 'cancelled';
  this.notes = reason || 'Transfer cancelled';
 
  this.items.forEach(item => {
    item.status = 'cancelled';
  });

  // Revert vehicle locations and status
  const vehicleIds = this.items.map(item => item.vehicle);
  await mongoose.model('Vehicle').updateMany(
    { _id: { $in: vehicleIds } },
    {
      unloadLocation: this.fromBranch,
      status: 'in_stock'
    }
  );
 
  return this.save();
};

module.exports = mongoose.model('StockTransfer', stockTransferSchema);

