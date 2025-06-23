const mongoose = require('mongoose');

const ColorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Color name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Color name cannot exceed 50 characters']
  },
  hexCode: {
    type: String,
    required: [true, 'Hex code is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: props => `${props.value} is not a valid hex color code!`
    }
  },
  models: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    validate: {
      validator: async function(v) {
        const model = await mongoose.model('Model').findById(v).select('_id');
        return model !== null;
      },
      message: props => `Model with ID ${props.value} does not exist`
    }
  }],
  isActive: {
    type: Boolean,
    default: true
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
ColorSchema.index({ name: 1 }, { unique: true });
ColorSchema.index({ isActive: 1 });
ColorSchema.index({ models: 1 });

// Virtual for populated models
ColorSchema.virtual('modelDetails', {
  ref: 'Model',
  localField: 'models',
  foreignField: '_id',
  justOne: false,
  options: { select: 'model_name type status' }
});

// Virtual for createdBy user details
ColorSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Handle duplicate key error
ColorSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Color name must be unique'));
  } else {
    next(error);
  }
});

// Update models when color is updated
ColorSchema.post('findOneAndUpdate', async function(doc) {
  if (!doc) return;
  
  try {
    const Model = mongoose.model('Model');
    const previousDoc = await this.model.findOne(this.getQuery());
    
    if (!previousDoc) return;

    // Find added models
    const addedModels = doc.models.filter(modelId => 
      !previousDoc.models.includes(modelId)
    );
    
    // Find removed models
    const removedModels = previousDoc.models.filter(modelId => 
      !doc.models.includes(modelId)
    );

    // Add color to new models
    if (addedModels.length > 0) {
      await Model.updateMany(
        { _id: { $in: addedModels } },
        { $addToSet: { colors: doc._id } }
      );
    }

    // Remove color from old models
    if (removedModels.length > 0) {
      await Model.updateMany(
        { _id: { $in: removedModels } },
        { $pull: { colors: doc._id } }
      );
    }
  } catch (err) {
    console.error('Error updating model references:', err);
  }
});

module.exports = mongoose.model('Color', ColorSchema);