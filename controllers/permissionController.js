// const Permission = require('../models/Permission');
// const Role = require('../models/Role');
// const AuditLog = require('../models/AuditLog');
// const { listAllActive } = require('../services/permissionBootstrap');
// // 1. Create new permission (SuperAdmin only)
// exports.createPermission = async (req, res) => {
//   try {
//     // 2. Validate input
//     const { name, description, module, action, category } = req.body;
//     if (!name || !description || !module || !action || !category) {
//       return res.status(400).json({
//         success: false,
//         message: 'All fields are required'
//       });
//     }

//     // 3. Check for existing permission
//     const existing = await Permission.findOne({ name: name.toUpperCase() });
//     if (existing) {
//       return res.status(409).json({
//         success: false,
//         message: 'Permission already exists'
//       });
//     }

//     // 4. Create permission
//     const permission = await Permission.create({
//       name: name.toUpperCase(),
//       description,
//       module: module.toUpperCase(),
//       action: action.toUpperCase(),
//       category: category.toUpperCase(),
//       createdBy: req.user.id
//     });

//     // 5. Log action
//     await AuditLog.create({
//       action: 'CREATE',
//       entity: 'Permission',
//       entityId: permission._id,
//       user: req.user.id,
//       ip: req.ip,
//       metadata: req.body,
//       status: 'SUCCESS'
//     });

//     // 6. Return response
//     res.status(201).json({
//       success: true,
//       data: permission
//     });
//   } catch (err) {
//     // 7. Error handling
//     await AuditLog.create({
//       action: 'CREATE',
//       entity: 'Permission',
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error creating permission',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // 8. Get all permissions (filterable)
// // exports.getPermissions = async (req, res) => {
// //   try {
// //     // 9. Build query
// //     const { module, action, category, search, page = 1, limit = 10 } = req.query;
// //     const query = { is_active: true };
    
// //     if (module) query.module = module.toUpperCase();
// //     if (action) query.action = action.toUpperCase();
// //     if (category) query.category = category.toUpperCase();
// //     if (search) query.$text = { $search: search };

// //     // 10. Pagination options
// //     const options = {
// //       page: parseInt(page),
// //       limit: parseInt(limit),
// //       sort: { module: 1, action: 1 },
// //       populate: 'createdBy'
// //     };
    
// //     // 11. Execute query
// //     const permissions = await Permission.paginate(query, options);
    
// //     // 12. Return response
// //     res.status(200).json({
// //       success: true,
// //       data: permissions
// //     });
// //   } catch (err) {
// //     res.status(500).json({ 
// //       success: false, 
// //       message: 'Error fetching permissions',
// //       error: process.env.NODE_ENV === 'development' ? err.message : undefined
// //     });
// //   }
// // };
// exports.getPermissions = async (req, res) => {
//   try {
//     const items = await listAllActive();
//     res.status(200).json({ success: true, data: items });
//   } catch (e) {
//     res.status(500).json({ success: false, message: e.message });
//   }
// };

// // 13. Update permission (SuperAdmin only)
// exports.updatePermission = async (req, res) => {
//   try {
//     // 14. Validate input
//     const { id } = req.params;
//     const updates = req.body;
    
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid permission ID'
//       });
//     }

//     // 15. Find and update
//     const permission = await Permission.findByIdAndUpdate(id, updates, {
//       new: true,
//       runValidators: true
//     });
    
//     if (!permission) {
//       return res.status(404).json({
//         success: false,
//         message: 'Permission not found'
//       });
//     }
    
//     // 16. Log action
//     await AuditLog.create({
//       action: 'UPDATE',
//       entity: 'Permission',
//       entityId: permission._id,
//       user: req.user.id,
//       ip: req.ip,
//       metadata: updates,
//       status: 'SUCCESS'
//     });
    
//     // 17. Return response
//     res.status(200).json({
//       success: true,
//       data: permission
//     });
//   } catch (err) {
//     await AuditLog.create({
//       action: 'UPDATE',
//       entity: 'Permission',
//       entityId: req.params.id,
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error updating permission',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // 18. Delete permission (soft delete)
// exports.deletePermission = async (req, res) => {
//   try {
//     // 19. Validate input
//     const { id } = req.params;
    
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid permission ID'
//       });
//     }

//     // 20. Soft delete
//     const permission = await Permission.findByIdAndUpdate(id, {
//       is_active: false
//     }, { new: true });
    
//     if (!permission) {
//       return res.status(404).json({
//         success: false,
//         message: 'Permission not found'
//       });
//     }
    
//     // 21. Log action
//     await AuditLog.create({
//       action: 'DELETE',
//       entity: 'Permission',
//       entityId: permission._id,
//       user: req.user.id,
//       ip: req.ip,
//       metadata: { name: permission.name },
//       status: 'SUCCESS'
//     });
    
//     // 22. Return response
//     res.status(200).json({
//       success: true,
//       message: 'Permission deactivated successfully'
//     });
//   } catch (err) {
//     await AuditLog.create({
//       action: 'DELETE',
//       entity: 'Permission',
//       entityId: req.params.id,
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error deleting permission',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // 23. Check user permissions for UI
// exports.checkUserPermissions = async (req, res) => {
//   try {
//     // 24. Get all permissions grouped by module
//     const permissions = await req.user.getAllPermissions();
    
//     const grouped = permissions.reduce((acc, perm) => {
//       if (!acc[perm.module]) {
//         acc[perm.module] = {
//           module: perm.module,
//           actions: [],
//           category: perm.category
//         };
//       }
//       acc[perm.module].actions.push(perm.action);
//       return acc;
//     }, {});
    
//     // 25. Return formatted response
//     res.status(200).json({
//       success: true,
//       data: {
//         isSuperAdmin: await req.user.isSuperAdmin(),
//         permissions: Object.values(grouped)
//       }
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: 'Error checking permissions',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };
// controllers/permissionController.js
const Permission = require('../models/Permission');

/**
 * GET /api/v1/permissions
 * Public read so the frontend can build the permission matrix.
 * Query: ?page=1&limit=1000&module=VEHICLES&search=read
 * Responds with { success: true, data: Permission[] }
 */
exports.getPermissions = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 200);
    const module = req.query.module || undefined;
    const search = req.query.search || undefined;

    // Use the model static (backward compatible). We return the flat array.
    const { items } = await Permission.listAllActive({ page, limit, module, search });

    // Keep response simple for your UI helper (asArray will pick data when it's an array)
    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (err) {
    // Fallback without the static, in case someone removes it later
    try {
      const q = {
        $or: [
          { is_active: true },
          { isActive: true },
          { $and: [{ is_active: { $exists: false } }, { isActive: { $exists: false } }] }
        ]
      };
      const items = await Permission.find(q).sort({ module: 1, action: 1 }).lean();
      return res.status(200).json({ success: true, data: items });
    } catch (e2) {
      return next(err);
    }
  }
};

// (Optional) single read if you use it somewhere
exports.getPermissionById = async (req, res, next) => {
  try {
    const doc = await Permission.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};
