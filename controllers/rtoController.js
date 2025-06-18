const Rto = require('../models/Rto');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const { sanitizeQueryParams } = require('../utils/helpers');

exports.createRto = async (req, res) => {
  try {
    const rtoData = req.body;
    rtoData.createdBy = req.user.id;

    // Validate branches if provided
    if (rtoData.branches && rtoData.branches.length > 0) {
      const branches = await Branch.find({ _id: { $in: rtoData.branches } });
      if (branches.length !== rtoData.branches.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more branch IDs are invalid'
        });
      }
    }

    // Check for existing RTO code
    const existingRto = await Rto.findOne({ rto_code: rtoData.rto_code });
    if (existingRto) {
      return res.status(400).json({
        success: false,
        message: `RTO with code ${rtoData.rto_code} already exists`
      });
    }

    const rto = await Rto.create(rtoData);

    // Audit log
    await AuditLog.create({
      action: 'CREATE',
      entity: 'RTO',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: rtoData,
      status: 'SUCCESS'
    });

    // Populate branch details in response
    const populatedRto = await Rto.findById(rto._id).populate('branchDetails');

    res.status(201).json({
      success: true,
      data: populatedRto
    });
  } catch (err) {
    console.error('Error creating RTO:', err);
    
    if (err.name === 'DuplicateKeyError' || err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `RTO code ${req.body.rto_code} already exists`
      });
    }

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while creating RTO'
    });
  }
};

exports.getRtos = async (req, res) => {
  try {
    const { state, city, district, isActive, branch } = req.query;
    const filter = {};
    
    if (state) filter.state = { $regex: new RegExp(`^${sanitizeQueryParams(state)}$`, 'i') };
    if (city) filter.city = { $regex: new RegExp(`^${sanitizeQueryParams(city)}$`, 'i') };
    if (district) filter.district = { $regex: new RegExp(`^${sanitizeQueryParams(district)}$`, 'i') };
    if (branch) filter.branches = branch;
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    const rtos = await Rto.find(filter)
      .populate('createdBy', 'name email')
      .populate('branchDetails')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rtos.length,
      data: rtos
    });
  } catch (err) {
    console.error('Error fetching RTOs:', err);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while fetching RTOs'
    });
  }
};

exports.getRto = async (req, res) => {
  try {
    const rto = await Rto.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('branchDetails');

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found with the given ID'
      });
    }

    res.status(200).json({
      success: true,
      data: rto
    });
  } catch (err) {
    console.error('Error fetching RTO:', err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid RTO ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while fetching RTO'
    });
  }
};

exports.updateRto = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent changing RTO code
    if (updates.rto_code) {
      return res.status(400).json({
        success: false,
        message: 'RTO code cannot be changed after creation'
      });
    }

    // Validate branches if provided
    if (updates.branches && updates.branches.length > 0) {
      const branches = await Branch.find({ _id: { $in: updates.branches } });
      if (branches.length !== updates.branches.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more branch IDs are invalid'
        });
      }
    }

    const rto = await Rto.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
    .populate('createdBy', 'name email')
    .populate('branchDetails');

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found with the given ID'
      });
    }

    // Audit log
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
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid RTO ID format'
      });
    }

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while updating RTO'
    });
  }
};

exports.deleteRto = async (req, res) => {
  try {
    const { id } = req.params;

    const rto = await Rto.findByIdAndDelete(id);

    if (!rto) {
      return res.status(404).json({
        success: false,
        message: 'RTO not found with the given ID'
      });
    }

    // Audit log
    await AuditLog.create({
      action: 'DELETE',
      entity: 'RTO',
      entityId: id,
      user: req.user.id,
      ip: req.ip,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: {},
      message: 'RTO deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting RTO:', err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid RTO ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while deleting RTO'
    });
  }
};