const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Color name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Color name cannot exceed 50 characters']
  },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    trim: true,
    lowercase: true
  },
  models: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model'
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
  }
});

// Indexes
colorSchema.index({ name: 1 });
colorSchema.index({ status: 1 });
colorSchema.index({ models: 1 });

// Handle duplicate key errors
colorSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Color name must be unique'));
  } else {
    next(error);
  }
});

// Middleware to remove color references from models when deleted
colorSchema.pre('remove', async function(next) {
  try {
    await mongoose.model('Model').updateMany(
      { colors: this._id },
      { $pull: { colors: this._id } }
    );
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Color', colorSchema);