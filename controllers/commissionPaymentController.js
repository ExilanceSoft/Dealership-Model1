// controllers/commissionPaymentController.js
const CommissionPayment = require('../models/CommissionPayment');
const Subdealer = require('../models/Subdealer');
const Bank = require('../models/Bank');
const SubdealerOnAccountRef = require('../models/SubdealerOnAccountRef');
const Ledger = require('../models/Ledger');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const CommissionMaster = require('../models/CommissionMaster');

// Process commission payment for a subdealer
exports.processCommissionPayment = async (req, res, next) => {
  try {
    const {
      subdealer_id,
      month,
      year,
      payment_method,
      transaction_reference,
      remarks
    } = req.body;

    // Validate required fields
    if (!subdealer_id || !month || !year || !payment_method) {
      return next(new AppError('Subdealer ID, month, year, and payment method are required', 400));
    }

    // Validate month range
    if (month < 1 || month > 12) {
      return next(new AppError('Month must be between 1 and 12', 400));
    }

    // Validate payment method
    const validPaymentMethods = ['ON_ACCOUNT', 'BANK_TRANSFER', 'UPI', 'CHEQUE'];
    if (!validPaymentMethods.includes(payment_method)) {
      return next(new AppError('Invalid payment method', 400));
    }

    // Check if subdealer exists
    const subdealer = await Subdealer.findById(subdealer_id);
    if (!subdealer) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Check for duplicate payment for the same month and year
    const existingPayment = await CommissionPayment.findOne({
      subdealer_id,
      month,
      year,
      status: { $in: ['PENDING', 'PAID'] }
    });

    if (existingPayment) {
      return next(new AppError(`Commission payment for ${month}/${year} already exists for this subdealer`, 400));
    }

    // Get monthly commission report
    const monthlyReport = await calculateMonthlyCommission(subdealer_id, month, year);
    
    if (!monthlyReport || monthlyReport.total_commission <= 0) {
      return next(new AppError(`No commission available for ${month}/${year}`, 400));
    }

    // Validate transaction reference for non-ON_ACCOUNT payments
    if (payment_method !== 'ON_ACCOUNT' && !transaction_reference) {
      return next(new AppError('Transaction reference is required for this payment method', 400));
    }

    let on_account_receipt_id = null;

    // Handle ON_ACCOUNT payment method
    if (payment_method === 'ON_ACCOUNT') {
      // Create on-account receipt
      const receiptData = {
        subdealer: subdealer_id,
        refNumber: `COMM-${subdealer_id}-${month}-${year}-${Date.now()}`,
        paymentMode: 'On-Account',
        amount: monthlyReport.total_commission,
        receivedDate: new Date(),
        receivedBy: req.user.id,
        status: 'OPEN',
        allocatedTotal: 0,
        remark: `Commission payment for ${month}/${year} - ${remarks || ''}`
      };

      const receipt = await SubdealerOnAccountRef.create(receiptData);
      on_account_receipt_id = receipt._id;
    }

    // Create commission payment record
    const commissionPaymentData = {
      subdealer_id,
      month,
      year,
      total_commission: monthlyReport.total_commission,
      payment_method,
      transaction_reference: payment_method !== 'ON_ACCOUNT' ? transaction_reference : null,
      on_account_receipt_id,
      status: payment_method === 'ON_ACCOUNT' ? 'PAID' : 'PENDING',
      remarks,
      booking_commissions: monthlyReport.booking_commissions,
      created_by: req.user.id
    };

    const commissionPayment = await CommissionPayment.create(commissionPaymentData);

    // If it's a direct payment (not on-account), create a ledger entry
    if (payment_method !== 'ON_ACCOUNT') {
      const ledgerData = {
        type: 'COMMISSION_PAYMENT',
        isDebit: true,
        paymentMode: payment_method,
        transactionReference: transaction_reference,
        amount: monthlyReport.total_commission,
        receivedBy: req.user.id,
        remark: `Commission payment for ${subdealer.name} - ${month}/${year}`,
        source: {
          kind: 'COMMISSION',
          refId: commissionPayment._id,
          refModel: 'CommissionPayment',
          refReceipt: null,
        },
        commission_payment: commissionPayment._id
      };

      await Ledger.create(ledgerData);
    }

    // Populate the response
    const populatedPayment = await CommissionPayment.findById(commissionPayment._id)
      .populate('subdealer_details', 'name location type')
      .populate('created_by_details', 'name email');

    res.status(201).json({
      status: 'success',
      data: {
        commission_payment: populatedPayment
      }
    });
  } catch (err) {
    logger.error(`Error processing commission payment: ${err.message}`);
    next(err);
  }
};

// Get all commission payments with filters
// Get all commission payments with filters
exports.getCommissionPayments = async (req, res, next) => {
  try {
    const {
      subdealer_id,
      month,
      year,
      status,
      payment_method,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    
    if (subdealer_id) filter.subdealer_id = subdealer_id;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (payment_method) filter.payment_method = payment_method;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { year: -1, month: -1, created_at: -1 },
      populate: [
        { path: 'subdealer_details', select: 'name location type' },
        { path: 'created_by_details', select: 'name email' }
      ]
    };

    const result = await CommissionPayment.paginate(filter, options);

    res.status(200).json({
      status: 'success',
      data: {
        payments: result.docs,
        pagination: {
          total: result.totalDocs,
          pages: result.totalPages,
          page: result.page,
          limit: result.limit,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      }
    });
  } catch (err) {
    logger.error(`Error getting commission payments: ${err.message}`);
    next(err);
  }
};

// Get commission payment by ID
exports.getCommissionPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid commission payment ID', 400));
    }

    const commissionPayment = await CommissionPayment.findById(id)
      .populate('subdealer_details', 'name location type')
      .populate('bank_details', 'name accountNumber ifsc branch')
      .populate('created_by_details', 'name email')
      .populate('on_account_receipt_details');

    if (!commissionPayment) {
      return next(new AppError('Commission payment not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        commission_payment: commissionPayment
      }
    });
  } catch (err) {
    logger.error(`Error getting commission payment: ${err.message}`);
    next(err);
  }
};

// Update commission payment status
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid commission payment ID', 400));
    }

    if (!status || !['PAID', 'FAILED'].includes(status)) {
      return next(new AppError('Valid status is required (PAID or FAILED)', 400));
    }

    const commissionPayment = await CommissionPayment.findById(id);
    
    if (!commissionPayment) {
      return next(new AppError('Commission payment not found', 404));
    }

    if (commissionPayment.status === 'PAID') {
      return next(new AppError('Commission payment is already PAID', 400));
    }

    // Update status
    commissionPayment.status = status;
    if (remarks) commissionPayment.remarks = remarks;
    commissionPayment.updated_at = new Date();

    await commissionPayment.save();

    // If status is PAID and it's not an ON_ACCOUNT payment, create ledger entry
    if (status === 'PAID' && commissionPayment.payment_method !== 'ON_ACCOUNT') {
      const ledgerData = {
        type: 'COMMISSION_PAYMENT',
        isDebit: true,
        paymentMode: commissionPayment.payment_method,
        transactionReference: commissionPayment.transaction_reference,
        amount: commissionPayment.total_commission,
        receivedBy: req.user.id,
        remark: `Commission payment PAID for ${commissionPayment.subdealer_details?.name || 'subdealer'} - ${commissionPayment.month}/${commissionPayment.year}`,
        source: {
          kind: 'COMMISSION',
          refId: commissionPayment._id,
          refModel: 'CommissionPayment',
          refReceipt: null,
        },
        commission_payment: commissionPayment._id
      };

      await Ledger.create(ledgerData);
    }

    const populatedPayment = await CommissionPayment.findById(id)
      .populate('subdealer_details', 'name location type')
      .populate('created_by_details', 'name email');

    res.status(200).json({
      status: 'success',
      data: {
        commission_payment: populatedPayment
      }
    });
  } catch (err) {
    logger.error(`Error updating commission payment status: ${err.message}`);
    next(err);
  }
};


// Helper function to calculate monthly commission
async function calculateMonthlyCommission(subdealer_id, month, year) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await Booking.find({
      subdealer: subdealer_id,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['APPROVED', 'COMPLETED'] }
    })
      .populate([
        { path: "model", select: "model_name" },
        { path: "priceComponents.header", select: "header_key" }
      ])
      .lean();

    let totalCommission = 0;
    const bookingCommissions = [];

    for (const booking of bookings) {
      const commissionMaster = await CommissionMaster.findOne({
        subdealer_id,
        model_id: booking.model?._id
      }).populate("commission_rates.header_id");

      let bookingCommissionTotal = 0;
      const breakdown = [];

      if (commissionMaster && booking.priceComponents?.length) {
        for (const component of booking.priceComponents) {
          // Find the applicable commission rate for this header at the booking date
          const applicableRates = commissionMaster.commission_rates.filter(r => {
            if (!r.header_id || !component.header) return false;
            
            const headerMatch = r.header_id._id.toString() === component.header._id.toString();
            const dateMatch = booking.createdAt >= r.applicable_from && 
                            (!r.applicable_to || booking.createdAt <= r.applicable_to);
            
            return headerMatch && dateMatch && r.is_active;
          });

          // Use the most recent rate (highest applicable_from) if multiple rates found
          const rateObj = applicableRates.length > 0 
            ? applicableRates.sort((a, b) => b.applicable_from - a.applicable_from)[0]
            : null;

          const base = component.discountedValue || component.originalValue || 0;
          const rate = rateObj ? rateObj.commission_rate : 0;
          const commission = +(base * rate / 100).toFixed(2);

          bookingCommissionTotal += commission;

          breakdown.push({
            header_id: component.header?._id,
            header_key: component.header?.header_key,
            base,
            rate,
            commission,
            applicable_from: rateObj ? rateObj.applicable_from : null,
            applicable_to: rateObj ? rateObj.applicable_to : null
          });
        }
      }

      totalCommission += bookingCommissionTotal;

      bookingCommissions.push({
        booking_id: booking._id,
        booking_number: booking.bookingNumber,
        model: booking.model?.model_name,
        booking_date: booking.createdAt,
        customer_name: booking.customerDetails?.name,
        total_amount: booking.discountedAmount,
        commission_breakdown: breakdown,
        total_commission: +bookingCommissionTotal.toFixed(2)
      });
    }

    return {
      total_commission: totalCommission,
      booking_commissions: bookingCommissions
    };
  } catch (err) {
    logger.error(`Error calculating monthly commission: ${err.message}`);
    throw err;
  }
}