const RtoProcess = require("../models/RtoProcessModel");
const AuditLog = require("../models/AuditLog");
const Booking = require("../models/Booking");

// Create RTO Process
exports.createRtoProcess = async (req, res) => {
  try {
    const { bookingId, applicationNumber } = req.body;

    // Validate required fields
    if (!bookingId || !applicationNumber) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Application Number are required",
      });
    }

    // Validate application number format
    const appNumberRegex = /^[A-Za-z0-9\-\/]+$/;
    if (!appNumberRegex.test(applicationNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application number format",
      });
    }

    const existing = await RtoProcess.findOne({ bookingId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "RTO record for this booking ID already exists",
      });
    }

    const newRtoData = {
      bookingId: bookingId,
      applicationNumber,
      createdBy: req.user.id,
    };

    const rto = await RtoProcess.create(newRtoData);

    await Booking.findByIdAndUpdate(bookingId, { rtoStatus: "completed" });

    await AuditLog.create({
      action: "CREATE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: newRtoData,
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error creating RTO:", err);

    await AuditLog.create({
      action: "CREATE",
      entity: "RtoProcess",
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getAllRtoProcesses = async (req, res) => {
  try {
    const rtos = await RtoProcess.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: rtos.length, data: rtos });
  } catch (err) {
    console.error("Error fetching RTOs:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};


exports.getRtoProcessesWithApplicationNumbers = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      applicationNumber: { $ne: null, $ne: '' } 
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses
    });
  } catch (error) {
    console.error('Error fetching RTO records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getRtoProcessesWithRtoTaxCompleted = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rtoPendingTaxStatus: { $ne: 'Unpaid', $ne: 'N/A' } 
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses
    });
  } catch (error) {
    console.error('Error fetching RTO records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


exports.getRtoProcessesWithRtoPaperStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rtoPendingTaxStatus: { $ne:'Not Submitted', $ne: 'N/A' } 
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses
    });
  } catch (error) {
    console.error('Error fetching RTO records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getRtoProcessesWithHsrpOrderedStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbOrdering: { $ne: false, $ne: 'N/A' } 
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses
    });
  } catch (error) {
    console.error('Error fetching RTO records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


exports.getRtoProcessesWithHsrpInstallationStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbInstallation: { $ne:false, $ne: 'N/A' } 
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses
    });
  } catch (error) {
    console.error('Error fetching RTO records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getRtoProcessById = async (req, res) => {
  try {
    const rto = await RtoProcess.findById(req.params.id);
    if (!rto) {
      return res.status(404).json({ success: false, message: "RTO not found" });
    }
    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error fetching RTO:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
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
      return res.status(404).json({ success: false, message: "RTO not found" });
    }

    await AuditLog.create({
      action: "UPDATE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: "SUCCESS",
    });

    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error updating RTO:", err);
    await AuditLog.create({
      action: "UPDATE",
      entity: "RtoProcess",
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// Delete RTO
exports.deleteRtoProcess = async (req, res) => {
  try {
    const rto = await RtoProcess.findByIdAndDelete(req.params.id);

    if (!rto) {
      return res.status(404).json({ success: false, message: "RTO not found" });
    }

    await AuditLog.create({
      action: "DELETE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { bookingId: rto.bookingId },
      status: "SUCCESS",
    });

    res
      .status(200)
      .json({ success: true, message: "RTO deleted successfully" });
  } catch (err) {
    console.error("Error deleting RTO:", err);
    await AuditLog.create({
      action: "DELETE",
      entity: "RtoProcess",
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
