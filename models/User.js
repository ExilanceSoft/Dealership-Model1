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

UserSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

// Add method to check if user is SuperAdmin
UserSchema.methods.isSuperAdmin = async function() {
  await this.populate('roles');
  return this.roles.some(role => role.isSuperAdmin);
};

// Add pre-save hook to validate branch requirement
UserSchema.pre('save', async function(next) {
  try {
    await this.populate('roles');
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