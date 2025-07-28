const RtoProcess = require('../models/RtoProcessModel');
const AuditLog = require('../models/AuditLog');

// Create RTO Process
exports.createRtoProcess = async (req, res) => {
  try {
    const data = req.body;

    if (!data.bookingId || !data.chassisNumber || !data.customerName) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, Customer Name and Chassis Number are required'
      });
    }

    const existing = await RtoProcess.findOne({ bookingId: data.bookingId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'RTO record for this booking ID already exists'
      });
    }

    const rto = await RtoProcess.create({ ...data, createdBy: req.user.id });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'RtoProcess',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: data,
      status: 'SUCCESS'
    });

    res.status(201).json({ success: true, data: rto });
  } catch (err) {
    console.error('Error creating RTO:', err);

    await AuditLog.create({
      action: 'CREATE',
      entity: 'RtoProcess',
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


exports.getAllRtoProcesses = async (req, res) => {
  try {
    const rtos = await RtoProcess.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: rtos.length, data: rtos });
  } catch (err) {
    console.error('Error fetching RTOs:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


exports.getRtoProcessById = async (req, res) => {
  try {
    const rto = await RtoProcess.findById(req.params.id);
    if (!rto) {
      return res.status(404).json({ success: false, message: 'RTO not found' });
    }
    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error('Error fetching RTO:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Update RTO Process (only desired fields)
exports.updateRtoProcess = async (req, res) => {
  try {
    const updates = req.body;

    const rto = await RtoProcess.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!rto) {
      return res.status(404).json({ success: false, message: 'RTO not found' });
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'RtoProcess',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: 'SUCCESS'
    });

    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error('Error updating RTO:', err);
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'RtoProcess',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: 'FAILED',
      error: err.message
    });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Delete RTO
exports.deleteRtoProcess = async (req, res) => {
  try {
    const rto = await RtoProcess.findByIdAndDelete(req.params.id);

    if (!rto) {
      return res.status(404).json({ success: false, message: 'RTO not found' });
    }

    await AuditLog.create({
      action: 'DELETE',
      entity: 'RtoProcess',
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { bookingId: rto.bookingId },
      status: 'SUCCESS'
    });

    res.status(200).json({ success: true, message: 'RTO deleted successfully' });
  } catch (err) {
    console.error('Error deleting RTO:', err);
    await AuditLog.create({
      action: 'DELETE',
      entity: 'RtoProcess',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: 'FAILED',
      error: err.message
    });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};