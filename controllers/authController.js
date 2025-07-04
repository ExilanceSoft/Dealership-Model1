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
      isActive: true 
    });
    return !!superAdminUser;
  } catch (error) {
    console.error('Error checking SuperAdmin existence:', error);
    return false;
  }
};

// Unified registration endpoint
// Unified registration endpoint
exports.register = async (req, res) => {
  try {
    const { name, email, mobile, roleId, branch } = req.body;

    // Validation
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

    // First user becomes SuperAdmin
    if (!hasExistingSuperAdmin) {
      roleToAssign = await Role.findOneAndUpdate(
        { name: 'SUPERADMIN' },
        {
          name: 'SUPERADMIN',
          description: 'System Administrator with full access',
          isSuperAdmin: true,
          is_active: true
        },
        { upsert: true, new: true }
      );
    } else {
      // For subsequent registrations - require authentication
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

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Get the requesting user
      requestingUser = await User.findById(decoded.id).populate('roles');
      if (!requestingUser) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if role is provided
      if (!roleId) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      // Validate the role being assigned
      roleToAssign = await Role.findById(roleId);
      if (!roleToAssign) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
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

      // Non-SuperAdmins can't assign SuperAdmin role
      if (roleToAssign.isSuperAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can create another SuperAdmin'
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      mobile,
      roles: [roleToAssign._id],
      branch: !roleToAssign.isSuperAdmin ? branch : undefined
    });

    // Log the registration action if performed by an admin
    if (requestingUser) {
      await AuditLog.create({
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user._id,
        user: requestingUser._id,
        ip: req.ip || req.connection.remoteAddress, // Add IP address here
        details: {
          name: user.name,
          email: user.email,
          role: roleToAssign.name
        }
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await User.findByIdAndUpdate(user._id, {
      otp,
      otpExpires
    });

    await sendOTPSMS(mobile, otp);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. OTP sent for verification.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: roleToAssign.name
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Request OTP
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
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Use findByIdAndUpdate to bypass the save hooks
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
// Verify OTP
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
    }).populate('roles');

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP or expired' 
      });
    }

    // Clear OTP and update user
    user.otp = undefined;
    user.otpExpires = undefined;
    user.lastLogin = new Date();
    
    // Track login IP
    const ip = req.ip || req.connection.remoteAddress;
    if (!user.loginIPs.includes(ip)) {
      user.loginIPs.push(ip);
    }
    
    await user.save();

    // Create token
    const token = jwt.sign(
      { 
        id: user._id, 
        mobile: user.mobile, 
        roles: user.roles.map(r => r.name) 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log the login action
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
        roles: user.roles
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

// Get current user
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