const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: String,
  permissions: [{
    type: String,
    trim: true,
    uppercase: true
  }],
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
RoleSchema.index({ name: 1 });
RoleSchema.index({ isSuperAdmin: 1 });
RoleSchema.index({ is_active: 1 });

module.exports = mongoose.model('Role', RoleSchema);