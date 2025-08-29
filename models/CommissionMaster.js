// models/CommissionMaster.js - Updated with enhanced date range support and history tracking
const mongoose = require('mongoose');

// Commission Rate History Schema
const commissionRateHistorySchema = new mongoose.Schema({
  header_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Header',
    required: true
  },
  commission_rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  is_active: {
    type: Boolean,
    default: true
  },
  applicable_from: {
    type: Date,
    required: true,
    default: Date.now
  },
  applicable_to: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        return value === null || !isNaN(value.getTime());
      },
      message: 'applicable_to must be a valid date or null'
    }
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changed_at: {
    type: Date,
    default: Date.now
  },
  change_type: {
    type: String,
    enum: ['CREATED', 'UPDATED', 'DEACTIVATED'],
    required: true
  },
  previous_value: {
    type: Number,
    default: null
  },
  previous_from: {
    type: Date,
    default: null
  },
  previous_to: {
    type: Date,
    default: null
  }
}, {
  _id: false,
  timestamps: false
});

// Commission Rate Schema
const commissionRateSchema = new mongoose.Schema({
  header_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Header',
    required: [true, 'Header ID is required']
  },
  commission_rate: {
    type: Number,
    required: [true, 'Commission rate is required'],
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100%'],
    set: v => Math.round(v * 100) / 100
  },
  is_active: {
    type: Boolean,
    default: true
  },
  applicable_from: {
    type: Date,
    required: [true, 'Applicable from date is required'],
    default: Date.now
  },
  applicable_to: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        return value === null || !isNaN(value.getTime());
      },
      message: 'applicable_to must be a valid date or null'
    }
  },
}, {
  _id: false,
  timestamps: false
});

// Main Commission Master Schema
const commissionMasterSchema = new mongoose.Schema({
  subdealer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subdealer',
    required: [true, 'Subdealer ID is required'],
    index: true
  },
  model_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: [true, 'Model ID is required'],
    index: true
  },
  commission_rates: [commissionRateSchema],
  rate_history: [commissionRateHistorySchema],
  is_active: {
    type: Boolean,
    default: true
  },
  is_frozen: {
    type: Boolean,
    default: false
  },
  frozen_at: {
    type: Date
  },
  frozen_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  freeze_applicable_from: {
    type: Date,
    validate: {
      validator: function(value) {
        return !this.is_frozen || value;
      },
      message: 'Freeze applicable from date is required when frozen'
    }
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to ensure unique combination of subdealer and model
commissionMasterSchema.index({ subdealer_id: 1, model_id: 1 }, { unique: true });

// Index for commission rates header references
commissionMasterSchema.index({ 'commission_rates.header_id': 1 });
commissionMasterSchema.index({ 'commission_rates.applicable_from': 1 });
commissionMasterSchema.index({ 'commission_rates.applicable_to': 1 });

// Index for rate history
commissionMasterSchema.index({ 'rate_history.header_id': 1 });
commissionMasterSchema.index({ 'rate_history.changed_at': 1 });

// Pre-save validation to ensure header exists and check date overlaps
commissionMasterSchema.pre('save', async function(next) {
  try {
    const Header = mongoose.model('Header');
    
    for (const rate of this.commission_rates) {
      const headerExists = await Header.exists({ _id: rate.header_id });
      if (!headerExists) {
        throw new Error(`Header with ID ${rate.header_id} does not exist`);
      }
      
      // Check for date overlaps with proper null checks
      const overlappingRates = this.commission_rates.filter(r => {
        if (r.header_id.toString() !== rate.header_id.toString() || r._id === rate._id) {
          return false;
        }
        
        const rFrom = r.applicable_from;
        const rTo = r.applicable_to;
        const rateFrom = rate.applicable_from;
        const rateTo = rate.applicable_to;
        
        // Both have no end date
        if (!rTo && !rateTo) return true;
        
        // Current rate has no end date, check if new rate ends after current starts
        if (!rTo && rateTo && rateTo >= rFrom) return true;
        
        // New rate has no end date, check if current rate ends after new rate starts
        if (!rateTo && rTo && rTo >= rateFrom) return true;
        
        // Both have end dates, check for overlap
        if (rTo && rateTo && rTo >= rateFrom && rFrom <= rateTo) return true;
        
        return false;
      });
      
      if (overlappingRates.length > 0) {
        throw new Error(`Commission rate for header ${rate.header_id} has date overlap with existing rates`);
      }
    }
    
    // Validate freeze applicable from date
    if (this.is_frozen && !this.freeze_applicable_from) {
      throw new Error('Freeze applicable from date is required when freezing commissions');
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// Virtual for subdealer details
commissionMasterSchema.virtual('subdealer_details', {
  ref: 'Subdealer',
  localField: 'subdealer_id',
  foreignField: '_id',
  justOne: true
});

// Virtual for model details
commissionMasterSchema.virtual('model_details', {
  ref: 'Model',
  localField: 'model_id',
  foreignField: '_id',
  justOne: true
});

// Virtual for created by user details
commissionMasterSchema.virtual('created_by_details', {
  ref: 'User',
  localField: 'created_by',
  foreignField: '_id',
  justOne: true
});

// Virtual for updated by user details
commissionMasterSchema.virtual('updated_by_details', {
  ref: 'User',
  localField: 'updated_by',
  foreignField: '_id',
  justOne: true
});

// Virtual for frozen by user details
commissionMasterSchema.virtual('frozen_by_details', {
  ref: 'User',
  localField: 'frozen_by',
  foreignField: '_id',
  justOne: true
});

// Virtual for rate history changed by details
commissionMasterSchema.virtual('rate_history.changed_by_details', {
  ref: 'User',
  localField: 'rate_history.changed_by',
  foreignField: '_id',
  justOne: true
});

// Method to get commission rate for a specific header and date
commissionMasterSchema.methods.getCommissionRate = function(headerId, date = new Date()) {
  // Check if commission is frozen and applicable
  if (this.is_frozen && this.freeze_applicable_from && date >= this.freeze_applicable_from) {
    return 0;
  }
  
  // Find the applicable commission rate for the specific date
  const applicableRates = this.commission_rates.filter(r => 
    r.header_id.toString() === headerId.toString() && 
    r.is_active &&
    r.applicable_from &&
    date >= r.applicable_from &&
    (!r.applicable_to || date <= r.applicable_to)
  );
  
  // If multiple rates found, use the most recent one (highest applicable_from)
  if (applicableRates.length > 0) {
    const mostRecentRate = applicableRates.sort((a, b) => 
      b.applicable_from - a.applicable_from
    )[0];
    return mostRecentRate.commission_rate;
  }
  
  // If no date-specific rate found, look for rates without date restrictions
  const unrestrictedRates = this.commission_rates.filter(r => 
    r.header_id.toString() === headerId.toString() && 
    r.is_active &&
    !r.applicable_to
  );
  
  if (unrestrictedRates.length > 0) {
    const mostRecentUnrestricted = unrestrictedRates.sort((a, b) => 
      b.applicable_from - a.applicable_from
    )[0];
    return mostRecentUnrestricted.commission_rate;
  }
  
  return 0;
};

// Method to add rate history entry
commissionMasterSchema.methods.addRateHistory = function(entry) {
  if (!this.rate_history) {
    this.rate_history = [];
  }
  
  this.rate_history.push({
    ...entry,
    changed_at: new Date()
  });
  
  return this.save();
};

// Method to freeze commission rates
commissionMasterSchema.methods.freezeCommission = function(userId, applicableFrom = new Date()) {
  this.is_frozen = true;
  this.frozen_at = new Date();
  this.frozen_by = userId;
  this.freeze_applicable_from = applicableFrom;
  
  // Add history entry for freeze
  this.addRateHistory({
    header_id: null,
    commission_rate: 0,
    is_active: false,
    applicable_from: applicableFrom,
    applicable_to: null,
    changed_by: userId,
    change_type: 'DEACTIVATED',
    previous_value: null
  });
  
  return this.save();
};

// Method to unfreeze commission rates
commissionMasterSchema.methods.unfreezeCommission = function(userId) {
  this.is_frozen = false;
  this.frozen_at = undefined;
  this.frozen_by = undefined;
  this.freeze_applicable_from = undefined;
  
  // Add history entry for unfreeze
  this.addRateHistory({
    header_id: null,
    commission_rate: null,
    is_active: true,
    applicable_from: new Date(),
    applicable_to: null,
    changed_by: userId,
    change_type: 'UPDATED',
    previous_value: 0
  });
  
  return this.save();
};

module.exports = mongoose.model('CommissionMaster', commissionMasterSchema);