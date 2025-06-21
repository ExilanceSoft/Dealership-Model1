const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: String,
  module: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  action: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'ALL']
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Permission', PermissionSchema);