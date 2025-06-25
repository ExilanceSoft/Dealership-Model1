const RTO = require('../models/Rto');
const AuditLog = require('../models/AuditLog');

// Create RTO
exports.createRTO = async (req, res) => {
  try {
    const { rto_code, rto_name } = req.body;

    if (!rto_code || !rto_name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both RTO code and name'
      });
    }

    const existingRTO = await RTO.findOne({ rto_code: rto_code.toUpperCase() });
    if (existingRTO) {
      return res.status(400).json({
        success: false,
        message: 'RTO with this code already exists'
      });
    }

    const rto = await RTO.create({
      rto_code: rto_code.toUpperCase(),
      rto_name,
      createdBy: req.user.id
    });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'RTO',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { rto_code: rto.rto_code, rto_name: rto.rto_name },
      status: 'SUCCESS'
    });

    res.status(201).json({
      success: true,
      data: rto
    });
  } catch (err) {
    console.error('Error creating RTO:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'CREATE',
      entity: 'RTO',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get all RTOs
exports.getRTOs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (req.query.status) {
      query.is_active = req.query.status === 'active';
    }
    if (req.query.search) {
      query.$or = [
        { rto_code: { $regex: req.query.search, $options: 'i' } },
        { rto_name: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [rtos, total] = await Promise.all([
      RTO.find(query)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 }),
      RTO.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: rtos.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: rtos
    });
  } catch (err) {
    console.error('Error fetching RTOs:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get single RTO
exports.getRTO = async (req, res) => {
  try {
    const rto = await RTO.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found'
      });
    }

    res.status(200).json({
      success: true,
      data: rto
    });
  } catch (err) {
    console.error('Error fetching RTO:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update RTO
exports.updateRTO = async (req, res) => {
  try {
    const { rto_code, rto_name } = req.body;
    const updates = {};

    if (rto_code) updates.rto_code = rto_code.toUpperCase();
    if (rto_name) updates.rto_name = rto_name;

    if (updates.rto_code) {
      const existingRTO = await RTO.findOne({ 
        rto_code: updates.rto_code,
        _id: { $ne: req.params.id }
      });
      if (existingRTO) {
        return res.status(400).json({
          success: false,
          message: 'RTO with this code already exists'
        });
      }
    }

    const rto = await RTO.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'RTO',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: rto
    });
  } catch (err) {
    console.error('Error updating RTO:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'RTO',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update RTO status
exports.updateRTOStatus = async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const rto = await RTO.findByIdAndUpdate(
      req.params.id,
      { is_active },
      { new: true }
    );

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'RTO',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { is_active },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: `RTO ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: rto
    });
  } catch (err) {
    console.error('Error updating RTO status:', err);
    
    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'RTO',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete RTO
exports.deleteRTO = async (req, res) => {
  try {
    const rto = await RTO.findByIdAndDelete(req.params.id);

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found'
      });
    }

    await AuditLog.create({
      action: 'DELETE',
      entity: 'RTO',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { rto_code: rto.rto_code, rto_name: rto.rto_name },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: { message: 'RTO deleted successfully' }
    });
  } catch (err) {
    console.error('Error deleting RTO:', err);
    
    await AuditLog.create({
      action: 'DELETE',
      entity: 'RTO',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};