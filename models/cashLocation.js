const mongoose = require('mongoose');

const cashLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Cash location name is required'],
    trim: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  branchDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for createdBy details
cashLocationSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Update the branchDetails when branch is set
cashLocationSchema.pre('save', async function(next) {
  if (this.isModified('branch')) {
    const Branch = mongoose.model('Branch');
    this.branchDetails = await Branch.findById(this.branch).select('name');
  }
  next();
});

// Update timestamp on update
cashLocationSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Check if model already exists before defining it
const CashLocation = mongoose.models.CashLocation || mongoose.model('CashLocation', cashLocationSchema);

module.exports = CashLocation;