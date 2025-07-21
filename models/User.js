const mongoose = require('mongoose');
const Role = require('./Role'); 
// 1. Define User Schema with comprehensive field definitions
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid mobile number!`
    }
  },
  otp: String,
  otpExpires: Date,
  
  // 2. Roles array with validation to ensure active roles
  // Update the roles field validation in UserSchema
  // Update the roles field in UserSchema
// Update the roles field in UserSchema
roles: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Role',
    validate: {
      validator: async function (roles) {
        if (!roles || roles.length === 0) return false;

        // Fetch roles from DB
        const assignedRoles = await Role.find({ _id: { $in: roles } });

        // Check if all provided roles exist
        if (assignedRoles.length !== roles.length) {
          throw new Error('One or more roles are invalid');
        }

        // Check if all roles are active
        for (let role of assignedRoles) {
          if (!role.is_active) {
            throw new Error('One or more roles are inactive');
          }
        }

        // Allow system roles only if marked as created by superadmin
        if (this._isCreatingBySuperAdmin) return true;

        // Prevent assignment of superadmin role unless explicitly allowed
        const containsSystemRole = assignedRoles.some(role => role.isSuperAdmin);
        if (containsSystemRole) {
          throw new Error('You lack permission to assign system roles');
        }

        return true;
      },
      message: 'One or more roles are invalid, inactive, or you lack permission to assign system roles',
    }
  },


  // 3. Direct permissions with grant tracking
  permissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: {
      type: Date,
      validate: {
        validator: function(date) {
          return !date || date > new Date();
        },
        message: 'Expiration date must be in the future'
      }
    }
  }],

  // 4. Delegated access permissions
  delegatedAccess: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permissions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: true
    }],
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      validate: {
        validator: function(date) {
          return date > new Date();
        },
        message: 'Expiration date must be in the future'
      }
    }
  }],

  // 5. Branch association
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  
  // 6. Discount field with role-based validation
  discount: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: async function(v) {
        if (v === 0 || !this.roles || this.roles.length === 0) return true;
        
        try {
          const role = await mongoose.model('Role').findById(this.roles[0]).lean();
          return role?.name === 'SALES_EXECUTIVE';
        } catch (err) {
          console.error('Error validating discount:', err);
          return false;
        }
      },
      message: 'Discount can only be assigned to SALES_EXECUTIVE users'
    }
  },
  
 // Add these fields to the UserSchema
isFrozen: {
  type: Boolean,
  default: false
},
freezeReason: {
  type: String,
  default: ''
},
documentBufferTime: {
  type: Date,
  default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
},
bufferExtensions: [{
  extendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  extendedAt: {
    type: Date,
    default: Date.now
  },
  newBufferTime: Date,
  reason: String
}],

  // 7. Status and tracking fields
  status: {
  type: String,
  enum: ['ACTIVE', 'FROZEN', 'EXTENDED', 'INACTIVE'],
  default: 'ACTIVE'
}
,
  lastLogin: Date,
  loginIPs: [String]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 8. Database indexes for performance optimization
UserSchema.index({ email: 1 });          // Index for email field
UserSchema.index({ mobile: 1 });         // Index for mobile field
UserSchema.index({ branch: 1 });         // Index for branch field
UserSchema.index({ isActive: 1 });       // Index for active status
UserSchema.index({ discount: 1 });       // Index for discount field

// 9. Virtual field for branch details
UserSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

// 10. Method to check if user is SuperAdmin
UserSchema.methods.isSuperAdmin = async function() {
  await this.populate('roles');
  return this.roles.some(role => role.isSuperAdmin);
};

// 11. Method to get all permissions (roles + direct + delegated)
UserSchema.methods.getAllPermissions = async function() {
  // 12. SuperAdmin has all permissions
  if (await this.isSuperAdmin()) {
    return [{
      _id: 'ALL_PERMISSIONS',
      name: 'ALL',
      module: 'ALL',
      action: 'ALL',
      category: 'SYSTEM'
    }];
  }

  // 13. Get permissions from all assigned roles
  let rolePermissions = [];
  for (const roleId of this.roles) {
    const role = await mongoose.model('Role').findById(roleId);
    if (role) {
      const permissions = await role.getAllPermissions();
      rolePermissions = [...rolePermissions, ...permissions];
    }
  }

  // 14. Get active direct permissions (not expired)
  const now = new Date();
  const directPermissions = await mongoose.model('Permission').find({
    _id: { $in: this.permissions.filter(p => !p.expiresAt || p.expiresAt > now)
      .map(p => p.permission) },
    is_active: true
  }).lean();

  // 15. Get active delegated permissions (not expired)
  const activeDelegated = this.delegatedAccess.filter(d => d.expiresAt > now);
  const delegatedPermissions = await mongoose.model('Permission').find({
    _id: { $in: activeDelegated.flatMap(d => d.permissions) },
    is_active: true
  }).lean();

  // 16. Combine and deduplicate all permissions
  const allPermissions = [...rolePermissions, ...directPermissions, ...delegatedPermissions];
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

// 17. Method to check specific permission
UserSchema.methods.hasPermission = async function(module, action) {
  // 18. SuperAdmin always has permission
  if (await this.isSuperAdmin()) return true;
  
  // 19. Normalize input parameters
  const normalizedModule = module.toUpperCase();
  const normalizedAction = action.toUpperCase();
  
  // 20. Get all permissions
  const permissions = await this.getAllPermissions();
  
  // 21. Check for matching permission
  return permissions.some(p => 
    p.module === normalizedModule && 
    (p.action === 'ALL' || p.action === normalizedAction)
  );
};

// 22. Pre-save hook for role validation
UserSchema.pre('save', async function(next) {
  if (this.isModified('roles')) {
    const Role = mongoose.model('Role');
    const roles = await Role.find({ _id: { $in: this.roles } });
    
    // 23. Prevent SuperAdmin from having additional roles
    const hasSuperAdmin = roles.some(r => r.isSuperAdmin);
    if (hasSuperAdmin && this.roles.length > 1) {
      throw new Error('SuperAdmin cannot have additional roles');
    }
  }
  next();
});

// 24. Method to debug permissions
UserSchema.methods.debugPermissions = async function() {
  const user = await this.populate('roles permissions.permission delegatedAccess.user delegatedAccess.permissions');
  
  const result = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isSuperAdmin: await user.isSuperAdmin()
    },
    roles: user.roles.map(role => ({
      id: role._id,
      name: role.name,
      isSuperAdmin: role.isSuperAdmin
    })),
    directPermissions: user.permissions.map(p => ({
      permission: p.permission.name,
      module: p.permission.module,
      action: p.permission.action,
      expiresAt: p.expiresAt
    })),
    effectivePermissions: (await user.getAllPermissions()).map(p => ({
      module: p.module,
      action: p.action,
      source: p.source || 'role'
    }))
  };

  return result;
};

// 25. Export the User model
module.exports = mongoose.model('User', UserSchema);