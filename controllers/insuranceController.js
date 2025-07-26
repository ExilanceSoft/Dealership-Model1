const mongoose = require('mongoose');
const Insurance = require('../models/insuranceModel');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Add insurance details for a booking
 * @route   POST /api/v1/insurance/:bookingId
 * @access  Private (Admin/Manager)
 */
exports.addInsurance = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Check if booking exists and is approved
    const booking = await Booking.findById(bookingId)
      .populate('model', 'name')
      .populate('color', 'name code')
      .populate('branch', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be in APPROVED status to add insurance'
      });
    }

    // Check if insurance already exists for this booking
    const existingInsurance = await Insurance.findOne({ booking: bookingId });
    if (existingInsurance) {
      return res.status(409).json({
        success: false,
        message: 'Insurance already exists for this booking'
      });
    }

    // Process form data
    const {
      insuranceDate,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      premiumAmount,
      validUptoDate,
      remarks = ''
    } = req.body;

    // Process uploaded files
    const documents = [];
    if (req.files) {
      Object.keys(req.files).forEach(key => {
        if (key.startsWith('document')) {
          documents.push({
            url: req.files[key][0].path,
            name: req.files[key][0].originalname,
            type: 'POLICY'
          });
        }
      });
    }

    // Validate required fields
    if (!policyNumber || !premiumAmount || !validUptoDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: policyNumber, premiumAmount, validUptoDate'
      });
    }

    // Create insurance data
    const insuranceData = {
      booking: bookingId,
      insuranceDate: insuranceDate ? new Date(insuranceDate) : new Date(),
      policyNumber,
      rsaPolicyNumber: rsaPolicyNumber || '',
      cmsPolicyNumber: cmsPolicyNumber || '',
      premiumAmount,
      validUptoDate: new Date(validUptoDate),
      documents,
      remarks,
      status: 'PENDING',
      createdBy: req.user.id
    };

    // Create new insurance record
    const insurance = await Insurance.create(insuranceData);

    // Update booking insurance status to PENDING
    booking.insuranceStatus = 'PENDING';
    await booking.save();

    // Log the action
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Insurance',
      entityId: insurance._id,
      user: req.user.id,
      ip: req.ip,
      metadata: insuranceData,
      status: 'SUCCESS'
    });

    // Prepare response with booking details
    const response = {
      ...insurance.toObject(),
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        customer: {
          name: booking.customerName,
          mobile: booking.customerMobile,
          email: booking.customerEmail
        },
        chassisNumber: booking.chassisNumber,
        model: booking.model,
        color: booking.color,
        branch: booking.branch
      }
    };

    res.status(201).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error adding insurance:', err);
    
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Insurance',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error adding insurance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Approve or reject insurance
 * @route   PATCH /api/v1/insurance/:bookingId/approve
 * @access  Private (Admin/Manager)
 */
exports.approveInsurance = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, rejectionReason } = req.body;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Validate status
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be APPROVED or REJECTED'
      });
    }

    // Validate rejection reason if status is REJECTED
    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when status is REJECTED'
      });
    }

    // Find and update insurance
    const insurance = await Insurance.findOneAndUpdate(
      { booking: bookingId },
      {
        status,
        approvedBy: req.user.id,
        approvalDate: new Date(),
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        updatedBy: req.user.id
      },
      { new: true }
    );

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance not found for this booking'
      });
    }

    // Find the booking to update insurance status
    const booking = await Booking.findById(bookingId)
      .populate('model', 'name')
      .populate('color', 'name code')
      .populate('branch', 'name');

    if (booking) {
      booking.insuranceStatus = status === 'APPROVED' ? 'COMPLETED' : 'REJECTED';
      await booking.save();
    }

    // Log the action
    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'Insurance',
      entityId: insurance._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        oldStatus: insurance.status,
        newStatus: status,
        rejectionReason
      },
      status: 'SUCCESS'
    });

    // Prepare response with booking details
    const response = {
      ...insurance.toObject(),
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        customer: {
          name: booking.customerName,
          mobile: booking.customerMobile,
          email: booking.customerEmail
        },
        chassisNumber: booking.chassisNumber,
        model: booking.model,
        color: booking.color,
        branch: booking.branch
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error updating insurance status:', err);
    
    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'Insurance',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error updating insurance status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get all insurances with booking details
 * @route   GET /api/v1/insurance
 * @access  Private (Admin/Manager)
 */
exports.getAllInsurances = async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate({
        path: 'booking',
        select: 'bookingNumber customerName customerMobile customerEmail chassisNumber model color branch insuranceStatus',
        populate: [
          { path: 'model', select: 'name' },
          { path: 'color', select: 'name code' },
          { path: 'branch', select: 'name' }
        ]
      })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: insurances
    });

  } catch (err) {
    console.error('Error getting insurances:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching insurances',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get completed insurances
 * @route   GET /api/v1/insurance/completed
 * @access  Private (Admin/Manager)
 */
exports.getCompletedInsurances = async (req, res) => {
  try {
    const filter = { status: 'APPROVED' };

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate({
        path: 'booking',
        select: 'bookingNumber customerName customerMobile customerEmail chassisNumber model color branch insuranceStatus',
        populate: [
          { path: 'model', select: 'name' },
          { path: 'color', select: 'name code' },
          { path: 'branch', select: 'name' }
        ]
      })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: insurances
    });

  } catch (err) {
    console.error('Error getting completed insurances:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching completed insurances',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get pending insurances
 * @route   GET /api/v1/insurance/pending
 * @access  Private (Admin/Manager)
 */
exports.getPendingInsurances = async (req, res) => {
  try {
    const filter = { status: 'PENDING' };

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate({
        path: 'booking',
        select: 'bookingNumber customerName customerMobile customerEmail chassisNumber model color branch insuranceStatus',
        populate: [
          { path: 'model', select: 'name' },
          { path: 'color', select: 'name code' },
          { path: 'branch', select: 'name' }
        ]
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: insurances
    });

  } catch (err) {
    console.error('Error getting pending insurances:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pending insurances',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get rejected insurances
 * @route   GET /api/v1/insurance/rejected
 * @access  Private (Admin/Manager)
 */
exports.getRejectedInsurances = async (req, res) => {
  try {
    const filter = { status: 'REJECTED' };

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate({
        path: 'booking',
        select: 'bookingNumber customerName customerMobile customerEmail chassisNumber model color branch insuranceStatus',
        populate: [
          { path: 'model', select: 'name' },
          { path: 'color', select: 'name code' },
          { path: 'branch', select: 'name' }
        ]
      })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: insurances
    });

  } catch (err) {
    console.error('Error getting rejected insurances:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching rejected insurances',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get bookings awaiting insurance
 * @route   GET /api/v1/insurance/awaiting
 * @access  Private (Admin/Manager)
 */
exports.getBookingsAwaitingInsurance = async (req, res) => {
  try {
    const filter = {
      status: 'APPROVED',
      insuranceStatus: 'AWAITING'
    };

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      filter.branch = req.user.branch;
    }

    const bookings = await Booking.find(filter)
      .populate('model', 'name')
      .populate('color', 'name code')
      .populate('branch', 'name')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .sort({ createdAt: 1 });

    // Get insurance details for each booking
    const bookingsWithInsurance = await Promise.all(
      bookings.map(async (booking) => {
        const insurance = await Insurance.findOne({ booking: booking._id })
          .select('status policyNumber premiumAmount validUptoDate');

        return {
          ...booking.toObject(),
          insuranceDetails: insurance || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: bookingsWithInsurance
    });

  } catch (err) {
    console.error('Error getting bookings awaiting insurance:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings awaiting insurance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get insurance details by chassis number
 * @route   GET /api/v1/insurance/:chassisNumber
 * @access  Private (Admin/Manager/Sales Executive)
 */
exports.getInsuranceByChassisNumber = async (req, res) => {
  try {
    const { chassisNumber } = req.params;

    // Validate chassis number format (basic validation)
    if (!chassisNumber || chassisNumber.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid chassis number (minimum 5 characters)'
      });
    }

    // Find booking with this chassis number
    const booking = await Booking.findOne({ 
      chassisNumber: { $regex: new RegExp(chassisNumber, 'i') } 
    })
    .populate('model', 'name')
    .populate('color', 'name code')
    .populate('branch', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'No booking found with this chassis number'
      });
    }

    // Find insurance details for this booking
    const insurance = await Insurance.findOne({ booking: booking._id })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'No insurance details found for this booking',
        bookingStatus: booking.insuranceStatus
      });
    }

    // Format the response
    const response = {
      insuranceId: insurance._id,
      policyNumber: insurance.policyNumber,
      status: insurance.status,
      insuranceDate: insurance.insuranceDate,
      validUptoDate: insurance.validUptoDate,
      premiumAmount: insurance.premiumAmount,
      documents: insurance.documents,
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        model: booking.model,
        color: booking.color,
        customer: {
          name: booking.customerName,
          mobile: booking.customerMobile,
          email: booking.customerEmail
        },
        chassisNumber: booking.chassisNumber,
        branch: booking.branch
      },
      createdBy: insurance.createdBy,
      approvedBy: insurance.approvedBy,
      approvalDate: insurance.approvalDate
    };

    // Log successful access
    await AuditLog.create({
      action: 'READ',
      entity: 'Insurance',
      entityId: insurance._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { chassisNumber },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error fetching insurance by chassis number:', err);
    
    await AuditLog.create({
      action: 'READ',
      entity: 'Insurance',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: { chassisNumber: req.params.chassisNumber },
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching insurance details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};