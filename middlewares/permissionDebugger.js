const User = require('../models/User');
const Role = require('../models/Role');

const debugUserPermissions = async (userId) => {
  const user = await User.findById(userId)
    .populate('roles')
    .populate('permissions.permission')
    .populate('delegatedAccess.user')
    .populate('delegatedAccess.permissions');

  if (!user) {
    throw new Error('User not found');
  }

  const result = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isSuperAdmin: await user.isSuperAdmin()
    },
    roles: user.roles.map(role => ({
      id: role._id,
      name: role.name,
      isSuperAdmin: role.isSuperAdmin
    })),
    directPermissions: user.permissions.map(p => ({
      permission: p.permission.name,
      module: p.permission.module,
      action: p.permission.action,
      expiresAt: p.expiresAt
    })),
    effectivePermissions: (await user.getAllPermissions()).map(p => ({
      module: p.module,
      action: p.action,
      source: p.source || 'role'
    }))
  };

  console.log('=== Permission Debug Report ===');
  console.log(`User: ${user.name} (${user._id})`);
  console.log(`Super Admin: ${result.user.isSuperAdmin}`);
  console.log('\nRoles:');
  result.roles.forEach(role => {
    console.log(`- ${role.name} ${role.isSuperAdmin ? '(Super Admin)' : ''}`);
  });
  
  console.log('\nDirect Permissions:');
  result.directPermissions.forEach(p => {
    console.log(`- ${p.module}:${p.action} ${p.expiresAt ? `(expires: ${p.expiresAt})` : ''}`);
  });
  
  console.log('\nEffective Permissions:');
  result.effectivePermissions.forEach(p => {
    console.log(`- ${p.module}:${p.action}`);
  });

  return result;
};

module.exports = { debugUserPermissions };