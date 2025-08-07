const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Offer title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Offer description is required'],
    trim: true,
  },
  image: {
    type: String,
    default: '',
    trim: true,
  },
  url: {
    type: String,
    default: '',
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applyToAllModels: {
    type: Boolean,
    default: false
  },
  applicableModels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model'
  }],
  offerLanguage: {
    type: String,
    required: [true, 'Language is required'],
    enum: ['English', 'Marathi'],
    default: 'English'
  },
  priority: {
    type: Number,
    required: [true, 'Priority number is required'],
    min: [1, 'Priority must be at least 1'],
    default: 1
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

// Update timestamp on save
offerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
offerSchema.index({ title: 'text' });
offerSchema.index({ isActive: 1 });
offerSchema.index({ applyToAllModels: 1 });
offerSchema.index({ offerLanguage: 1 });
offerSchema.index({ priority: 1 });

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;