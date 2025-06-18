const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

exports.getAuditLogs = async (req, res) => {
  try {
    // Input validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Extract query parameters
    const { 
      action, 
      entity, 
      userId, 
      targetUserId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = '-timestamp'
    } = req.query;

    // Build query
    const query = {};
    
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userId) query.user = userId;
    if (targetUserId) query.targetUser = targetUserId;
    if (status) query.status = status;
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userDetails', 'name email mobile')
        .populate('targetUserDetails', 'name email mobile')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    // Format response
    const formattedLogs = logs.map(log => ({
      id: log._id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      user: log.userDetails,
      targetUser: log.targetUserDetails,
      ip: log.ip,
      userAgent: log.userAgent,
      status: log.status,
      timestamp: log.timestamp,
      metadata: log.metadata,
      createdAt: log.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    logger.error(`Failed to fetch audit logs: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
};

exports.getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('userDetails', 'name email mobile')
      .populate('targetUserDetails', 'name email mobile')
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    // Format response
    const formattedLog = {
      id: log._id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      user: log.userDetails,
      targetUser: log.targetUserDetails,
      ip: log.ip,
      userAgent: log.userAgent,
      status: log.status,
      timestamp: log.timestamp,
      metadata: log.metadata,
      createdAt: log.createdAt
    };

    res.status(200).json({
      success: true,
      data: formattedLog
    });

  } catch (err) {
    logger.error(`Failed to fetch audit log: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log'
    });
  }
};