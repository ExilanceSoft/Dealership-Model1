const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

module.exports = async (req, res, next) => {
  try {
    // Skip if not a booking creation request
    if (req.method !== 'POST' || !req.originalUrl.includes('/bookings')) {
      return next();
    }

    const user = await User.findById(req.user.id).populate('roles');
    if (!user) {
      await AuditLog.create({
        action: 'VALIDATE_SALES_EXECUTIVE',
        entity: 'Booking',
        user: req.user.id,
        ip: req.ip,
        status: 'FAILED',
        error: 'User not found'
      });
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const isSalesExecutive = user.roles.some(r => r.name === 'SALES_EXECUTIVE');
    const isSuperAdmin = user.roles.some(r => r.isSuperAdmin);

    // Super Admins must select a sales executive
    if (isSuperAdmin) {
      if (!req.body.sales_executive) {
        await AuditLog.create({
          action: 'VALIDATE_SALES_EXECUTIVE',
          entity: 'Booking',
          user: req.user.id,
          ip: req.ip,
          status: 'FAILED',
          error: 'Super Admin did not select sales executive'
        });
        return res.status(400).json({
          success: false,
          message: 'Sales executive selection is required for Super Admin'
        });
      }
      return next();
    }

    // Non-Sales Executive users must select a sales executive
    if (!isSalesExecutive) {
      if (!req.body.sales_executive) {
        await AuditLog.create({
          action: 'VALIDATE_SALES_EXECUTIVE',
          entity: 'Booking',
          user: req.user.id,
          ip: req.ip,
          status: 'FAILED',
          error: 'Non-Sales Executive did not select sales executive'
        });
        return res.status(400).json({
          success: false,
          message: 'Sales executive selection is required for your role'
        });
      }
      return next();
    }

    // Sales Executives can create bookings for themselves
    if (!req.body.sales_executive) {
      req.body.sales_executive = req.user.id;
    }
    
    next();
  } catch (err) {
    console.error('Error in validateSalesExecutive middleware:', err);
    await AuditLog.create({
      action: 'VALIDATE_SALES_EXECUTIVE',
      entity: 'Booking',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error during sales executive validation'
    });
  }
};