const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Helper function to get user query projection
const getUserProjection = {
  '-otp': 1,
  '-otpExpires': 1,
  '-__v': 1
};

exports.getUsers = async (req, res) => {
  try {
    // For SuperAdmin, get all users
    // For others, only get users from their branch
    const query = req.user.isSuperAdmin() ? {} : { branch: req.user.branch };
    
    const users = await User.find(query)
      .select(getUserProjection)
      .populate('roles')
      .populate('branchDetails');
      
    res.status(200).json({ 
      success: true, 
      data: users 
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getUser = async (req, res) => {
  try {
    // For non-SuperAdmins, verify the requested user is from their branch
    if (!req.user.isSuperAdmin()) {
      const requestedUser = await User.findById(req.params.id);
      if (!requestedUser || requestedUser.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this user'
        });
      }
    }
    
    const user = await User.findById(req.params.id)
      .select(getUserProjection)
      .populate('roles')
      .populate('branchDetails');
      
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
    console.error('Error fetching user:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields
    delete updates.roles;
    delete updates.otp;
    delete updates.otpExpires;
    delete updates.isActive;

    // For non-SuperAdmins, verify the user being updated is from their branch
    if (!req.user.isSuperAdmin()) {
      const targetUser = await User.findById(id);
      if (!targetUser || targetUser.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this user'
        });
      }
      
      // Prevent branch change for non-SuperAdmins
      if (updates.branch && updates.branch !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to change user branch'
        });
      }
    }

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
    .select(getUserProjection)
    .populate('roles')
    .populate('branchDetails');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Log the update action
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'User',
      entityId: user._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates
    });
    
    res.status(200).json({ 
      success: true, 
      data: user 
    });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot delete yourself' 
      });
    }
    
    // For non-SuperAdmins, verify the user being deleted is from their branch
    if (!req.user.isSuperAdmin()) {
      const targetUser = await User.findById(id);
      if (!targetUser || targetUser.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this user'
        });
      }
    }
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Log the deletion action
    await AuditLog.create({
      action: 'DELETE',
      entity: 'User',
      entityId: id,
      user: req.user.id,
      ip: req.ip
    });
    
    res.status(200).json({ 
      success: true, 
      data: {} 
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};