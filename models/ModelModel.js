const mongoose = require('mongoose');

const priceDataSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true,
    min: 0
  },
  header_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Header',
    required: true
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }
}, {
  _id: false,
  versionKey: false
});

const modelSchema = new mongoose.Schema({
  model_name: {
    type: String,
    required: [true, 'Model name is required'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return !v.includes(',');
      },
      message: 'Model name cannot contain commas'
    }
  },
  type: {
    type: String,
    required: [true, 'Type is required (EV/ICE/CSD)'],
    enum: ['EV', 'ICE', 'CSD'],
    uppercase: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    trim: true,
    lowercase: true
  },
  model_discount: {
    type: Number,
    default: 0,
    min: 0
  },
  prices: {
    type: [priceDataSchema],
    default: []
  },
  colors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: false,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret._id;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  },
  collation: {
    locale: 'en',
    strength: 2
  }
});

// Indexes
modelSchema.index({ model_name: 1 });
modelSchema.index({ type: 1 });
modelSchema.index({ status: 1 });
modelSchema.index({ model_discount: 1 });
modelSchema.index({ 'prices.header_id': 1 });
modelSchema.index({ 'prices.branch_id': 1 });
modelSchema.index({ colors: 1 });

// Handle duplicate key errors
modelSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Model name must be unique'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Model', modelSchema);