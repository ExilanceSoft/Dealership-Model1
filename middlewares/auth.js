const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// 1. Authentication Middleware
const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('roles');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

// 2. Authorization Middleware
const authorize = (module, action) => {
  return async (req, res, next) => {
    try {
      // Skip permission check for super admin if desired
      if (req.user.roles.some(r => r.isSuperAdmin)) {
        return next();
      }

      const hasPermission = await req.user.hasPermission(module, action);
      
      if (!hasPermission) {
        await AuditLog.create({
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          entity: module,
          entityId: req.params.id || null,
          user: req.user._id,
          ip: req.ip,
          metadata: {
            attemptedAction: action,
            route: req.originalUrl
          }
        });

        return res.status(403).json({
          success: false,
          message: `Not authorized. Required permission: ${module}:${action}`
        });
      }

      next();
    } catch (err) {
      console.error('Authorization error:', err);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

module.exports = { protect, authorize };