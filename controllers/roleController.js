// // controllers/roleController.js
// Complete controller: normalizes permissions, sets createdBy, and avoids conflicting update ops.

const mongoose = require('mongoose');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const { resolveMixedToIds } = require('../services/permissionBootstrap');

// Helpers
const toUpper = (s) => (typeof s === 'string' ? s.trim().toUpperCase() : s);

/**
 * GET /api/v1/roles
 * Query: ?includeInactive=true
 */
exports.getAllRoles = async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const q = includeInactive ? {} : { is_active: true };

    const roles = await Role.find(q)
      .select('-__v')
      .populate({ path: 'permissions', select: 'name module action is_active' })
      .lean();

    res.status(200).json({
      status: 'success',
      results: roles.length,
      data: roles
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/roles/:id
 */
exports.getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id)
      .select('-__v')
      .populate({ path: 'permissions', select: 'name module action is_active' })
      .lean();

    if (!role) {
      return res.status(404).json({ status: 'fail', message: 'Role not found' });
    }
    res.status(200).json({ status: 'success', data: role });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/roles
 * Body: { name, description, is_active?, permissions: [ObjectId | "MODULE.ACTION"] }
 * Requires: req.user set by protect() because createdBy is required by schema.
 */
exports.createRole = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    }

    const name = toUpper(req.body.name);
    const description = (req.body.description || '').trim();
    const is_active = typeof req.body.is_active === 'boolean' ? req.body.is_active : true;

    if (!name) {
      return res.status(400).json({ status: 'fail', message: 'Name is required' });
    }

    // Uniqueness (case-insensitive)
    const exists = await Role.findOne({ name });
    if (exists) {
      return res.status(409).json({ status: 'fail', message: 'Role already exists' });
    }

    // Normalize permissions → active Permission IDs
    const rawPerms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    const permissionIds = await resolveMixedToIds(rawPerms);

    // Optional: strict check – if client sent something but none resolved, block
    if (rawPerms.length > 0 && permissionIds.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'One or more permissions are invalid or inactive'
      });
    }

    const doc = await Role.create({
      name,
      description,
      is_active,
      permissions: permissionIds,
      createdBy: req.user._id
    });

    const populated = await Role.findById(doc._id)
      .populate({ path: 'permissions', select: 'name module action is_active' });

    res.status(201).json({ status: 'success', data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT / PATCH /api/v1/roles/:id
 * Body: { name?, description?, is_active?, permissions?: [ObjectId | "MODULE.ACTION"] }
 */
exports.updateRole = async (req, res, next) => {
  try {
    const roleId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid role id' });
    }

    const body = {};
    if (typeof req.body.name === 'string') body.name = toUpper(req.body.name);
    if (typeof req.body.description === 'string') body.description = req.body.description.trim();
    if (typeof req.body.is_active === 'boolean') body.is_active = req.body.is_active;

    if (Array.isArray(req.body.permissions)) {
      const permissionIds = await resolveMixedToIds(req.body.permissions);
      if (req.body.permissions.length > 0 && permissionIds.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'One or more permissions are invalid or inactive'
        });
      }
      body.permissions = permissionIds;
    }

    // Two-step to avoid conflicting update ops:
    const existing = await Role.findById(roleId);
    if (!existing) {
      return res.status(404).json({ status: 'fail', message: 'Role not found' });
    }

    // Update only changed fields
    if (body.name) existing.name = body.name;
    if (Object.prototype.hasOwnProperty.call(body, 'description')) existing.description = body.description;
    if (Object.prototype.hasOwnProperty.call(body, 'is_active')) existing.is_active = body.is_active;
    if (Object.prototype.hasOwnProperty.call(body, 'permissions')) existing.permissions = body.permissions;

    await existing.save();

    const populated = await Role.findById(existing._id)
      .populate({ path: 'permissions', select: 'name module action is_active' });

    res.status(200).json({ status: 'success', data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/roles/:id
 * Soft delete -> is_active = false
 */
exports.deleteRole = async (req, res, next) => {
  try {
    const roleId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid role id' });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ status: 'fail', message: 'Role not found' });
    }

    role.is_active = false;
    await role.save();

    res.status(200).json({ status: 'success', message: 'Role deactivated' });
  } catch (err) {
    next(err);
  }
};
