const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  // 1. Role name must be unique
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [30, 'Role name cannot exceed 30 characters']
  },
  
  // 2. Description explains the role's purpose
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  
  // 3. Permissions assigned to this role
  permissions: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Permission',
  validate: {
    validator: async function(permissionIds) {
      const count = await mongoose.model('Permission').countDocuments({ 
        _id: { $in: permissionIds },
        is_active: true
      });
      return count === permissionIds.length;
    },
    message: 'One or more permissions are invalid or inactive'
  }
}],
  
  // 4. Roles this role inherits from
  inheritedRoles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    validate: {
      validator: async function(roleIds) {
        if (roleIds.includes(this._id)) return false; // Prevent self-inheritance
        const count = await mongoose.model('Role').countDocuments({ 
          _id: { $in: roleIds },
          is_active: true
        });
        return count === roleIds.length;
      },
      message: 'One or more roles are invalid, inactive, or circular reference'
    }
  }],
  
  // 5. System roles cannot be modified
  isSystemRole: {
    type: Boolean,
    default: false
  },
  
  // 6. SuperAdmin role has all permissions
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  
  // 7. Whether the role is active
  is_active: {
    type: Boolean,
    default: true
  },
  
  // 8. Who created this role
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 9. Who last updated this role
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  // 10. Add timestamps and virtuals
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 11. Method to get all permissions (including inherited)
RoleSchema.methods.getAllPermissions = async function() {
  if (this.isSuperAdmin) {
    return [{ 
      _id: 'ALL_PERMISSIONS',
      name: 'ALL',
      module: 'ALL',
      action: 'ALL',
      category: 'SYSTEM'
    }];
  }

  const directPermissions = await mongoose.model('Permission')
    .find({ _id: { $in: this.permissions }, is_active: true })
    .lean();

  let inheritedPermissions = [];
  if (this.inheritedRoles && this.inheritedRoles.length > 0) {
    const roles = await mongoose.model('Role')
      .find({ _id: { $in: this.inheritedRoles }, is_active: true });
    
    for (const role of roles) {
      const permissions = await role.getAllPermissions();
      inheritedPermissions = [...inheritedPermissions, ...permissions];
    }
  }

  const allPermissions = [...directPermissions, ...inheritedPermissions];
  const uniquePermissions = [];
  const seen = new Set();

  for (const perm of allPermissions) {
    if (!seen.has(perm._id.toString())) {
      seen.add(perm._id.toString());
      uniquePermissions.push(perm);
    }
  }

  return uniquePermissions;
};

// 16. Check if role has specific permission
RoleSchema.methods.hasPermission = async function(module, action) {
  if (this.isSuperAdmin) return true;
  
  const permissions = await this.getAllPermissions();
  return permissions.some(p => 
    p.module === module.toUpperCase() && 
    (p.action === 'ALL' || p.action === action.toUpperCase())
  );
};

// 17. Indexes for performance
RoleSchema.index({ name: 1 });
RoleSchema.index({ isSuperAdmin: 1 });
RoleSchema.index({ is_active: 1 });
RoleSchema.index({ isSystemRole: 1 });

// 18. Prevent modification of system roles
RoleSchema.pre('save', async function(next) {
  if (this.isSystemRole && this.isModified()) {
    throw new Error('System roles cannot be modified');
  }
  next();
});
// Add to RoleSchema after existing code
RoleSchema.pre('save', async function(next) {
  if (this.isModified('inheritedRoles')) {
    // 1. Prevent self-inheritance
    if (this.inheritedRoles.some(id => id.equals(this._id))) {
      throw new Error('Role cannot inherit from itself');
    }

    // 2. Verify all inherited roles exist
    const existingRoles = await Role.countDocuments({
      _id: { $in: this.inheritedRoles },
      is_active: true
    });
    
    if (existingRoles !== this.inheritedRoles.length) {
      throw new Error('One or more inherited roles are invalid or inactive');
    }

    // 3. Check for circular inheritance
    const checkCircular = async (roleId, targetId) => {
      const role = await Role.findById(roleId);
      if (role.inheritedRoles.some(id => id.equals(targetId))) {
        return true;
      }
      
      for (const inheritedId of role.inheritedRoles) {
        if (await checkCircular(inheritedId, targetId)) {
          return true;
        }
      }
      return false;
    };

    for (const inheritedId of this.inheritedRoles) {
      if (await checkCircular(inheritedId, this._id)) {
        throw new Error('Circular role inheritance detected');
      }
    }
  }
  next();
});

// Add this method to check effective permissions
RoleSchema.methods.getEffectivePermissions = async function() {
  const directPermissions = await Permission.find({
    _id: { $in: this.permissions },
    is_active: true
  });

  let inheritedPermissions = [];
  
  for (const roleId of this.inheritedRoles) {
    const role = await Role.findById(roleId);
    if (role) {
      const permissions = await role.getEffectivePermissions();
      inheritedPermissions = [...inheritedPermissions, ...permissions];
    }
  }

  const allPermissions = [...directPermissions, ...inheritedPermissions];
  const uniquePermissions = [];
  const seen = new Set();

  for (const perm of allPermissions) {
    const permId = perm._id.toString();
    if (!seen.has(permId)) {
      seen.add(permId);
      uniquePermissions.push(perm);
    }
  }

  return uniquePermissions;
};
// 19. Export the model
module.exports = mongoose.model('Role', RoleSchema);