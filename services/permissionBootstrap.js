// services/permissionBootstrap.js
const Permission = require('../models/Permission');
const catalog = require('../config/permissionCatalog');

async function ensureOne(moduleKey, action, category) {
  const name = `${moduleKey}_${action}`.toUpperCase();
  const update = {
    name,
    description: `${action} ${moduleKey}`,
    module: moduleKey,
    action,
    category,
    is_active: true
  };
  const doc = await Permission.findOneAndUpdate(
    { name },
    { $setOnInsert: update, $set: { is_active: true } },
    { new: true, upsert: true }
  );
  return doc;
}

async function ensureCatalog() {
  const out = [];
  for (const m of catalog.modules) {
    for (const a of m.actions) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await ensureOne(m.key, a, m.category || ''));
    }
  }
  return out;
}

/** Accepts ['MODULE.ACTION', 'ObjectId', ...] -> returns array of valid Permission ObjectIds */
async function resolveMixedToIds(list) {
  if (!Array.isArray(list)) return [];
  const ids = [];
  const keys = [];
  for (const v of list) {
    if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) ids.push(v);
    else if (typeof v === 'string' && v.includes('.')) keys.push(v.trim().toUpperCase());
  }

  // Validate ObjectIds are active
  if (ids.length) {
    const found = await Permission.find({ _id: { $in: ids }, is_active: true }, { _id: 1 }).lean();
    const set = new Set(found.map(x => String(x._id)));
    ids.splice(0, ids.length, ...Array.from(set));
  }

  // Ensure keys exist in DB
  const created = [];
  for (const key of keys) {
    const [moduleKey, actionRaw] = key.split('.');
    const action = (actionRaw || '').toUpperCase();
    const moduleEntry = catalog.modules.find(m => m.key === moduleKey);
    if (!moduleEntry || !moduleEntry.actions.includes(action)) continue;
    // eslint-disable-next-line no-await-in-loop
    const doc = await ensureOne(moduleEntry.key, action, moduleEntry.category || '');
    created.push(String(doc._id));
  }

  return Array.from(new Set([...ids, ...created]));
}

module.exports = { ensureCatalog, resolveMixedToIds };
