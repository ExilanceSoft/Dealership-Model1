const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');
const { checkIP } = require('./ipWhitelist');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later'
});

exports.authLimiter = authLimiter;

exports.protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = await User.findById(decoded.id)
      .select('+loginIPs')
      .populate({
        path: 'roles',
        select: 'name permissions isSuperAdmin'
      });
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // Add isSuperAdmin method to req.user
    req.user.isSuperAdmin = async function() {
      await this.populate('roles');
      return this.roles.some(role => role.isSuperAdmin);
    };
    
    if (process.env.ENABLE_IP_WHITELISTING === 'true') {
      await checkIP(req, res, next);
    } else {
      next();
    }
  } catch (err) {
    logger.error(`JWT verification error: ${err.message}`);
    
    let message = 'Not authorized, token failed';
    if (err.name === 'TokenExpiredError') {
      message = 'Token expired';
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token';
    }
    
    res.status(401).json({
      success: false,
      message
    });
  }
};

exports.hasPermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (req.user.roles.some(role => role.isSuperAdmin)) {
      return next();
    }

    const hasPermission = req.user.roles.some(role => 
      role.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn(`Permission denied for user ${req.user.id} - required ${permission}`);
      return res.status(403).json({
        success: false,
        message: `Not authorized, requires ${permission} permission`
      });
    }

    next();
  };
};

exports.authorize = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const hasRole = req.user.roles.some(role => 
      roles.includes(role.name)
    );

    if (!hasRole) {
      logger.warn(`Role access denied for user ${req.user.id} - required ${roles}`);
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.roles.map(r => r.name)} is not authorized to access this route`
      });
    }
    
    next();
  };
};