const mongoose = require('mongoose');

const accessoryCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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
accessoryCategorySchema.index({ name: 1 });
accessoryCategorySchema.index({ status: 1 });

// Virtual for createdBy user details
accessoryCategorySchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Handle duplicate key errors
accessoryCategorySchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Category name must be unique'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('AccessoryCategory', accessoryCategorySchema);