// middlewares/requirePermission.js
// Checks if the authenticated user has at least one of the required permissions,
// computed from their assigned roles. No controller changes needed.

const User = require('../models/User');
const Role = require('../models/Role');
const { resolveMixedToIds } = require('../services/permissionBootstrap');

/**
 * requirePermission('BANK.READ') OR requirePermission('BANK.READ', 'BANK.ALL')
 * If any required perm is present in the user's effective set -> allowed.
 *
 * NOTE:
 * - Assumes `protect` has set `req.user` with {_id} or {id}.
 * - Uses Role.permissions (array of Permission ObjectIds).
 * - If you later add direct/delegated perms on User, extend the "allowed" set below.
 */
exports.requirePermission = (...requiredKeys) => {
  return async (req, res, next) => {
    try {
      const uid = req.user?._id || req.user?.id;
      if (!uid) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      const user = await User.findById(uid, { roles: 1 }).lean();
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Load active roles with their permission IDs
      const roles = await Role.find({ _id: { $in: user.roles || [] }, is_active: { $ne: false } }, { permissions: 1 }).lean();

      // Union of permission ObjectIds from roles
      const allowed = new Set();
      for (const r of roles) {
        for (const pid of (r.permissions || [])) {
          allowed.add(String(pid));
        }
      }

      // Resolve requiredKeys ("MODULE.ACTION") to Permission IDs (ensures they exist)
      const neededIds = await resolveMixedToIds(requiredKeys);

      const ok = neededIds.some(id => allowed.has(String(id)));
      if (!ok) {
        return res.status(403).json({ success: false, message: 'Forbidden (missing permission)' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
