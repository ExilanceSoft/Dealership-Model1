const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { generateOTP, sendOTPSMS } = require('../utils/otpService');
const AuditLog = require('../models/AuditLog');

const superAdminExists = async () => {
  try {
    const superAdminRole = await Role.findOne({ isSuperAdmin: true });
    if (!superAdminRole) return false;

    const superAdminUser = await User.findOne({ 
      roles: superAdminRole._id,
      status: 'ACTIVE'
    });
    return !!superAdminUser;
  } catch (error) {
    console.error('Error checking SuperAdmin existence:', error);
    return false;
  }
};

exports.verifyToken = (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, decoded });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token', error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      mobile, 
      roleId, 
      branch, 
      subdealer, 
      discount, 
      permissions,
      totalDeviationAmount,
      perTransactionDeviationLimit
    } = req.body;

    // 1. Validate basics
    if (!name || !email || !mobile) {
      return res.status(400).json({ success: false, message: 'Name, email and mobile are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }
    if (await User.findOne({ $or: [{ mobile }, { email }] })) {
      return res.status(400).json({ success: false, message: 'User with this mobile or email already exists' });
    }

    // 2. Validate role
    if (!roleId) return res.status(400).json({ success: false, message: 'Role ID is required' });
    const roleToAssign = await Role.findOne({ _id: roleId, is_active: true }).populate('permissions');
    if (!roleToAssign) return res.status(404).json({ success: false, message: 'Role not found or inactive' });

    // 3. Validate branch/subdealer relationship
    if (branch && subdealer) {
      return res.status(400).json({ success: false, message: 'User cannot be associated with both branch and subdealer' });
    }

    // 4. Validate deviation amounts for appropriate roles - FIXED
    const allowedDeviationRoles = ['MANAGER'];
    
    // Convert undefined/null values to 0 for comparison
    const totalDeviation = totalDeviationAmount || 0;
    const perTransactionLimit = perTransactionDeviationLimit || 0;

    // Check if any deviation amount is provided (greater than 0)
    const hasDeviationAmounts = totalDeviation > 0 || perTransactionLimit > 0;

    if (hasDeviationAmounts && !allowedDeviationRoles.includes(roleToAssign.name)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Deviation amounts can only be assigned to MANAGER roles' 
      });
    }

    // 5. Validate deviation limits - FIXED
    if (perTransactionLimit > totalDeviation) {
      return res.status(400).json({ 
        success: false, 
        message: 'Per transaction deviation limit cannot exceed total deviation amount' 
      });
    }

    // 6. Create user
    const userData = {
      name,
      email,
      mobile,
      roles: [roleToAssign._id],
      status: 'ACTIVE'
    };

    // Set either branch or subdealer based on role
    if (!roleToAssign.isSuperAdmin) {
      if (branch) {
        userData.branch = branch;
      } else if (subdealer) {
        userData.subdealer = subdealer;
      } else {
        return res.status(400).json({ success: false, message: 'Either branch or subdealer is required for non-superadmin roles' });
      }
    }

    if (discount !== undefined && discount > 0) userData.discount = discount;
    
    // Set deviation amounts if provided - FIXED
    if (totalDeviationAmount !== undefined) userData.totalDeviationAmount = totalDeviation;
    if (perTransactionDeviationLimit !== undefined) userData.perTransactionDeviationLimit = perTransactionLimit;

    const newUser = await User.create(userData);

    // 7. Handle permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const Permission = require('../models/Permission');
      const permissionDocs = await Permission.find({ _id: { $in: permissions }, is_active: true });
      if (permissionDocs.length !== permissions.length) {
        return res.status(400).json({ success: false, message: 'One or more permissions not found or inactive' });
      }

      const grantedById = req.user ? req.user._id : newUser._id;
      newUser.permissions = permissions.map(pid => ({
        permission: pid,
        grantedBy: grantedById,
        expiresAt: null
      }));
      await newUser.save();
    }

    // 8. OTP handling
    const otp = generateOTP();
    await User.findByIdAndUpdate(newUser._id, { otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPSMS(mobile, otp);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. OTP sent for verification.',
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        role: roleToAssign.name,
        branch: newUser.branch,
        subdealer: newUser.subdealer,
        discount: newUser.discount,
        totalDeviationAmount: newUser.totalDeviationAmount,
        perTransactionDeviationLimit: newUser.perTransactionDeviationLimit,
        currentDeviationUsage: newUser.currentDeviationUsage,
        directPermissions: permissions?.length || 0,
        rolePermissions: roleToAssign.permissions.length
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: err.message || 'Registration failed' });
  }
};



exports.requestOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please register first.'
      });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      otp,
      otpExpires
    });

    await sendOTPSMS(mobile, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (err) {
    console.error('Error in OTP request:', err);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP'
    });
  }
};

// ...existing code...
exports.verifyOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile and OTP are required' 
      });
    }

    const user = await User.findOne({ 
      mobile, 
      otp, 
      otpExpires: { $gt: Date.now() } 
    }).populate({
      path: 'roles',
      match: { is_active: true },
      populate: { path: 'permissions' }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP or expired' 
      });
    }

    // Validate each role is active before saving user
    const roles = user.roles;
    const invalidRole = roles.find(role => !role.is_active);
    if (invalidRole) {
      return res.status(400).json({
        success: false,
        message: `Role '${invalidRole.name}' is inactive or invalid.`
      });
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    user.lastLogin = new Date();

    const ip = req.ip || req.connection.remoteAddress;
    if (!user.loginIPs.includes(ip)) {
      user.loginIPs.push(ip);
    }

    await user.save({ validateBeforeSave: false });

    // Get all permissions for the user
    const allPermissions = await user.getAllPermissions();
    
    // Format permissions for frontend
    const formattedPermissions = allPermissions.map(p => ({
      module: p.module,
      action: p.action,
      name: p.name
    }));

    const token = jwt.sign(
      { 
        id: user._id, 
        mobile: user.mobile, 
        roles: roles.map(r => r.name) 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await AuditLog.create({
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id,
      user: user._id,
      ip: req.ip
    });

    res.status(200).json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        roles: roles.map(role => ({
          _id: role._id,
          name: role.name,
          description: role.description,
          isSuperAdmin: role.isSuperAdmin,
          is_active: role.is_active,
          permissions: role.permissions
        })),
        permissions: formattedPermissions 
      }
    });
  } catch (err) {
    console.error('Error in OTP verification:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying OTP'
    });
  }
};
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-otp -otpExpires')
      .populate('roles');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: user 
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching profile' 
    });
  }
};