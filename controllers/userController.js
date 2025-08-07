const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Permission = require('../models/Permission');
const Role = require("../models/Role");
// const userStatusMiddleware = require('../middlewares/userStatusMiddleware');


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

    // Handle discount validation
    if (updates.discount !== undefined) {
      if (typeof updates.discount !== 'number' || updates.discount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount must be a positive number'
        });
      }

      const targetUser = await User.findById(id).populate('roles');
      
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is SALES_EXECUTIVE
      const isSalesExec = targetUser.roles.some(role => role.name === 'SALES_EXECUTIVE');
      
      if (!isSalesExec) {
        return res.status(400).json({
          success: false,
          message: 'Discount can only be assigned to SALES_EXECUTIVE users'
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

exports.getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // For non-SuperAdmins, verify the requested user is from their branch
    if (!req.user.isSuperAdmin()) {
      const requestedUser = await User.findById(id);
      if (!requestedUser || requestedUser.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this user'
        });
      }
    }
    
    const user = await User.findById(id)
      .select(getUserProjection)
      .populate('roles permissions.permission delegatedAccess.user delegatedAccess.permissions');
      
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Get all effective permissions
    const allPermissions = await user.getAllPermissions();
    
    res.status(200).json({ 
      success: true, 
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        permissions: allPermissions.map(p => ({
          id: p._id,
          name: p.name,
          module: p.module,
          action: p.action
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user permissions',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.assignUserPermissions = async (req, res) => {
  try {
    const { userId, permissionIds, expiresAt } = req.body;
    
    if (!userId || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and permission IDs array are required' 
      });
    }
    
    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Verify the permissions exist
    const permissions = await Permission.find({ _id: { $in: permissionIds } });
    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'One or more permissions not found' 
      });
    }
    
    // Add permissions that aren't already assigned
    const now = new Date();
    const existingPermissions = user.permissions
      .filter(p => !p.expiresAt || p.expiresAt > now)
      .map(p => p.permission.toString());
    
    const newPermissions = permissionIds
      .filter(pid => !existingPermissions.includes(pid.toString()))
      .map(pid => ({
        permission: pid,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }));
    
    if (newPermissions.length > 0) {
      user.permissions = [...user.permissions, ...newPermissions];
      await user.save();
    }
    
    await AuditLog.create({
      action: 'ASSIGN_USER_PERMISSIONS',
      entity: 'User',
      entityId: user._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        targetUser: userId,
        permissions: permissionIds,
        expiresAt,
        count: newPermissions.length
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'User permissions assigned successfully',
      data: user
    });
  } catch (err) {
    console.error('Error assigning user permissions:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error assigning user permissions' 
    });
  }
};

exports.delegatePermissions = async (req, res) => {
  try {
    const { targetUserId, permissionIds, expiresAt } = req.body;
    
    if (!targetUserId || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Target User ID and permission IDs array are required' 
      });
    }
    
    // Verify the target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Target user not found' 
      });
    }
    
    // Verify the permissions exist
    const permissions = await Permission.find({ _id: { $in: permissionIds } });
    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'One or more permissions not found' 
      });
    }
    
    // Check if the current user has these permissions to delegate
    const currentUser = req.user;
    const currentUserPermissions = await currentUser.getAllPermissions();
    const currentUserPermissionIds = currentUserPermissions.map(p => p._id.toString());
    
    const hasAllPermissions = permissionIds.every(pid => 
      currentUserPermissionIds.includes(pid.toString())
    );
    
    if (!hasAllPermissions) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have all the permissions you are trying to delegate' 
      });
    }
    
    // Delegate the permissions
    await currentUser.delegatePermissions(
      targetUserId, 
      permissionIds, 
      expiresAt
    );
    
    await AuditLog.create({
      action: 'DELEGATE_PERMISSIONS',
      entity: 'User',
      entityId: currentUser._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        targetUser: targetUserId,
        permissions: permissionIds,
        expiresAt
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Permissions delegated successfully'
    });
  } catch (err) {
    console.error('Error delegating permissions:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error delegating permissions' 
    });
  }
};

exports.extendBufferTime = async (req, res) => {
  try {
    const { userId, hours, reason } = req.body;

    if (!userId || !hours || !reason) {
      return res.status(400).json({
        success: false,
        message: 'userId, hours and reason are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if requester has permission
    const canExtend = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'USER' && p.action === 'MANAGE'
      )
    );

    if (!canExtend) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to extend buffer times'
      });
    }

    const newBufferTime = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Record the extension
    user.bufferExtensions.push({
      extendedBy: req.user._id,
      newBufferTime,
      reason
    });

    // Update the buffer time
    user.documentBufferTime = newBufferTime;
    
    // Unfreeze if they were frozen
    if (user.isFrozen) {
      user.isFrozen = false;
      user.freezeReason = '';
    }

    await user.save();

    await AuditLog.create({
      action: 'EXTEND_BUFFER_TIME',
      entity: 'User',
      entityId: user._id,
      user: req.user._id,
      ip: req.ip,
      metadata: {
        extendedFor: userId,
        hours,
        reason,
        newBufferTime
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Buffer time extended successfully',
      data: {
        newBufferTime,
        isFrozen: user.isFrozen
      }
    });

  } catch (error) {
    console.error('Error extending buffer time:', error);
    res.status(500).json({
      success: false,
      message: 'Error extending buffer time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getBufferHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('bufferExtensions documentBufferTime isFrozen freezeReason')
      .populate('bufferExtensions.extendedBy', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        currentBufferTime: user.documentBufferTime,
        isFrozen: user.isFrozen,
        freezeReason: user.freezeReason,
        extensions: user.bufferExtensions
      }
    });

  } catch (error) {
    console.error('Error getting buffer history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting buffer history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.extendDocumentDeadline = async (req, res) => {
  try {
    const { additionalHours, reason } = req.body;
    const userId = req.params.id; // Get ID from path parameter
    
    if (!additionalHours) {
      return res.status(400).json({
        success: false,
        message: 'additionalHours is required'
      });
    }

    const isManager = req.user.roles.some(r => ['MANAGER', 'ADMIN'].includes(r.name));
    if (!isManager && !req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to extend deadlines'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const salesExecutiveRole = await Role.findOne({ name: 'SALES_EXECUTIVE' });
    if (!user.roles.some(r => r.equals(salesExecutiveRole._id))) {
      return res.status(400).json({
        success: false,
        message: 'Can only extend deadlines for SALES_EXECUTIVE users'
      });
    }

    const newBufferTime = new Date(Date.now() + (additionalHours * 60 * 60 * 1000));
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        documentBufferTime: newBufferTime,
        isFrozen: false,
        freezeReason: '',
        $push: {
          bufferExtensions: {
            extendedBy: req.user.id,
            newBufferTime,
            reason: reason || 'Extended by manager'
          }
        }
      },
      { new: true }
    );

    await AuditLog.create({
      action: 'EXTEND_DEADLINE',
      entity: 'User',
      entityId: user._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        extendedFor: userId,
        additionalHours,
        newBufferTime,
        reason
      }
    });

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (err) {
    console.error('Error extending document deadline:', err);
    res.status(500).json({
      success: false,
      message: 'Error extending document deadline',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.getFrozenSalesExecutives = async (req, res) => {
  try {
    // First, find the SALES_EXECUTIVE role
    const salesExecutiveRole = await Role.findOne({ name: 'SALES_EXECUTIVE' });
    
    if (!salesExecutiveRole) {
      return res.status(404).json({
        success: false,
        message: 'SALES_EXECUTIVE role not found'
      });
    }

    // For non-SuperAdmins, limit to their branch
    const query = req.user.isSuperAdmin() 
      ? { 
          roles: salesExecutiveRole._id,
          isFrozen: true 
        }
      : { 
          roles: salesExecutiveRole._id,
          isFrozen: true,
          branch: req.user.branch 
        };

    const frozenSalesExecutives = await User.find(query)
      .select(getUserProjection)
      .populate('roles')
      .populate('branchDetails');

    res.status(200).json({
      success: true,
      data: frozenSalesExecutives
    });
  } catch (err) {
    console.error('Error fetching frozen sales executives:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching frozen sales executives',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.unfreezeUser = async (req, res) => {
  try {
    const { userId, reason } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const isManager = req.user.roles.some(r => ['MANAGER', 'ADMIN'].includes(r.name));
    if (!isManager && !req.user.roles.some(r => r.isSuperAdmin)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to unfreeze users'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        isFrozen: false,
        freezeReason: '',
        $push: {
          bufferExtensions: {
            extendedBy: req.user.id,
            reason: reason || 'Manually unfrozen by manager'
          }
        }
      },
      { new: true }
    );

    await AuditLog.create({
      action: 'UNFREEZE_USER',
      entity: 'User',
      entityId: user._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        unfrozenUser: userId,
        reason
      }
    });

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (err) {
    console.error('Error unfreezing user:', err);
    res.status(500).json({
      success: false,
      message: 'Error unfreezing user'
    });
  }
};