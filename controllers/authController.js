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

exports.register = async (req, res) => {
  try {
    const { name, email, mobile, roleId, branch, discount } = req.body;

    // Validate required fields
    if (!name || !email || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and mobile are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate mobile format
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ mobile }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this mobile or email already exists'
      });
    }

    // Check if SuperAdmin exists
    const hasExistingSuperAdmin = await superAdminExists();
    let roleToAssign;
    let requestingUser = null;

    if (!hasExistingSuperAdmin) {
      // First user becomes SuperAdmin
      roleToAssign = await Role.findOneAndUpdate(
        { name: 'SUPERADMIN' },
        {
          name: 'SUPERADMIN',
          description: 'System Administrator with full access',
          isSuperAdmin: true,
          isSystemRole: true,
          is_active: true,
          createdBy: null // System-created
        },
        { upsert: true, new: true }
      );
    } else {
      // Validate authorization for subsequent registrations
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header missing'
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token not provided'
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Get requesting user
      requestingUser = await User.findById(decoded.id).populate('roles');
      if (!requestingUser || requestingUser.status !== 'ACTIVE') {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Validate roleId is provided
      if (!roleId) {
        return res.status(400).json({
          success: false,
          message: 'Role ID is required'
        });
      }

      // Get and validate the role to assign
      roleToAssign = await Role.findOne({
        _id: roleId,
        is_active: true
      });
      if (!roleToAssign) {
        return res.status(404).json({
          success: false,
          message: 'Role not found or inactive'
        });
      }

      // Check permissions
      const isSuperAdmin = requestingUser.roles.some(role => role.isSuperAdmin);
      const canRegisterUsers = await requestingUser.hasPermission('USER', 'CREATE');

      if (!isSuperAdmin && !canRegisterUsers) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to register users'
        });
      }

      // Only SuperAdmin can create another SuperAdmin
      if (roleToAssign.isSuperAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can create another SuperAdmin'
        });
      }

      // Validate discount if provided
      if (discount !== undefined) {
        if (typeof discount !== 'number' || discount < 0) {
          return res.status(400).json({
            success: false,
            message: 'Discount must be a positive number'
          });
        }

        if (discount > 0 && roleToAssign.name !== 'SALES_EXECUTIVE') {
          return res.status(400).json({
            success: false,
            message: 'Discount can only be assigned to SALES_EXECUTIVE users'
          });
        }
      }
    }

    // Prepare user data
    const userData = {
      name,
      email,
      mobile,
      roles: [roleToAssign._id],
      branch: !roleToAssign.isSuperAdmin ? branch : undefined,
      createdBy: requestingUser ? requestingUser._id : null,
      status: 'ACTIVE'
    };

    // Add discount if applicable
    if (discount !== undefined && discount > 0) {
      userData.discount = discount;
    }

    // Create user with validation
    const user = await User.create(userData);

    // Log the action if performed by an existing user
    if (requestingUser) {
      await AuditLog.create({
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user._id,
        user: requestingUser._id,
        ip: req.ip || req.connection.remoteAddress,
        details: {
          name: user.name,
          email: user.email,
          role: roleToAssign.name,
          ...(discount && { discount })
        }
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await User.findByIdAndUpdate(user._id, {
      otp,
      otpExpires
    });

    await sendOTPSMS(mobile, otp);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully. OTP sent for verification.',
      isSuperAdmin: !hasExistingSuperAdmin,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: roleToAssign.name,
        ...(discount && { discount })
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    
    let errorMessage = 'Registration failed';
    if (err.name === 'ValidationError') {
      errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
    } else if (err.message.includes('role')) {
      errorMessage = err.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
      match: { is_active: true }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP or expired' 
      });
    }

    // Validate each role is active before saving user
    const roles = await Role.find({ _id: { $in: user.roles } });
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
        roles: roles
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