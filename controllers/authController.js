const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { generateOTP, sendOTPSMS } = require('../utils/otpService');
const AuditLog = require('../models/AuditLog');

// Check if SuperAdmin exists
const superAdminExists = async () => {
  const superAdminRole = await Role.findOne({ isSuperAdmin: true });
  if (!superAdminRole) return false;
  
  return await User.exists({ 
    roles: superAdminRole._id,
    isActive: true 
  });
};

// Unified registration endpoint
exports.register = async (req, res) => {
  try {
    const { name, email, mobile, role: roleId, branch } = req.body;

    // Validate input
    if (!name || !email || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and mobile are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number (must be 10 digits starting with 6-9)'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ mobile }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this mobile or email already exists'
      });
    }

    // Determine if system has existing SuperAdmin
    const hasExistingSuperAdmin = await superAdminExists();
    let roleToAssign;

    // Case 1: First user registration (system initialization)
    if (!hasExistingSuperAdmin) {
      // Create SuperAdmin role and assign to first user
      roleToAssign = await Role.findOneAndUpdate(
        { name: 'SUPERADMIN' },
        {
          name: 'SUPERADMIN',
          description: 'System Administrator with full access',
          permissions: ['ALL'],
          isSuperAdmin: true
        },
        { upsert: true, new: true }
      );
    } 
    // Case 2: Subsequent registrations
    else {
      // For all registrations after first user, require authentication
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required for registration'
        });
      }

      // Check if user has registration permission
      const canRegister = req.user.roles.some(role => 
        role.permissions.includes('CAN_REGISTER_USERS') || role.isSuperAdmin
      );

      if (!canRegister) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to register users'
        });
      }

      // Validate role for non-SuperAdmin registrations
      if (!roleId) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      roleToAssign = await Role.findById(roleId);
      if (!roleToAssign) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Prevent non-SuperAdmins from creating SuperAdmins
      if (roleToAssign.isSuperAdmin && !req.user.roles.some(r => r.isSuperAdmin)) {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can create another SuperAdmin'
        });
      }

      // Prevent creating multiple SuperAdmins
      if (roleToAssign.isSuperAdmin) {
        const superAdminCount = await User.countDocuments({
          roles: roleToAssign._id
        });
        
        if (superAdminCount > 0) {
          return res.status(400).json({
            success: false,
            message: 'Only one SuperAdmin is allowed in the system'
          });
        }
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Create user data object
    const userData = {
      name,
      email,
      mobile,
      otp,
      otpExpires,
      roles: [roleToAssign._id]
    };

    // Only add branch if this is not a SuperAdmin
    if (!roleToAssign.isSuperAdmin) {
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch is required for non-SuperAdmin users'
        });
      }
      userData.branch = branch;
    }

    // Create user
    const user = new User(userData);
    await user.save();
    await sendOTPSMS(mobile, otp);

    // Log registration
    await AuditLog.create({
      action: 'REGISTER',
      entity: 'User',
      entityId: user._id,
      user: hasExistingSuperAdmin ? req.user?.id : null,
      ip: req.ip,
      metadata: {
        isSuperAdmin: roleToAssign.isSuperAdmin,
        role: roleToAssign.name,
        ...(!roleToAssign.isSuperAdmin && { branch })
      }
    });

    res.status(201).json({
      success: true,
      message: 'OTP sent to mobile for verification',
      isSuperAdmin: roleToAssign.isSuperAdmin,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: roleToAssign.name,
        ...(!roleToAssign.isSuperAdmin && { branch: user.branch })
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

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
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