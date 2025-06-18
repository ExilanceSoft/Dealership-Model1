const { check, query } = require('express-validator');

exports.getAuditLogsValidator = [
  query('action')
    .optional()
    .isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'REGISTER', 'ASSIGN', 'REVOKE'])
    .withMessage('Invalid action type'),
  
  query('entity')
    .optional()
    .isIn(['User', 'Role', 'Permission', 'IP', 'Auth', 'System'])
    .withMessage('Invalid entity type'),
    
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID format'),
    
  query('targetUserId')
    .optional()
    .isMongoId()
    .withMessage('Invalid target user ID format'),
    
  query('status')
    .optional()
    .isIn(['SUCCESS', 'FAILED', 'PENDING'])
    .withMessage('Invalid status'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format (use ISO8601)'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format (use ISO8601)'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sort')
    .optional()
    .matches(/^-?(timestamp|createdAt|action|entity)$/)
    .withMessage('Invalid sort field')
];