const mongoose = require('mongoose');
const Insurance = require('../models/newInsurance');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const Ledger = require('../models/Ledger');
const CashLocation = require('../models/cashLocation');
const Bank = require('../models/Bank');

exports.addInsurance = async (req, res) => {
    try {
      const { bookingId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }
  
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
  
      const existingInsurance = await Insurance.findOne({ booking: bookingId });
      if (existingInsurance) {
        return res.status(409).json({
          success: false,
          message: 'Insurance already exists for this booking'
        });
      }
  
      const {
        insuranceDate,
        policyNumber,
        rsaPolicyNumber,
        cmsPolicyNumber,
        premiumAmount,
        validUptoDate,
        remarks = ''
      } = req.body;
  
      // Modified validation to remove insuranceProvider and paymentMode
      if (!policyNumber || !premiumAmount || !validUptoDate) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: policyNumber, premiumAmount, validUptoDate'
        });
      }
  
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
        createdBy: req.user.id,
        approvedBy: req.user.id
      };
  
      const insurance = await Insurance.create(insuranceData);
  
      await AuditLog.create({
        action: 'CREATE',
        entity: 'Insurance',
        entityId: insurance._id,
        user: req.user.id,
        ip: req.ip,
        metadata: insuranceData,
        status: 'SUCCESS'
      });
  
      const response = {
        ...insurance.toObject(),
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

exports.getAllInsurances = async (req, res) => {
  try {
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

exports.getBookingsAwaitingInsurance = async (req, res) => {
  try {
    const filter = {
      status: 'APPROVED',
      insuranceStatus: 'AWAITING'
    };

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

exports.getInsuranceByChassisNumber = async (req, res) => {
  try {
    const { chassisNumber } = req.params;

    if (!chassisNumber || chassisNumber.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid chassis number (minimum 5 characters)'
      });
    }

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

exports.getAllCombinedBookingInsuranceDetails = async (req, res) => {
  try {
    const { insuranceStatus } = req.query;

    const bookingFilter = {};
    if (insuranceStatus) {
      bookingFilter.insuranceStatus = insuranceStatus;
    }

    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      bookingFilter.branch = req.user.branch;
    }

    const bookings = await Booking.find(bookingFilter)
      .populate({
        path: 'model',
        select: 'name model_name'
      })
      .populate('color', 'name code')
      .populate('branch', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const insurances = await Insurance.find({
      booking: { $in: bookings.map(b => b._id) }
    })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    const insuranceMap = new Map();
    insurances.forEach(insurance => {
      insuranceMap.set(insurance.booking.toString(), insurance);
    });

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

exports.createInsuranceLedgerEntry = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const { paymentMode, amount, cashLocation, bank, remark } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    const insurance = await Insurance.findById(insuranceId).lean();

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    if (!paymentMode || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Payment mode and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

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

    if (paymentMode === 'Cash') {
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
    else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode)) {
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

    const newTotalPaid = totalPaid + amount;
    const updateData = {
      paymentStatus: newTotalPaid >= insurance.premiumAmount ? 'PAID' : 'PARTIAL',
      updatedBy: req.user.id
    };

    if (newTotalPaid >= insurance.premiumAmount) {
      updateData.paymentCompletedDate = new Date();
    }

    await Insurance.findByIdAndUpdate(insuranceId, updateData, { runValidators: false });

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

exports.getInsuranceLedgerHistory = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    const insurance = await Insurance.findById(insuranceId)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('createdBy', 'name email');

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    const ledgerEntries = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    })
    .populate('bankDetails')
    .populate('cashLocationDetails')
    .populate('receivedByDetails')
    .sort({ receiptDate: -1 });

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

exports.updateInsuranceLedgerEntry = async (req, res) => {
  try {
    const { ledgerId } = req.params;
    const { paymentMode, amount, cashLocation, bank, transactionReference, remark } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(ledgerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ledger ID format'
      });
    }

    const ledgerEntry = await Ledger.findById(ledgerId)
      .populate('insurance', 'policyNumber premiumAmount');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    if (ledgerEntry.type !== 'INSURANCE_PAYMENT') {
      return res.status(400).json({
        success: false,
        message: 'This is not an insurance payment entry'
      });
    }

    let newTotalPaid = 0;
    if (amount !== undefined && amount !== ledgerEntry.amount) {
      const existingPayments = await Ledger.find({ 
        insurance: ledgerEntry.insurance,
        type: 'INSURANCE_PAYMENT',
        _id: { $ne: ledgerId }
      });
      
      const otherPayments = existingPayments.reduce((sum, entry) => sum + entry.amount, 0);
      newTotalPaid = otherPayments + amount;
      
      const insurance = await Insurance.findById(ledgerEntry.insurance);
      if (insurance && newTotalPaid > insurance.premiumAmount) {
        return res.status(400).json({
          success: false,
          message: `Total payments would exceed premium amount. Maximum allowed: ${insurance.premiumAmount - otherPayments}`
        });
      }
    }

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

    ledgerEntry.paymentMode = updatedPaymentMode;
    if (amount !== undefined) ledgerEntry.amount = amount;
    ledgerEntry.cashLocation = updatedPaymentMode === 'Cash' ? cashLocation : undefined;
    ledgerEntry.bank = ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(updatedPaymentMode) ? bank : undefined;
    if (transactionReference !== undefined) ledgerEntry.transactionReference = transactionReference;
    if (remark !== undefined) ledgerEntry.remark = remark;
    
    await ledgerEntry.save();

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

exports.deleteInsuranceLedgerEntry = async (req, res) => {
  try {
    const { ledgerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(ledgerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ledger ID format'
      });
    }

    const ledgerEntry = await Ledger.findById(ledgerId)
      .populate('insurance', 'policyNumber premiumAmount');

    if (!ledgerEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    if (ledgerEntry.type !== 'INSURANCE_PAYMENT') {
      return res.status(400).json({
        success: false,
        message: 'This is not an insurance payment entry'
      });
    }

    const insuranceId = ledgerEntry.insurance;

    await Ledger.findByIdAndDelete(ledgerId);

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

exports.getInsurancePaymentsSummary = async (req, res) => {
  try {
    const { startDate, endDate, paymentStatus, branch } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.insuranceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (!req.user.roles.some(r => r.isSuperAdmin)) {
      const bookings = await Booking.find({ branch: req.user.branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    } else if (branch) {
      const bookings = await Booking.find({ branch }).select('_id');
      filter.booking = { $in: bookings.map(b => b._id) };
    }

    const insurances = await Insurance.find(filter)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('createdBy', 'name email');

    const insuranceIds = insurances.map(ins => ins._id);
    const ledgerEntries = await Ledger.find({
      insurance: { $in: insuranceIds },
      type: 'INSURANCE_PAYMENT'
    });

    const paymentMap = new Map();
    ledgerEntries.forEach(entry => {
      const current = paymentMap.get(entry.insurance.toString()) || 0;
      paymentMap.set(entry.insurance.toString(), current + entry.amount);
    });

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
        booking: insurance.booking,
        createdBy: insurance.createdBy
      };
    });

    let filteredInsurances = processedInsurances;
    if (paymentStatus) {
      filteredInsurances = processedInsurances.filter(ins => ins.paymentStatus === paymentStatus);
    }

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

exports.getInsurancePaymentStatus = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(insuranceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid insurance ID format'
      });
    }

    const insurance = await Insurance.findById(insuranceId)
      .populate('booking', 'bookingNumber customerDetails chassisNumber model color branch')
      .populate('createdBy', 'name email');

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found'
      });
    }

    const ledgerEntries = await Ledger.find({ 
      insurance: insuranceId,
      type: 'INSURANCE_PAYMENT'
    })
    .populate('receivedByDetails')
    .sort({ receiptDate: -1 });

    const totalPaid = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const remainingAmount = insurance.premiumAmount - totalPaid;
    const paymentStatus = totalPaid >= insurance.premiumAmount ? 'PAID' : 
                         totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

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