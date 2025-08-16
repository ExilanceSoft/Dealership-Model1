const mongoose = require('mongoose');

const BrokerBranchSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Added by user reference is required']
  },
  commissionType: {
    type: String,
    enum: ['FIXED', 'VARIABLE'],
    required: [true, 'Commission type is required']
  },
  fixedCommission: {
    type: Number,
    required: function() { return this.commissionType === 'FIXED'; },
    min: [0, 'Fixed commission cannot be negative']
  },
  commissionRange: {
    type: String,
    enum: ['1-20000', '20001-40000', '40001-60000', '60001'],
    required: function() { return this.commissionType === 'VARIABLE'; }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const BrokerSchema = new mongoose.Schema({
  brokerId: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid mobile number!`
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  branches: [BrokerBranchSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user reference is required']
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

BrokerSchema.pre('save', async function(next) {
  if (!this.brokerId) {
    const count = await this.constructor.countDocuments();
    this.brokerId = `BRK${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

BrokerSchema.index({ name: 1 });
BrokerSchema.index({ mobile: 1 });
BrokerSchema.index({ email: 1 });
BrokerSchema.index({ 'branches.branch': 1 });
BrokerSchema.index({ brokerId: 1 });

module.exports = mongoose.model('Broker', BrokerSchema);