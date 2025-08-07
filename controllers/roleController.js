const Role = require('../models/Role');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Permission = require('../models/Permission');
const mongoose = require('mongoose');
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    // Validate input
    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and permissions array are required' 
      });
    }
    
    // Check if role exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(409).json({ 
        success: false, 
        message: 'Role already exists' 
      });
    }
    
    // Verify the permissions exist
    const permissionsExist = await Permission.find({ _id: { $in: permissions } });
    if (permissionsExist.length !== permissions.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'One or more permissions not found' 
      });
    }

    const role = new Role({
      name,
      description,
      permissions,
      createdBy: req.user.id
    });
    
    await role.save();

    // Log the role creation
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Role',
      entityId: role._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { name, permissions }
    });

    res.status(201).json({ 
      success: true, 
      data: role 
    });
  } catch (err) {
    console.error('Error creating role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating role',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.getRoles = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const filter = {};
    
    if (includeInactive !== 'true') {
      filter.is_active = true;
    }
    
    const roles = await Role.find(filter).select('-__v');
    res.status(200).json({ 
      success: true, 
      data: roles 
    });
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching roles' 
    });
  }
};
exports.getRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).select('-__v');
    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found' 
      });
    }
    res.status(200).json({ 
      success: true, 
      data: role 
    });
  } catch (err) {
    console.error('Error fetching role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching role' 
    });
  }
};
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, is_active } = req.body;
    
    // Validate input
    if (!name && !description && !permissions && typeof is_active === 'undefined') {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one field to update is required' 
      });
    }
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found' 
      });
    }
    
    // Check if trying to update super admin role
    if (role.isSuperAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'SuperAdmin role cannot be modified' 
      });
    }
    
    // Update fields
    if (name) role.name = name;
    if (description) role.description = description;
    if (permissions) role.permissions = permissions;
    if (typeof is_active !== 'undefined') role.is_active = is_active;
    
    role.updatedBy = req.user.id;
    await role.save();

    // Log the role update
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Role',
      entityId: role._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        name: role.name,
        permissions: role.permissions,
        is_active: role.is_active
      }
    });

    res.status(200).json({ 
      success: true, 
      data: role 
    });
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating role' 
    });
  }
};
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found' 
      });
    }
    
    // Check if trying to delete super admin role
    if (role.isSuperAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'SuperAdmin role cannot be deleted' 
      });
    }
    
    // Check if any user has this role assigned
    const usersWithRole = await User.countDocuments({ roles: id });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete role as it is assigned to users' 
      });
    }
    
    // Soft delete by marking as inactive
    role.is_active = false;
    role.updatedBy = req.user.id;
    await role.save();

    // Log the role deletion
    await AuditLog.create({
      action: 'DELETE',
      entity: 'Role',
      entityId: role._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        name: role.name
      }
    });

    res.status(200).json({ 
      success: true, 
      message: 'Role deactivated successfully' 
    });
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting role' 
    });
  }
};
exports.assignRole = async (req, res) => {
  try {
    const { userId, roleId } = req.body;
    
    // Validate input
    if (!userId || !roleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and Role ID are required' 
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if role exists and is active
    const role = await Role.findOne({ _id: roleId, is_active: true });
    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found or inactive' 
      });
    }
    
    // Check if user already has this role
    if (user.roles.includes(roleId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already has this role' 
      });
    }
    
    // Assign role
    user.roles.push(roleId);
    await user.save();

    // Log the role assignment
    await AuditLog.create({
      action: 'ASSIGN',
      entity: 'Role',
      entityId: role._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        assignedTo: userId,
        roleName: role.name 
      }
    });

    const updatedUser = await User.findById(userId)
      .populate('roles')
      .select('-otp -otpExpires -__v');

    res.status(200).json({ 
      success: true, 
      data: updatedUser 
    });
  } catch (err) {
    console.error('Error assigning role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error assigning role' 
    });
  }
};
exports.assignPermissions = async (req, res) => {
  try {
    const { roleId, permissionIds } = req.body;

    // Validate required fields
    if (!roleId || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: 'roleId and permissionIds are required',
      });
    }

    // Check that all permission IDs are valid and active
    const validPermissions = await Permission.find({
      _id: { $in: permissionIds },
      is_active: true,
    });

    if (validPermissions.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more permissions are invalid or inactive',
      });
    }

    // Assign permissions to the role
    const updatedRole = await Role.findByIdAndUpdate(
      roleId,
      { permissions: permissionIds },
      { new: true, runValidators: false } // Skip schema validation
    );

    if (!updatedRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Permissions assigned successfully',
      data: updatedRole,
    });
  } catch (error) {
    console.error('Error assigning permissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error assigning permissions',
      error: error.message,
    });
  }
};

exports.inheritRole = async (req, res) => {
  try {
    const { roleId, parentRoleId } = req.body;
    
    if (!roleId || !parentRoleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role ID and Parent Role ID are required' 
      });
    }
    
    if (roleId === parentRoleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role cannot inherit from itself' 
      });
    }
    
    const role = await Role.findById(roleId);
    const parentRole = await Role.findById(parentRoleId);
    
    if (!role || !parentRole) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role or parent role not found' 
      });
    }
    
    // Check for circular inheritance
    const checkCircular = async (checkRole, targetId) => {
      if (checkRole.inheritedRoles.includes(targetId)) return true;
      for (const inheritedId of checkRole.inheritedRoles) {
        const inheritedRole = await Role.findById(inheritedId);
        if (await checkCircular(inheritedRole, targetId)) return true;
      }
      return false;
    };
    
    if (await checkCircular(parentRole, roleId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Circular inheritance detected' 
      });
    }
    
    // Add inheritance if not already present
    if (!role.inheritedRoles.includes(parentRoleId)) {
      role.inheritedRoles.push(parentRoleId);
      await role.save();
    }
    
    await AuditLog.create({
      action: 'INHERIT_ROLE',
      entity: 'Role',
      entityId: role._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        parentRole: parentRoleId,
        roleName: role.name,
        parentRoleName: parentRole.name
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Role inheritance added successfully',
      data: role
    });
  } catch (err) {
    console.error('Error inheriting role:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error inheriting role' 
    });
  }
};