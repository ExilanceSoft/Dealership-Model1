// models/Role.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const Permission = require('./Permission');
const { resolveMixedToIds } = require('../services/permissionBootstrap');

/**
 * Role schema:
 * - name: UPPERCASE unique
 * - permissions: [Permission ObjectId] (can be sent as ObjectIds or "MODULE.ACTION"; we normalize)
 * - inherits: optional array of parent roles (if you use role inheritance)
 * - is_active / isActive: support both spellings
 */
const RoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },

    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission', required: true }],

    // Optional inheritance (if you use /roles/inherit). Safe to keep even if unused.
    inherits: [{ type: Schema.Types.ObjectId, ref: 'Role' }],

    is_active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* -------------------------
   Normalization hooks
-------------------------- */

RoleSchema.pre('save', function nextSave(next) {
  if (this.name) this.name = String(this.name).toUpperCase();
  next();
});

/**
 * Before validation:
 * - Normalize `permissions` to ObjectIds
 *   • Accept 24-hex ObjectId strings
 *   • Accept "MODULE.ACTION" keys (resolve via catalog)
 * - De-duplicate
 */
RoleSchema.pre('validate', async function normalizePermissions(next) {
  try {
    if (!Array.isArray(this.permissions)) {
      this.permissions = [];
      return next();
    }

    // Flatten to strings
    const raw = this.permissions.map(v => (v && v._id ? String(v._id) : String(v)));

    const hasKey = raw.some(s => typeof s === 'string' && s.includes('.'));
    const isHex = s => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);

    let ids = raw.filter(isHex);

    // If any key present or any non-hex values, resolve the whole list
    if (hasKey || ids.length !== raw.length) {
      ids = await resolveMixedToIds(raw);
    }
    this.permissions = Array.from(new Set(ids));
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Validator: ensure each Permission exists and is "active".
 * Active means is_active:true OR isActive:true OR (both flags missing → treat as active).
 */
RoleSchema.path('permissions').validate({
  validator: async function (arr) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const ids = arr.map(v => (v && v._id ? v._id : v));

    const count = await Permission.countDocuments({
      _id: { $in: ids },
      $or: [
        { is_active: true },
        { isActive: true },
        { $and: [{ is_active: { $exists: false } }, { isActive: { $exists: false } }] }
      ]
    });

    return count === ids.length;
  },
  message: 'One or more permissions are invalid or inactive'
});

/* -------------------------
   Instance helpers
-------------------------- */

/**
 * getAllPermissions(asDocs=false)
 * Returns the union of this role's permissions plus inherited roles' permissions.
 * - If `asDocs` is false (default): returns array of Permission _id strings
 * - If `asDocs` is true: returns Permission documents (active ones), sorted by module/action
 */
RoleSchema.methods.getAllPermissions = async function getAllPermissions(asDocs = false) {
  // BFS across inheritance graph (if used)
  const visited = new Set();
  const queue = [this._id];

  const roleIds = [];
  while (queue.length) {
    const rid = String(queue.shift());
    if (visited.has(rid)) continue;
    visited.add(rid);
    roleIds.push(rid);

    // Load inherits lazily to avoid heavy populations
    // Only pull inherits field to expand the graph
    // eslint-disable-next-line no-await-in-loop
    const r = await mongoose.model('Role').findById(rid, { inherits: 1 }).lean();
    const parents = (r?.inherits || []).map(x => String(x));
    for (const p of parents) queue.push(p);
  }

  // Gather all permission IDs across these roles
  const roleDocs = await mongoose.model('Role').find(
    { _id: { $in: roleIds } },
    { permissions: 1 }
  ).lean();

  const permIdSet = new Set();
  for (const rd of roleDocs) {
    for (const pid of (rd.permissions || [])) {
      permIdSet.add(String(pid));
    }
  }

  if (!asDocs) return Array.from(permIdSet);

  // Return active Permission docs
  const docs = await Permission.find(
    {
      _id: { $in: Array.from(permIdSet) },
      $or: [
        { is_active: true },
        { isActive: true },
        { $and: [{ is_active: { $exists: false } }, { isActive: { $exists: false } }] }
      ]
    }
  )
    .sort({ module: 1, action: 1 })
    .lean();

  return docs;
};

module.exports = mongoose.model('Role', RoleSchema);
