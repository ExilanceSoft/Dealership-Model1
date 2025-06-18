const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

const sensitiveFields = ['otp', 'token', 'refreshToken'];

exports.logAction = (action, entity) => {
  return async (req, res, next) => {
    try {
      const excludedRoutes = ['/api-docs', '/health', '/audit-logs'];
      if (excludedRoutes.some(route => req.originalUrl.includes(route))) {
        return next();
      }

      const logData = {
        action,
        entity,
        entityId: req.params.id || null,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        status: 'SUCCESS',
        metadata: {
          method: req.method,
          url: req.originalUrl,
          params: req.params,
          query: req.query,
          body: sanitizeRequestData(req.body)
        }
      };

      if (req.user && req.user.id) {
        logData.user = req.user.id;
        
        if (req.params.id && entity === 'User' && req.params.id !== req.user.id) {
          logData.targetUser = req.params.id;
        }
      }

      req.auditLogData = logData;
      
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode >= 400) {
          req.auditLogData.status = 'FAILED';
        }
        originalSend.apply(res, arguments);
      };

      next();
    } catch (err) {
      logger.error(`Audit log setup failed: ${err.message}`);
      next();
    }
  };
};

function sanitizeRequestData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = {...data};
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '******';
    }
  });
  
  return sanitized;
}