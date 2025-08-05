const mongoose = require('mongoose');
const Insurance = require('../models/insuranceModel');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const InsuranceProvider = require('../models/InsuranceProvider');
const Ledger = require('../models/Ledger');
const CashLocation = require('../models/cashLocation');
const Bank = require('../models/Bank');

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

/**
 * @desc    Create ledger entry for insurance premium payment
 * @route   POST /api/v1/insurance/:insuranceId/ledger
 * @access  Private (Admin/Manager)
 */
exports.createInsuranceLedgerEntry = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const { paymentMode, amount, cashLocation, bank, remark } = req.body;
    
    // Validate insurance ID
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    // Find the insurance record (lean query to avoid validation)
    const insurance = await Insurance.findById(insuranceId).lean();

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    // Validate required fields
    if (!paymentMode || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Payment mode and amount are required'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Check if payment would exceed premium amount
    const existingPayments = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    });
    
    const totalPaid = existingPayments.reduce((sum, entry) => sum + entry.amount, 0);
    const remainingAmount = insurance.premiumAmount - totalPaid;
    
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining premium. Maximum allowed: ${remainingAmount}`,
        remainingAmount
      });
    }

    // Validate payment mode specific fields
    if (paymentMode === 'Cash') {
      if (!cashLocation) {
        return res.status(400).json({
          success: false,
          message: 'Cash location is required for cash payments'
        });
      }
      
      // Validate cash location exists
      const cashLoc = await CashLocation.findById(cashLocation);
      if (!cashLoc) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cash location selected'
        });
      }
    } 
    else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode)) {
      if (!bank) {
        return res.status(400).json({
          success: false,
          message: 'Bank is required for non-cash payments'
        });
      }
      
      // Validate bank exists
      const bankExists = await Bank.findById(bank);
      if (!bankExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bank selected'
        });
      }
    }

    // Create ledger entry for insurance payment
    const ledgerEntry = await Ledger.create({
      booking: insurance.booking,
      insurance: insuranceId,
      paymentMode,
      amount,
      receivedBy: req.user.id,
      cashLocation: paymentMode === 'Cash' ? cashLocation : undefined,
      bank: ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode) ? bank : undefined,
      remark: remark || `Insurance premium payment for policy ${insurance.policyNumber}`,
      type: 'INSURANCE_PAYMENT',
      receiptDate: new Date()
    });

    // Update insurance payment status without triggering full validation
    const newTotalPaid = totalPaid + amount;
    const updateData = {
      paymentStatus: newTotalPaid >= insurance.premiumAmount ? 'PAID' : 'PARTIAL',
      updatedBy: req.user.id
    };

    if (newTotalPaid >= insurance.premiumAmount) {
      updateData.paymentCompletedDate = new Date();
    }

    await Insurance.findByIdAndUpdate(insuranceId, updateData, { runValidators: false });

    // Populate the response
    const populatedLedger = await Ledger.findById(ledgerEntry._id)
      .populate('bankDetails')
      .populate('cashLocationDetails')
      .populate('receivedByDetails');

    res.status(201).json({
      success: true,
      data: {
        ledger: populatedLedger,
        insurance: {
          id: insurance._id,
          policyNumber: insurance.policyNumber,
          premiumAmount: insurance.premiumAmount,
          totalPaid: newTotalPaid,
          remainingAmount: insurance.premiumAmount - newTotalPaid,
          paymentStatus: updateData.paymentStatus
        }
      }
    });

  } catch (err) {
    console.error('Error creating insurance ledger entry:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating insurance ledger entry',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
/**
 * @desc    Get insurance ledger history
 * @route   GET /api/v1/insurance/:insuranceId/ledger
 * @access  Private (Admin/Manager)
 */
exports.getInsuranceLedgerHistory = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    
    // Validate insurance ID
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    // Find the insurance record
    const insurance = await Insurance.findById(insuranceId)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('insuranceProvider', 'provider_name')
      .populate('createdBy', 'name email');

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    // Get all ledger entries for this insurance
    const ledgerEntries = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    })
    .populate('bankDetails')
    .populate('cashLocationDetails')
    .populate('receivedByDetails')
    .sort({ receiptDate: -1 });

    // Calculate payment summary
    const totalPaid = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const remainingAmount = insurance.premiumAmount - totalPaid;
    const paymentStatus = totalPaid >= insurance.premiumAmount ? 'PAID' : 
                         totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    res.status(200).json({
      success: true,
      data: {
        insurance: {
          id: insurance._id,
          policyNumber: insurance.policyNumber,
          premiumAmount: insurance.premiumAmount,
          totalPaid,
          remainingAmount,
          paymentStatus,
          insuranceDate: insurance.insuranceDate,
          validUptoDate: insurance.validUptoDate,
          provider: insurance.insuranceProvider,
          booking: insurance.booking
        },
        ledgerEntries,
        summary: {
          totalEntries: ledgerEntries.length,
          totalPaid,
          remainingAmount,
          paymentStatus
        }
      }
    });

  } catch (err) {
    console.error('Error getting insurance ledger history:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting insurance ledger history',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Update insurance ledger entry
 * @route   PUT /api/v1/insurance/ledger/:ledgerId
 * @access  Private (Admin/Manager)
 */
exports.updateInsuranceLedgerEntry = async (req, res) => {
  try {
    const { ledgerId } = req.params;
    const { paymentMode, amount, cashLocation, bank, transactionReference, remark } = req.body;
    
    // Validate ledger ID
    if (!mongoose.Types.ObjectId.isValid(ledgerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ledger ID format'
      });
    }

    // Find the ledger entry
    const ledgerEntry = await Ledger.findById(ledgerId)
      .populate('insurance', 'policyNumber premiumAmount');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    // Check if it's an insurance payment
    if (ledgerEntry.type !== 'INSURANCE_PAYMENT') {
      return res.status(400).json({
        success: false,
        message: 'This is not an insurance payment entry'
      });
    }

    // Validate amount if provided
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Calculate new total if amount is being updated
    let newTotalPaid = 0;
    if (amount !== undefined && amount !== ledgerEntry.amount) {
      const existingPayments = await Ledger.find({ 
        insurance: ledgerEntry.insurance,
        type: 'INSURANCE_PAYMENT',
        _id: { $ne: ledgerId }
      });
      
      const otherPayments = existingPayments.reduce((sum, entry) => sum + entry.amount, 0);
      newTotalPaid = otherPayments + amount;
      
      // Check if new total exceeds premium amount
      const insurance = await Insurance.findById(ledgerEntry.insurance);
      if (insurance && newTotalPaid > insurance.premiumAmount) {
        return res.status(400).json({
          success: false,
          message: `Total payments would exceed premium amount. Maximum allowed: ${insurance.premiumAmount - otherPayments}`
        });
      }
    }

    // Validate payment mode specific fields
    const updatedPaymentMode = paymentMode || ledgerEntry.paymentMode;
    if (updatedPaymentMode === 'Cash') {
      if (!cashLocation) {
        return res.status(400).json({
          success: false,
          message: 'Cash location is required for cash payments'
        });
      }
      
      const cashLoc = await CashLocation.findById(cashLocation);
      if (!cashLoc) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cash location selected'
        });
      }
    } 
    else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(updatedPaymentMode)) {
      if (!bank) {
        return res.status(400).json({
          success: false,
          message: 'Bank is required for non-cash payments'
        });
      }
      
      const bankExists = await Bank.findById(bank);
      if (!bankExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bank selected'
        });
      }
    }

    // Update the ledger entry
    ledgerEntry.paymentMode = updatedPaymentMode;
    if (amount !== undefined) ledgerEntry.amount = amount;
    ledgerEntry.cashLocation = updatedPaymentMode === 'Cash' ? cashLocation : undefined;
    ledgerEntry.bank = ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(updatedPaymentMode) ? bank : undefined;
    if (transactionReference !== undefined) ledgerEntry.transactionReference = transactionReference;
    if (remark !== undefined) ledgerEntry.remark = remark;
    
    await ledgerEntry.save();

    // Update insurance payment status if amount was changed
    if (amount !== undefined && amount !== ledgerEntry.amount) {
      const insurance = await Insurance.findById(ledgerEntry.insurance);
      if (insurance) {
        if (newTotalPaid >= insurance.premiumAmount) {
          insurance.paymentStatus = 'PAID';
          insurance.paymentCompletedDate = new Date();
        } else {
          insurance.paymentStatus = 'PARTIAL';
        }
        await insurance.save();
      }
    }

    // Log the action
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'InsuranceLedger',
      entityId: ledgerEntry._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        ledgerId,
        paymentMode: updatedPaymentMode,
        amount: amount || ledgerEntry.amount
      },
      status: 'SUCCESS'
    });

    // Populate the response
    const populatedLedger = await Ledger.findById(ledgerEntry._id)
      .populate('bankDetails')
      .populate('cashLocationDetails')
      .populate('receivedByDetails');

    res.status(200).json({
      success: true,
      data: {
        ledger: populatedLedger,
        message: 'Insurance ledger entry updated successfully'
      }
    });

  } catch (err) {
    console.error('Error updating insurance ledger entry:', err);
    
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'InsuranceLedger',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error updating insurance ledger entry',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Delete insurance ledger entry
 * @route   DELETE /api/v1/insurance/ledger/:ledgerId
 * @access  Private (Admin/Manager)
 */
exports.deleteInsuranceLedgerEntry = async (req, res) => {
  try {
    const { ledgerId } = req.params;
    
    // Validate ledger ID
    if (!mongoose.Types.ObjectId.isValid(ledgerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ledger ID format'
      });
    }

    // Find the ledger entry
    const ledgerEntry = await Ledger.findById(ledgerId)
      .populate('insurance', 'policyNumber premiumAmount');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    // Check if it's an insurance payment
    if (ledgerEntry.type !== 'INSURANCE_PAYMENT') {
      return res.status(400).json({
        success: false,
        message: 'This is not an insurance payment entry'
      });
    }

    // Store insurance ID for later use
    const insuranceId = ledgerEntry.insurance;

    // Delete the ledger entry
    await Ledger.findByIdAndDelete(ledgerId);

    // Recalculate insurance payment status
    const remainingPayments = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    });
    
    const totalPaid = remainingPayments.reduce((sum, entry) => sum + entry.amount, 0);
    const insurance = await Insurance.findById(insuranceId);
    
    if (insurance) {
      if (totalPaid >= insurance.premiumAmount) {
        insurance.paymentStatus = 'PAID';
        insurance.paymentCompletedDate = new Date();
      } else if (totalPaid > 0) {
        insurance.paymentStatus = 'PARTIAL';
      } else {
        insurance.paymentStatus = 'UNPAID';
      }
      await insurance.save();
    }

    // Log the action
    await AuditLog.create({
      action: 'DELETE',
      entity: 'InsuranceLedger',
      entityId: ledgerId,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        ledgerId,
        insuranceId,
        deletedAmount: ledgerEntry.amount
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Insurance ledger entry deleted successfully',
      data: {
        deletedAmount: ledgerEntry.amount,
        remainingPayments: totalPaid,
        insurancePaymentStatus: insurance?.paymentStatus
      }
    });

  } catch (err) {
    console.error('Error deleting insurance ledger entry:', err);
    
    await AuditLog.create({
      action: 'DELETE',
      entity: 'InsuranceLedger',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: { ledgerId: req.params.ledgerId },
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error deleting insurance ledger entry',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get all insurance payments summary
 * @route   GET /api/v1/insurance/payments/summary
 * @access  Private (Admin/Manager/SuperAdmin)
 */
exports.getInsurancePaymentsSummary = async (req, res) => {
  try {
    const { startDate, endDate, paymentStatus, provider, branch } = req.query;
    
    // Build filters
    const filter = {};
    if (startDate && endDate) {
      filter.insuranceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (provider) {
      filter.insuranceProvider = provider;
    }

    // For non-superadmins, filter by branch
    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    } else if (branch) {
      const bookings = await Booking.find({ branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    // Get all insurances with payment details
    const insurances = await Insurance.find(filter)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('insuranceProvider', 'provider_name')
      .populate('createdBy', 'name email');

    // Get all insurance ledger entries
    const insuranceIds = insurances.map(ins => ins._id);
    const ledgerEntries = await Ledger.find({
      insurance: { $in: insuranceIds },
      type: 'INSURANCE_PAYMENT'
    });

    // Create a map of insuranceId to total paid
    const paymentMap = new Map();
    ledgerEntries.forEach(entry => {
      const current = paymentMap.get(entry.insurance.toString()) || 0;
      paymentMap.set(entry.insurance.toString(), current + entry.amount);
    });

    // Process insurance data with payment information
    const processedInsurances = insurances.map(insurance => {
      const totalPaid = paymentMap.get(insurance._id.toString()) || 0;
      const remainingAmount = insurance.premiumAmount - totalPaid;
      const paymentStatus = totalPaid >= insurance.premiumAmount ? 'PAID' : 
                           totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

      return {
        id: insurance._id,
        policyNumber: insurance.policyNumber,
        premiumAmount: insurance.premiumAmount,
        totalPaid,
        remainingAmount,
        paymentStatus,
        insuranceDate: insurance.insuranceDate,
        validUptoDate: insurance.validUptoDate,
        provider: insurance.insuranceProvider,
        booking: insurance.booking,
        createdBy: insurance.createdBy
      };
    });

    // Filter by payment status if provided
    let filteredInsurances = processedInsurances;
    if (paymentStatus) {
      filteredInsurances = processedInsurances.filter(ins => ins.paymentStatus === paymentStatus);
    }

    // Calculate summary statistics
    const summary = {
      totalInsurances: filteredInsurances.length,
      totalPremiumAmount: filteredInsurances.reduce((sum, ins) => sum + ins.premiumAmount, 0),
      totalPaidAmount: filteredInsurances.reduce((sum, ins) => sum + ins.totalPaid, 0),
      totalRemainingAmount: filteredInsurances.reduce((sum, ins) => sum + ins.remainingAmount, 0),
      paidCount: filteredInsurances.filter(ins => ins.paymentStatus === 'PAID').length,
      partialCount: filteredInsurances.filter(ins => ins.paymentStatus === 'PARTIAL').length,
      unpaidCount: filteredInsurances.filter(ins => ins.paymentStatus === 'UNPAID').length
    };

    res.status(200).json({
      success: true,
      data: {
        insurances: filteredInsurances,
        summary
      }
    });

  } catch (err) {
    console.error('Error getting insurance payments summary:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting insurance payments summary',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get insurance details with payment status
 * @route   GET /api/v1/insurance/:insuranceId/payment-status
 * @access  Private (Admin/Manager)
 */
exports.getInsurancePaymentStatus = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    
    // Validate insurance ID
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    // Find the insurance record
    const insurance = await Insurance.findById(insuranceId)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('insuranceProvider', 'provider_name')
      .populate('createdBy', 'name email');

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    // Get all ledger entries for this insurance
    const ledgerEntries = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    })
    .populate('receivedByDetails')
    .sort({ receiptDate: -1 });

    // Calculate payment summary
    const totalPaid = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const remainingAmount = insurance.premiumAmount - totalPaid;
    const paymentStatus = totalPaid >= insurance.premiumAmount ? 'PAID' : 
                         totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    // Calculate payment percentage
    const paymentPercentage = insurance.premiumAmount > 0 ? 
      Math.round((totalPaid / insurance.premiumAmount) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        insurance: {
          id: insurance._id,
          policyNumber: insurance.policyNumber,
          premiumAmount: insurance.premiumAmount,
          totalPaid,
          remainingAmount,
          paymentStatus,
          paymentPercentage,
          insuranceDate: insurance.insuranceDate,
          validUptoDate: insurance.validUptoDate,
          provider: insurance.insuranceProvider,
          booking: insurance.booking,
          createdBy: insurance.createdBy
        },
        paymentHistory: ledgerEntries.map(entry => ({
          id: entry._id,
          amount: entry.amount,
          paymentMode: entry.paymentMode,
          receivedBy: entry.receivedByDetails,
          receiptDate: entry.receiptDate,
          remark: entry.remark,
          transactionReference: entry.transactionReference
        })),
        summary: {
          totalEntries: ledgerEntries.length,
          totalPaid,
          remainingAmount,
          paymentStatus,
          paymentPercentage
        }
      }
    });

  } catch (err) {
    console.error('Error getting insurance payment status:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting insurance payment status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};