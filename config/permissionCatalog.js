// config/permissionCatalog.js
module.exports = {
  modules: [
    { key: 'VEHICLES',         category: 'INVENTORY', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'ATTACHMENTS',      category: 'DOCS',      actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'SALES',            category: 'SALES',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'REPORTS',          category: 'REPORTS',   actions: ['READ'] },

    // From your models/routes present in your project
    { key: 'ACCESSORY',        category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'AUDIT_LOG',        category: 'SYSTEM',    actions: ['READ'] },
    { key: 'BANK',             category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'BOOKING',          category: 'SALES',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'BROKER',           category: 'PARTNER',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CASH_LOCATION',    category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'COLOR',            category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CONTRA_VOUCHER',   category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CUSTOMER',         category: 'CRM',       actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'DECLARATION',      category: 'DOCS',      actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCE_DOCUMENT', category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCER',         category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'KYC',              category: 'COMPLIANCE',actions: ['READ','CREATE','UPDATE','DELETE'] },

    // Admin surfaces
    { key: 'USER',             category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'ROLE',             category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE'] }
  ]
};
