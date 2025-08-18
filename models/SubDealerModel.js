const mongoose = require('mongoose');

const subDealerPriceDataSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: [true, 'Price value is required'],
    min: [0, 'Price cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  header_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Header',
    required: [true, 'Header reference is required'],
    validate: {
      validator: async function(v) {
        const header = await mongoose.model('Header').exists({ _id: v });
        return header;
      },
      message: 'Invalid header_id - Header not found'
    }
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    validate: {
      validator: async function(v) {
        if (!v) return true; // null is allowed
        const branch = await mongoose.model('Branch').exists({ _id: v });
        return branch;
      },
      message: 'Invalid branch_id - Branch not found'
    }
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  _id: false,
  versionKey: false,
  timestamps: false
});

const subDealerSchema = new mongoose.Schema({
  model_name: {
    type: String,
    required: [true, 'Model name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Model name cannot exceed 100 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-]+$/.test(v);
      },
      message: 'Model name can only contain letters, numbers, spaces and hyphens'
    }
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    enum: {
      values: ['EV', 'ICE', 'CSD'],
      message: 'Type must be EV, ICE, or CSD'
    },
    uppercase: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    trim: true,
    lowercase: true
  },
  prices: {
    type: [subDealerPriceDataSchema],
    default: [],
    validate: {
      validator: function(v) {
        // Validate at least one price exists
        return v.length > 0;
      },
      message: 'At least one price is required'
    }
  },
  colors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    validate: {
      validator: async function(v) {
        const color = await mongoose.model('Color').exists({ _id: v });
        return color;
      },
      message: 'Invalid color_id - Color not found'
    }
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.created_at;
      delete ret.updated_at;
      
      if (ret.prices && Array.isArray(ret.prices)) {
        ret.prices = ret.prices.map(price => ({
          ...price,
          id: price._id,
          header_id: price.header_id?.id || price.header_id,
          branch_id: price.branch_id?.id || price.branch_id
        }));
      }
      
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  },
  collation: {
    locale: 'en',
    strength: 2 // Case-insensitive
  }
});

// Indexes
subDealerSchema.index({ model_name: 1 }, { unique: true });
subDealerSchema.index({ type: 1 });
subDealerSchema.index({ status: 1 });
subDealerSchema.index({ 'prices.header_id': 1 });
subDealerSchema.index({ 'prices.branch_id': 1 });
subDealerSchema.index({ colors: 1 });

// Middleware to validate references before save
subDealerSchema.pre('save', async function(next) {
  try {
    const userExists = await mongoose.model('User').exists({ _id: this.created_by });
    if (!userExists) {
      throw new Error('Invalid created_by - User not found');
    }

    if (this.isModified() && this.updated_by) {
      const updaterExists = await mongoose.model('User').exists({ _id: this.updated_by });
      if (!updaterExists) {
        throw new Error('Invalid updated_by - User not found');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Handle duplicate key errors
subDealerSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('SubDealer model name must be unique'));
  } else {
    next(error);
  }
});

// Add virtuals if needed
subDealerSchema.virtual('display_name').get(function() {
  return `${this.model_name} (${this.type})`;
});

module.exports = mongoose.model('SubDealer', subDealerSchema);