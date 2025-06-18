const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Add indexes
PermissionSchema.index({ name: 1 });

module.exports = mongoose.model('Permission', PermissionSchema);