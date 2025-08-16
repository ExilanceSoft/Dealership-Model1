// utils/initializeRoles.js
'use strict';

/**
 * Initializes baseline roles using the current Permission catalog.
 * - SUPERADMIN: gets ALL active permissions
 * - ADMIN: gets READ/CREATE/UPDATE (no DELETE)
 *
 * FINAL: Upserts without targeting the same path in both $setOnInsert and $set.
 * Works with schemas using either `is_active` or `isActive`.
 */

const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');

function toId(v) {
  if (!v) return null;
  const id = v._id || v.id || v;
  return typeof id === 'string' ? id : String(id);
}

/** Return all permissions considered "active". */
async function fetchActivePermissions() {
  // Treat docs as active if either flag is true OR both flags are absent (legacy)
  const docs = await Permission.find(
    {
      $or: [
        { is_active: true },
        { isActive: true },
        { $and: [{ is_active: { $exists: false } }, { isActive: { $exists: false } }] }
      ]
    },
    { _id: 1, module: 1, action: 1 }
  ).lean();

  // Normalize module/action to uppercase just in case
  return docs.map(d => ({
    _id: toId(d),
    module: String(d.module || '').toUpperCase(),
    action: String(d.action || '').toUpperCase()
  }));
}

/**
 * Upsert a role by name, ensuring it has the given permission IDs.
 * Avoids conflicting operators by NOT setting the same path in both $setOnInsert and $set.
 */
async function upsertRole({ name, description, permissionIds, isActive = true }) {
  const filter = { name: String(name).toUpperCase() };

  // Only fields for brand-new docs (do NOT duplicate in $set)
  const insertDoc = {
    name: filter.name
    // DO NOT include 'description' or 'permissions' or flags here
  };

  // Fields to set/refresh on both new & existing docs
  const update = {
    $setOnInsert: insertDoc,
    $set: {
      description: description || '',
      permissions: permissionIds || [],
      // support both spellings
      is_active: !!isActive,
      isActive: !!isActive
    }
  };

  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: false
  };

  const doc = await Role.findOneAndUpdate(filter, update, options);
  return doc;
}

/**
 * Initialize baseline roles.
 * Returns a summary object for logs/tests.
 */
async function initializeRoles() {
  if (mongoose.connection.readyState !== 1) {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    throw new Error('MongoDB is not connected yet');
  }

  const perms = await fetchActivePermissions();
  if (!perms.length) {
    throw new Error('No active permissions found. Ensure the permission catalog seeding ran successfully.');
  }

  const allPermIds = perms.map(p => p._id);

  // ADMIN gets all non-DELETE actions (READ/CREATE/UPDATE)
  const adminPermIds = perms
    .filter(p => p.action === 'READ' || p.action === 'CREATE' || p.action === 'UPDATE')
    .map(p => p._id);

  const superadmin = await upsertRole({
    name: 'SUPERADMIN',
    description: 'Super admin with all permissions',
    permissionIds: allPermIds,
    isActive: true
  });

  const admin = await upsertRole({
    name: 'ADMIN',
    description: 'Admin role (READ/CREATE/UPDATE across modules)',
    permissionIds: adminPermIds,
    isActive: true
  });

  return {
    roles: {
      SUPERADMIN: { id: toId(superadmin), perms: superadmin.permissions?.length || 0 },
      ADMIN: { id: toId(admin), perms: admin.permissions?.length || 0 }
    },
    totals: {
      permissionsAll: allPermIds.length,
      permissionsAdmin: adminPermIds.length
    }
  };
}

module.exports = { initializeRoles };
