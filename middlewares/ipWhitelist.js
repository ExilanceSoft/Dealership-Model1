const IpWhitelist = require('../models/IpWhitelist');
const logger = require('../config/logger');

exports.checkIP = async (req, res, next) => {
  // Skip IP check for localhost in development
  if (process.env.NODE_ENV === 'development' && 
      ['::1', '127.0.0.1'].includes(req.ip)) {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const ipExists = await IpWhitelist.findOne({ ip: clientIP });
    
    if (!ipExists) {
      logger.warn(`IP access denied: ${clientIP}`);
      return res.status(403).json({
        success: false,
        message: `IP address ${clientIP} is not whitelisted`
      });
    }
    
    next();
  } catch (err) {
    logger.error(`IP whitelist check error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error during IP verification'
    });
  }
};