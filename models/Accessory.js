const mongoose = require('mongoose');

const modelPartNumberSchema = new mongoose.Schema({
  model_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  part_number: {
    type: String,
    required: [true, 'Part number is required'],
    trim: true,
    maxlength: [50, 'Part number cannot exceed 50 characters']
  }
}, { _id: false });

const accessorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Accessory name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Accessory name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  applicable_models: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  }],
  model_part_numbers: {
    type: [modelPartNumberSchema],
    validate: {
      validator: function(v) {
        // Ensure each model in applicable_models has a corresponding part number
        return v.length === this.applicable_models.length;
      },
      message: 'Each applicable model must have a part number'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    lowercase: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
accessorySchema.index({ name: 1 });
accessorySchema.index({ status: 1 });
accessorySchema.index({ 'applicable_models': 1 });
accessorySchema.index({ price: 1 });

// Virtual for createdBy user details
accessorySchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Virtual for applicable models details
accessorySchema.virtual('applicableModelsDetails', {
  ref: 'Model',
  localField: 'applicable_models',
  foreignField: '_id',
  options: { select: 'model_name type' }
});

// Handle duplicate key errors
accessorySchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Accessory name must be unique'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Accessory', accessorySchema);