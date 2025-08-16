// services/permissionBootstrap.js
// Seeds Permission docs from a static catalog and normalizes incoming
// permission payloads (accepts ObjectIds or "MODULE.ACTION" keys).
//
// FINAL: Avoids Mongo "ConflictingUpdateOperators" by ensuring NO field is
// targeted in both $setOnInsert and $set within the same upsert.

const Permission = require('../models/Permission');
const catalog = require('../config/permissionCatalog');

/**
 * Ensure a single permission document exists for the given module/action.
 * Upserts on unique "name" = `${MODULE}_${ACTION}` (UPPERCASE).
 */
async function ensureOne(moduleKey, action, category) {
  const name = `${moduleKey}_${action}`.toUpperCase();
  const description = `${action} ${moduleKey}`;

  // Only fields for brand-new docs
  const insertDoc = {
    // IMPORTANT: include only fields that you will NOT also include in $set.
    name,
    module: moduleKey,
    action
    // DO NOT put description or category or flags here (to avoid conflict)
  };

  // Fields we (re)set on every run; these are NOT in $setOnInsert
  const updateOps = {
    $setOnInsert: insertDoc,
    $set: {
      // safe to refresh on existing docs, and used for new docs too
      description,
      category,
      // support both flag spellings
      is_active: true,
      isActive: true
    }
  };

  const options = {
    new: true,
    upsert: true,
    // avoid schema default collisions on insert
    setDefaultsOnInsert: false
  };

  const doc = await Permission.findOneAndUpdate({ name }, updateOps, options);
  return doc;
}

/**
 * Ensure every permission from the catalog exists in the DB.
 */
async function ensureCatalog() {
  const out = [];
  for (const m of catalog.modules) {
    for (const a of m.actions) {
      // eslint-disable-next-line no-await-in-loop
      const doc = await ensureOne(m.key, a, m.category || '');
      out.push(doc);
    }
  }
  return out;
}

/**
 * Accepts a mixed array:
 *   - ObjectIds (24-hex strings)
 *   - "MODULE.ACTION" keys (case-insensitive; normalized to UPPERCASE)
 * Returns de-duplicated array of valid Permission ObjectId strings.
 * Any "MODULE.ACTION" not present will be created from the catalog.
 */
async function resolveMixedToIds(list) {
  if (!Array.isArray(list)) return [];

  const ids = [];
  const keys = [];

  for (const v of list) {
    if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) {
      ids.push(v);
    } else if (typeof v === 'string' && v.includes('.')) {
      keys.push(v.trim().toUpperCase());
    }
  }

  // Validate ObjectId inputs exist & are active (either flag OR legacy none)
  if (ids.length) {
    const found = await Permission.find(
      {
        _id: { $in: ids },
        $or: [
          { is_active: true },
          { isActive: true },
          { $and: [{ is_active: { $exists: false } }, { isActive: { $exists: false } }] }
        ]
      },
      { _id: 1 }
    ).lean();
    const foundSet = new Set(found.map(x => String(x._id)));
    ids.splice(0, ids.length, ...Array.from(foundSet));
  }

  // Ensure each "MODULE.ACTION" key exists based on catalog
  const created = [];
  for (const key of keys) {
    const [moduleKeyRaw, actionRaw] = key.split('.');
    const moduleKey = (moduleKeyRaw || '').toUpperCase();
    const action = (actionRaw || '').toUpperCase();

    const moduleEntry = catalog.modules.find(m => m.key === moduleKey);
    if (!moduleEntry || !moduleEntry.actions.includes(action)) {
      // Unknown to catalog → skip (or throw if you want strict behavior)
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const doc = await ensureOne(moduleEntry.key, action, moduleEntry.category || '');
    created.push(String(doc._id));
  }

  // De-duplicate
  return Array.from(new Set([...ids, ...created]));
}

module.exports = {
  ensureCatalog,
  resolveMixedToIds
};
