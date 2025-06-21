const mongoose = require('mongoose');

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
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  }],
  permissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    },
    expiresAt: Date
  }],
  delegatedAccess: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    }],
    expiresAt: Date
  }],
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  isActive: {
    type: Boolean,
    default: true
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
UserSchema.index({ isActive: 1 });

// Virtual for branch details
UserSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

// Check if user is SuperAdmin
UserSchema.methods.isSuperAdmin = async function() {
  await this.populate('roles');
  return this.roles.some(role => role.isSuperAdmin);
};

// Get all permissions including role and assigned permissions
UserSchema.methods.getAllPermissions = async function() {
  const isSuperAdmin = await this.isSuperAdmin();
  if (isSuperAdmin) {
    return [{
      _id: 'ALL_PERMISSIONS',
      name: 'ALL',
      module: 'ALL',
      action: 'ALL'
    }];
  }

  await this.populate({
    path: 'roles',
    populate: {
      path: 'permissions inheritedRoles'
    }
  }).populate('permissions.permission delegatedAccess.permissions');

  let allPermissions = [];
  
  // Get permissions from roles
  for (const role of this.roles) {
    const rolePermissions = await role.getAllPermissions();
    allPermissions = [...allPermissions, ...rolePermissions];
  }
  
  // Add direct permissions
  const now = new Date();
  const userPermissions = this.permissions
    .filter(p => !p.expiresAt || p.expiresAt > now)
    .map(p => p.permission);
  allPermissions = [...allPermissions, ...userPermissions];
  
  // Add delegated permissions
  const delegatedPermissions = this.delegatedAccess
    .filter(d => !d.expiresAt || d.expiresAt > now)
    .flatMap(d => d.permissions);
  allPermissions = [...allPermissions, ...delegatedPermissions];
  
  // Remove duplicates
  const permissionIds = new Set(allPermissions.map(p => p._id.toString()));
  return allPermissions.filter(p => {
    const duplicate = permissionIds.has(p._id.toString());
    permissionIds.delete(p._id.toString());
    return !duplicate;
  });
};

// Check specific permission
UserSchema.methods.hasPermission = async function(module, action) {
  if (await this.isSuperAdmin()) return true;
  
  const permissions = await this.getAllPermissions();
  return permissions.some(p => 
    p.module === module.toUpperCase() && 
    (p.action === 'ALL' || p.action === action.toUpperCase())
  );
};

// Delegate permissions to another user
UserSchema.methods.delegatePermissions = async function(userId, permissionIds, expiresAt) {
  const User = mongoose.model('User');
  const targetUser = await User.findById(userId);
  if (!targetUser) throw new Error('User not found');
  
  const Permission = mongoose.model('Permission');
  const permissions = await Permission.find({ _id: { $in: permissionIds } });
  if (permissions.length !== permissionIds.length) {
    throw new Error('One or more permissions not found');
  }
  
  this.delegatedAccess.push({
    user: targetUser._id,
    permissions: permissionIds,
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });
  
  await this.save();
};

// Validate branch requirement for non-SuperAdmin users
UserSchema.pre('save', async function(next) {
  try {
    if (this.isModified('roles') || !this.roles) {
      await this.populate('roles');
    }
    const isSuperAdmin = this.roles.some(role => role.isSuperAdmin);
    
    if (!isSuperAdmin && !this.branch) {
      throw new Error('Branch is required for non-SuperAdmin users');
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', UserSchema);