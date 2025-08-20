// config/permissionCatalog.js
module.exports = {
  modules: [
    // Existing modules...
    { key: 'VEHICLES',         category: 'INVENTORY', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'ATTACHMENTS',      category: 'DOCS',      actions: ['READ','CREATE','UPDATE','DELETE'] },
    // { key: 'SALES',            category: 'SALES',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    // { key: 'REPORTS',          category: 'REPORTS',   actions: ['READ'] },

    // From the new route files
    { key: 'PERMISSION',       category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE','MANAGE'] },
    { key: 'QUOTATION',        category: 'SALES',     actions: ['READ','CREATE','UPDATE','DELETE','EXPORT'] },
    { key: 'ROLE',             category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE',] },
    { key: 'RTO_PROCESS',      category: 'REGISTRATION', actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},

    // Updated modules
    { key: 'INSURANCE',        category: 'FINANCE',   actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},
    { key: 'IP_WHITELIST',     category: 'SYSTEM',    actions: ['READ','CREATE','DELETE'] },
    { key: 'KYC',              category: 'COMPLIANCE',actions: [
      'READ','CREATE','UPDATE','DELETE',
      'VERIFY','DOWNLOAD'
    ]},
    { key: 'LEDGER',           category: 'FINANCE',   actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},
    { key: 'MODEL',            category: 'CATALOG',   actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},
    { key: 'NEW_INSURANCE',    category: 'FINANCE',   actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},
    { key: 'OFFER',            category: 'MARKETING', actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},

    // Catalog modules
    { key: 'ACCESSORY',        category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'ACCESSORY_CATEGORY', category: 'CATALOG', actions: [
      'READ','CREATE','UPDATE','DELETE'
    ]},
    { key: 'COLOR',            category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    // { key: 'VEHICLE_MODEL',    category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    // { key: 'VEHICLE_COLOR',    category: 'CATALOG',   actions: ['READ','CREATE','UPDATE','DELETE'] },

    // Other existing modules...
    { key: 'AUDIT_LOG',        category: 'SYSTEM',    actions: ['READ'] },
    { key: 'BANK',             category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'BOOKING',          category: 'SALES',     actions: ['READ','CREATE','UPDATE','DELETE','BOOKING_ACTIONS'] },
    { key: 'BROKER',           category: 'PARTNER',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'BROKER_LEDGER',    category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'BRANCH',           category: 'ORGANIZATION', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CASH_LOCATION',    category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CASH_VOUCHER',     category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CONTRA_VOUCHER',   category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'CSV',              category: 'SYSTEM',    actions: ['READ','CREATE'] },
    { key: 'CUSTOMER',         category: 'CRM',       actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'DECLARATION',      category: 'DOCS',      actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'EMPLOYEE',         category: 'ORGANIZATION', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'EXPENSE_ACCOUNT',  category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCE_DOCUMENT', category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCE_LETTER',   category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCE_PROVIDER', category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'HEADER',           category: 'SYSTEM',    actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'INSURANCE_PROVIDER', category: 'FINANCE', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'INSURANCE_RECEIPT', category: 'FINANCE',  actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'RTO',              category: 'REGISTRATION', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'STOCK_TRANSFER',   category: 'INVENTORY', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'TERMS_CONDITION',  category: 'SYSTEM',    actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'WORKSHOP_RECEIPT', category: 'FINANCE',   actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'VEHICLE_INWARD',   category: 'INVENTORY', actions: ['READ','CREATE','UPDATE','DELETE','APPROVE'] },
    { key: 'USER',             category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE','MANAGE'] },
    { key: 'USER_BUFFER',      category: 'ADMIN',     actions: ['READ','UPDATE'] },
    { key: 'USER_PERMISSIONS', category: 'ADMIN',     actions: ['READ','ASSIGN','DELEGATE'] },
    { key: 'USER_STATUS',      category: 'ADMIN',     actions: ['UPDATE'] },
    { key: 'SUBDEALER',       category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'SUBDEALERMODEL',  category: 'ADMIN',     actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'SUBDEALER_ON_ACCOUNT', category: 'ADMIN', actions: ['READ','CREATE','UPDATE','DELETE'] },
    { key: 'FINANCE_DISBURSEMENT', category: 'FINANCE', actions: ['READ','CREATE','UPDATE','DELETE'] }
  ]
};