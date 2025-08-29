const mongoose = require('mongoose');
const Role = require('./Role'); 
const Permission = require('./Permission');

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
  
  roles: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Role',
    validate: {
      validator: async function (roles) {
        if (!roles || roles.length === 0) return false;

        const assignedRoles = await Role.find({ _id: { $in: roles } });

        if (assignedRoles.length !== roles.length) {
          throw new Error('One or more roles are invalid');
        }

        for (let role of assignedRoles) {
          if (!role.is_active) {
            throw new Error('One or more roles are inactive');
          }
        }

        if (this._isCreatingBySuperAdmin) return true;

        const containsSystemRole = assignedRoles.some(role => role.isSuperAdmin);
        if (containsSystemRole) {
          throw new Error('You lack permission to assign system roles');
        }

        return true;
      },
      message: 'One or more roles are invalid, inactive, or you lack permission to assign system roles',
    }
  },

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

  // Updated branch/subdealer relationship
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    validate: {
      validator: function() {
        return !this.subdealer; // Ensure not both branch and subdealer are set
      },
      message: 'Cannot be associated with both branch and subdealer'
    }
  },
  subdealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subdealer',
    validate: {
      validator: function() {
        return !this.branch; // Ensure not both branch and subdealer are set
      },
      message: 'Cannot be associated with both branch and subdealer'
    }
  },
  
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

  // Deviation Amount Management
  totalDeviationAmount: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: async function(v) {
        if (v === 0 || !this.roles || this.roles.length === 0) return true;
        
        try {
          const role = await mongoose.model('Role').findById(this.roles[0]).lean();
          return ['MANAGER'].includes(role?.name);
        } catch (err) {
          console.error('Error validating deviation amount:', err);
          return false;
        }
      },
      message: 'Deviation amount can only be assigned to MANAGER users'
    }
  },
  
perTransactionDeviationLimit: {
  type: Number,
  default: 0,
  min: 0,
  validate: {
    validator: function(v) {
      // During updates, this might not reflect the new totalDeviationAmount
      // So we'll handle this in pre-save hook instead
      return true; // Remove validation here, handle in pre-save
    },
    message: 'Per transaction deviation limit cannot exceed total deviation amount'
  }
},
  
  currentDeviationUsage: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return v <= this.totalDeviationAmount;
      },
      message: 'Current deviation usage cannot exceed total deviation amount'
    }
  },

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

  status: {
    type: String,
    enum: ['ACTIVE', 'FROZEN', 'EXTENDED', 'INACTIVE'],
    default: 'ACTIVE'
  },
  lastLogin: Date,
  loginIPs: [String]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ mobile: 1 });
UserSchema.index({ branch: 1 });
UserSchema.index({ subdealer: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ discount: 1 });
UserSchema.index({ totalDeviationAmount: 1 });

// Virtual fields
UserSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

UserSchema.virtual('subdealerDetails', {
  ref: 'Subdealer',
  localField: 'subdealer',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name location type discount' }
});

// Virtual for available deviation amount
UserSchema.virtual('availableDeviationAmount').get(function() {
  return Math.max(0, this.totalDeviationAmount - this.currentDeviationUsage);
});

// Method to check if user can use deviation amount
UserSchema.methods.canUseDeviation = function(amount) {
  if (amount <= 0) return false;
  
  const available = this.availableDeviationAmount;
  const withinPerTransactionLimit = amount <= this.perTransactionDeviationLimit;
  const withinTotalLimit = amount <= available;
  
  return withinPerTransactionLimit && withinTotalLimit;
};

// Method to use deviation amount
UserSchema.methods.useDeviation = async function(amount) {
  if (!this.canUseDeviation(amount)) {
    throw new Error(`Cannot use deviation amount: ${amount}. Available: ${this.availableDeviationAmount}, Per transaction limit: ${this.perTransactionDeviationLimit}`);
  }
  
  this.currentDeviationUsage += amount;
  await this.save();
  return this.availableDeviationAmount;
};

// Method to reset deviation usage
UserSchema.methods.resetDeviationUsage = async function() {
  this.currentDeviationUsage = 0;
  await this.save();
  return this.availableDeviationAmount;
};

// Method to update deviation limits
UserSchema.methods.updateDeviationLimits = async function(totalAmount, perTransactionLimit) {
  if (perTransactionLimit > totalAmount) {
    throw new Error('Per transaction limit cannot exceed total deviation amount');
  }
  
  if (this.currentDeviationUsage > totalAmount) {
    throw new Error('Current deviation usage exceeds new total amount');
  }
  
  this.totalDeviationAmount = totalAmount;
  this.perTransactionDeviationLimit = perTransactionLimit;
  
  await this.save();
  return this;
};

UserSchema.methods.isSuperAdmin = async function() {
  await this.populate('roles');
  return this.roles.some(role => role.isSuperAdmin);
};

UserSchema.methods.isSuperAdminByRole = async function () {
  const roles = this.roles || [];
  if (!roles.length) return false;

  // If already populated, cheap check:
  if (this.populated && this.populated('roles')) {
    return roles.some(r =>
      r && r.is_active !== false && String(r.name || '').toUpperCase() === 'SUPERADMIN'
    );
  }

  const roleIds = roles.map(r => (r && r._id) ? r._id : r);
  const count = await Role.countDocuments({
    _id: { $in: roleIds },
    is_active: { $ne: false },
    name: /^superadmin$/i
  });
  return count > 0;
};

UserSchema.methods.listEffectivePermissionIds = async function () {
  const roles = await Role.find({ _id: { $in: (this.roles || []) } })
    .select('permissions is_active')
    .populate({ path: 'permissions', select: '_id' })
    .lean();

  const ids = new Set();
  for (const r of roles) {
    if (!r || r.is_active === false) continue;
    for (const p of (r.permissions || [])) ids.add(String(p?._id || p));
  }
  // user overrides (store as IDs)
  const grants = (this.overrides?.grants || []).map(x => String(x?._id || x));
  const revokes = (this.overrides?.revokes || []).map(x => String(x?._id || x));
  for (const g of grants) ids.add(g);
  for (const rv of revokes) ids.delete(rv);
  return Array.from(ids);
};

UserSchema.methods.getAllPermissions = async function() {
  // SuperAdmin has all permissions
  if (await this.isSuperAdmin()) {
    return [{
      _id: 'ALL_PERMISSIONS',
      name: 'ALL',
      module: 'ALL',
      action: 'ALL',
      category: 'SYSTEM'
    }];
  }

  // Get permissions from all assigned roles
  let rolePermissions = [];
  for (const roleId of this.roles || []) {
    try {
      const role = await mongoose.model('Role').findById(roleId);
      if (role) {
        const permissions = await role.getAllPermissions(true); // Get as documents
        rolePermissions = [...rolePermissions, ...(permissions || [])];
      }
    } catch (err) {
      console.error(`Error getting permissions for role ${roleId}:`, err);
    }
  }

  // Get active direct permissions (not expired)
  const now = new Date();
  const directPermissions = await mongoose.model('Permission').find({
    _id: { 
      $in: (this.permissions || [])
        .filter(p => p?.permission && (!p.expiresAt || p.expiresAt > now))
        .map(p => p.permission)
        .filter(id => id) // Filter out any undefined/null
    },
    is_active: true
  }).lean();

  // Get active delegated permissions (not expired)
  const activeDelegated = (this.delegatedAccess || []).filter(d => 
    d?.expiresAt && d.expiresAt > now && d.permissions
  );
  
  const delegatedPermissions = await mongoose.model('Permission').find({
    _id: { 
      $in: activeDelegated.flatMap(d => 
        (d.permissions || []).map(p => p).filter(id => id)
      ) // Added missing closing bracket here
    },
    is_active: true
  }).lean();

  // Combine and deduplicate all permissions
  const allPermissions = [
    ...(rolePermissions || []),
    ...(directPermissions || []),
    ...(delegatedPermissions || [])
  ];

  const uniquePermissions = [];
  const seen = new Set();

  for (const perm of allPermissions) {
    if (!perm?._id) continue;
    const permId = perm._id.toString();
    if (!seen.has(permId)) {
      seen.add(permId);
      uniquePermissions.push(perm);
    }
  }

  return uniquePermissions;
};

// 17. Method to check specific permission
UserSchema.methods.hasPermission = async function (key) {
  if (await this.isSuperAdminByRole()) return true;

  const k = String(key).toUpperCase();
  // Build effective keys from effective IDs
  const effIds = await this.listEffectivePermissionIds();
  if (!effIds.length) return false;

  const perms = await Permission.find({ _id: { $in: effIds } })
    .select('module action name')
    .lean();

  return perms.some(p => {
    const mod = String(p.module || (p.name || '').split(/[_\.]/)[0] || '').toUpperCase();
    const act = String(p.action || (p.name || '').split(/[_\.]/)[1] || '').toUpperCase();
    return `${mod}.${act}` === k;
  });
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
  
  // Validate deviation amounts
  if (this.isModified('perTransactionDeviationLimit') && 
      this.perTransactionDeviationLimit > this.totalDeviationAmount) {
    return next(new Error('Per transaction deviation limit cannot exceed total deviation amount'));
  }
  
  if (this.isModified('currentDeviationUsage') && 
      this.currentDeviationUsage > this.totalDeviationAmount) {
    return next(new Error('Current deviation usage cannot exceed total deviation amount'));
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
      isSuperAdmin: await user.isSuperAdmin(),
      totalDeviationAmount: user.totalDeviationAmount,
      perTransactionDeviationLimit: user.perTransactionDeviationLimit,
      currentDeviationUsage: user.currentDeviationUsage,
      availableDeviationAmount: user.availableDeviationAmount
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