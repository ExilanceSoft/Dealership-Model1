const mongoose = require('mongoose');
const Insurance = require('../models/insuranceModel');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const InsuranceProvider = require('../models/InsuranceProvider');

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
      insuranceProvider,
      paymentMode,
      insuranceDate,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      premiumAmount,
      validUptoDate,
      remarks = ''
    } = req.body;

    // Validate required fields
    if (!insuranceProvider || !paymentMode || !policyNumber || !premiumAmount || !validUptoDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: insuranceProvider, paymentMode, policyNumber, premiumAmount, validUptoDate'
      });
    }

    // Check if insurance provider exists
    const provider = await InsuranceProvider.findById(insuranceProvider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance provider'
      });
    }

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

    // Create insurance data (status is automatically set to COMPLETED)
    const insuranceData = {
      booking: bookingId,
      insuranceProvider,
      paymentMode,
      insuranceDate: insuranceDate ? new Date(insuranceDate) : new Date(),
      policyNumber,
      rsaPolicyNumber: rsaPolicyNumber || '',
      cmsPolicyNumber: cmsPolicyNumber || '',
      premiumAmount,
      validUptoDate: new Date(validUptoDate),
      documents,
      remarks,
      createdBy: req.user.id,
      approvedBy: req.user.id // Automatically approved by creator
    };

    // Create new insurance record
    const insurance = await Insurance.create(insuranceData);

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
      insuranceProviderDetails: provider,
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        customer: {
          name: booking.customerDetails.name,
          mobile: booking.customerDetails.mobile1,
          email: booking.customerDetails.email
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
 * @desc    Get all insurances with booking details
 * @route   GET /api/v1/insurance
 * @access  Private (Admin/Manager)
 */
exports.getAllInsurances = async (req, res) => {
  try {
    // For non-superadmins, filter by branch
    const filter = {};
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate({
        path: 'booking',
        select: 'bookingNumber customerDetails chassisNumber model color branch insuranceStatus',
        populate: [
          { path: 'model', select: 'name' },
          { path: 'color', select: 'name code' },
          { path: 'branch', select: 'name' }
        ]
      })
      .populate('insuranceProvider', 'provider_name')
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
      .populate('model', 'model_name')
      .populate('color', 'name code')
      .populate('branch', 'name')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: bookings
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
      .populate('approvedBy', 'name email')
      .populate('insuranceProvider', 'provider_name');

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
      paymentMode: insurance.paymentMode,
      insuranceProvider: insurance.insuranceProvider,
      documents: insurance.documents,
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        model: booking.model,
        color: booking.color,
        customer: {
          name: booking.customerDetails.name,
          mobile: booking.customerDetails.mobile1,
          email: booking.customerDetails.email
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

/**
 * @desc    Get all bookings with their insurance details
 * @route   GET /api/v1/insurance/all-combined
 * @access  Private (Admin/Manager/SuperAdmin)
 */
exports.getAllCombinedBookingInsuranceDetails = async (req, res) => {
  try {
    const { insuranceStatus } = req.query;

    // Build filters
    const bookingFilter = {};
    if (insuranceStatus) {
      bookingFilter.insuranceStatus = insuranceStatus;
    }

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      bookingFilter.branch = req.user.branch;
    }

    // Get all bookings with basic details and populate model name
    const bookings = await Booking.find(bookingFilter)
      .populate({
        path: 'model',
        select: 'name model_name'
      })
      .populate('color', 'name code')
      .populate('branch', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get all insurances for these bookings
    const insurances = await Insurance.find({
      booking: { $in: bookings.map(b => b._id) }
    })
      .populate('insuranceProvider', 'provider_name')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    // Create a map of bookingId to insurance for quick lookup
    const insuranceMap = new Map();
    insurances.forEach(insurance => {
      insuranceMap.set(insurance.booking.toString(), insurance);
    });

    // Combine the data
    const combinedData = bookings.map(booking => {
      const bookingResponse = {
        bookingNumber: booking.bookingNumber,
        chassisNumber: booking.chassisNumber,
        customerDetails: {
          salutation: booking.customerDetails.salutation,
          name: booking.customerDetails.name,
          mobile1: booking.customerDetails.mobile1,
          mobile2: booking.customerDetails.mobile2,
          email: booking.customerDetails.email,
          address: booking.customerDetails.address,
          pincode: booking.customerDetails.pincode
        },
        model: {
          id: booking.model?._id,
          name: booking.model?.model_name
        },
        color: {
          id: booking.color?._id,
          name: booking.color?.name
        },
        branch: {
          id: booking.branch?._id,
          name: booking.branch?.name
        },
        insuranceStatus: booking.insuranceStatus,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      };

      return {
        booking: bookingResponse,
        insurance: insuranceMap.get(booking._id.toString()) || null
      };
    });

    res.status(200).json({
      success: true,
      data: combinedData
    });

  } catch (err) {
    console.error('Error getting combined booking and insurance details:', err);
    
    await AuditLog.create({
      action: 'READ',
      entity: 'Insurance',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error getting combined booking and insurance details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};