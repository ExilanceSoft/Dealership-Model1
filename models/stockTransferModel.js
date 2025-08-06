const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle reference is required']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  receivedAt: {
    type: Date
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, { _id: false });

const stockTransferSchema = new mongoose.Schema({
  fromBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Source branch is required']
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Destination branch is required']
  },
  transferDate: {
    type: Date,
    required: [true, 'Transfer date is required'],
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date,
    default: Date.now
  },
  items: [transferItemSchema],
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
stockTransferSchema.index({ fromBranch: 1 });
stockTransferSchema.index({ toBranch: 1 });
stockTransferSchema.index({ status: 1 });
stockTransferSchema.index({ 'items.vehicle': 1 });
stockTransferSchema.index({ initiatedBy: 1 });

// Pre-save hook to validate references
stockTransferSchema.pre('save', async function(next) {
  try {
    // Validate branches
    if (this.fromBranch.equals(this.toBranch)) {
      throw new Error('Source and destination branches cannot be the same');
    }

    const [fromBranchExists, toBranchExists] = await Promise.all([
      mongoose.model('Branch').exists({ _id: this.fromBranch, is_active: true }),
      mongoose.model('Branch').exists({ _id: this.toBranch, is_active: true })
    ]);

    if (!fromBranchExists || !toBranchExists) {
      throw new Error('One or both branches are inactive or do not exist');
    }

    // Validate vehicles if this is a new transfer
    if (this.isNew) {
      const vehicleIds = this.items.map(item => item.vehicle);
      
      const vehiclesExist = await mongoose.model('Vehicle').countDocuments({ 
        _id: { $in: vehicleIds },
        unloadLocation: this.fromBranch,
        status: 'in_stock'
      });

      if (vehiclesExist !== vehicleIds.length) {
        throw new Error('One or more vehicles are not available at source branch or not in stock');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Post-save hook to update vehicle status and location immediately
stockTransferSchema.post('save', async function(doc, next) {
  try {
    if (doc.isNew) {
      // Immediately mark transfer as completed
      doc.status = 'completed';
      doc.receivedBy = doc.initiatedBy;
      doc.receivedAt = new Date();

      // Update all items to completed
      doc.items.forEach(item => {
        item.status = 'completed';
        item.receivedAt = new Date();
        item.receivedBy = doc.initiatedBy;
      });

      await doc.save();

      // Update vehicle locations to destination branch
      const vehicleIds = doc.items.map(item => item.vehicle);
      await mongoose.model('Vehicle').updateMany(
        { _id: { $in: vehicleIds } },
        { 
          unloadLocation: doc.toBranch,
          status: 'in_stock'
        }
      );
    }
    next();
  } catch (err) {
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
  options: { select: 'name email' }
});

stockTransferSchema.virtual('receivedByDetails', {
  ref: 'User',
  localField: 'receivedBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

stockTransferSchema.virtual('vehicleDetails', {
  ref: 'Vehicle',
  localField: 'items.vehicle',
  foreignField: '_id',
  options: { select: 'chassisNumber model type colors status' }
});

module.exports = mongoose.model('StockTransfer', stockTransferSchema);