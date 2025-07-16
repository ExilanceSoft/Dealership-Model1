// 1. Import mongoose
const mongoose = require('mongoose');

// 2. Define Permission Schema
const PermissionSchema = new mongoose.Schema({
  // 3. Permission name must be unique and uppercase
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [50, 'Permission name cannot exceed 50 characters']
  },
  
  // 4. Description explains what the permission allows
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  
  // 5. Module this permission applies to (e.g., BOOKING, USER)
  module: {
    type: String,
    required: [true, 'Module is required'],
    trim: true,
    uppercase: true,
    maxlength: [30, 'Module name cannot exceed 30 characters']
  },
  
  // 6. Action allowed (CRUD operations + special actions)
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    uppercase: true,
    enum: {
      values: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'APPROVE', 'ALL'],
      message: 'Invalid action type'
    }
  },
  
  // 7. Category for grouping in UI
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['ADMIN', 'SALES', 'INVENTORY', 'FINANCE', 'REPORT', 'SYSTEM'],
      message: 'Invalid category'
    }
  },
  
  // 8. Whether this permission is active
  is_active: {
    type: Boolean,
    default: true
  },
  
  // 9. Whether this permission requires approval
  requires_approval: {
    type: Boolean,
    default: false
  },
  
  // 10. Who created this permission
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  // 11. Add timestamps and virtuals
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 12. Add indexes for faster queries
PermissionSchema.index({ name: 1 });
PermissionSchema.index({ module: 1 });
PermissionSchema.index({ action: 1 });
PermissionSchema.index({ category: 1 });
PermissionSchema.index({ is_active: 1 });

// 13. Create text index for search
PermissionSchema.index({
  name: 'text',
  description: 'text',
  module: 'text'
});

// 14. Export the model
module.exports = mongoose.model('Permission', PermissionSchema);