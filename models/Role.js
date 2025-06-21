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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  inheritedRoles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
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

// Virtual for all permissions including inherited ones
RoleSchema.methods.getAllPermissions = async function() {
  if (this.isSuperAdmin) {
    return [{
      _id: 'ALL_PERMISSIONS',
      name: 'ALL',
      module: 'ALL',
      action: 'ALL'
    }];
  }

  await this.populate('permissions inheritedRoles');
  
  let allPermissions = [...this.permissions];
  
  for (const role of this.inheritedRoles) {
    const inheritedPermissions = await role.getAllPermissions();
    allPermissions = [...allPermissions, ...inheritedPermissions];
  }
  
  // Remove duplicates
  const permissionIds = new Set(allPermissions.map(p => p._id.toString()));
  return allPermissions.filter(p => {
    const duplicate = permissionIds.has(p._id.toString());
    permissionIds.delete(p._id.toString());
    return !duplicate;
  });
};

// Indexes
RoleSchema.index({ name: 1 });
RoleSchema.index({ isSuperAdmin: 1 });
RoleSchema.index({ is_active: 1 });

module.exports = mongoose.model('Role', RoleSchema);