// middlewares/requirePermission.js
const User = require('../models/User');
const Role = require('../models/Role');
const { resolveMixedToIds } = require('../services/permissionBootstrap');

exports.requirePermission = (...requiredKeys) => {
  return async (req, res, next) => {
    try {
      const uid = req.user?._id || req.user?.id;
      if (!uid) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      // Get user with populated permissions
      const user = await User.findById(uid)
        .populate('roles')
        .populate('permissions.permission');
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Check if user is super admin
      if (await user.isSuperAdmin()) {
        return next();
      }

      // Get all effective permissions (from roles + direct permissions)
      const allPermissions = await user.getAllPermissions();
      
      // Convert to Set of "MODULE.ACTION" strings for easy checking
      const allowed = new Set(
        allPermissions.map(p => `${p.module}.${p.action}`.toUpperCase())
      );

      // Check if user has any of the required permissions
      const ok = requiredKeys.some(key => 
        allowed.has(String(key).toUpperCase())
      );
      
      if (!ok) {
        return res.status(403).json({ 
          success: false, 
          message: 'Forbidden (missing permission)' 
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};