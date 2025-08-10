// middlewares/normalizePermissions.js
// Converts incoming permissions[] (ObjectIds or "MODULE.ACTION") to valid Permission ObjectIds.

const { resolveMixedToIds } = require('../services/permissionBootstrap');

exports.normalizeRolePermissionsFromCatalog = async (req, res, next) => {
  try {
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and permissions array are required'
      });
    }
    const ids = await resolveMixedToIds(permissions);
    if (!ids.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid permissions resolved from input'
      });
    }
    req.body.permissions = ids; // pass IDs to your existing controller
    next();
  } catch (err) {
    next(err);
  }
};
