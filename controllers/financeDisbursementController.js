// controllers/financeDisbursementController.js
const mongoose = require('mongoose');
const FinanceDisbursement = require('../models/FinanceDisbursement');
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const FinanceProvider = require('../models/FinanceProvider');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Helper: safe number
const toNum = (v) => Number.parseFloat(v || 0) || 0;

// Helper to check if transactions are supported
const supportsTransactions = () => {
  try {
    const connection = mongoose.connection;
    if (!connection || !connection.db) return false;
    return connection.db.options && connection.db.options.replicaSet !== undefined;
  } catch (err) {
    logger.warn(`Transaction support check failed: ${err.message}`);
    return false;
  }
};

// POST /api/finance-disbursements
exports.createFinanceDisbursement = async (req, res, next) => {
  let session = null;
  try {
    const {
      bookingId,
      financeProviderId,
      disbursementReference,
      disbursementDate,
      amount
    } = req.body;

    // Validate required fields
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Valid booking ID is required', 400));
    }

    if (!financeProviderId || !mongoose.Types.ObjectId.isValid(financeProviderId)) {
      return next(new AppError('Valid finance provider ID is required', 400));
    }

    if (!disbursementReference || !disbursementReference.trim()) {
      return next(new AppError('Disbursement reference is required', 400));
    }

    const disbursementAmount = toNum(amount);
    if (disbursementAmount <= 0) {
      return next(new AppError('Amount must be greater than 0', 400));
    }

    // Check for duplicate disbursement reference
    const existingDisbursement = await FinanceDisbursement.findOne({
      disbursementReference: String(disbursementReference).trim()
    });

    if (existingDisbursement) {
      return next(new AppError('Duplicate disbursement reference', 409));
    }

    // Validate booking exists and is finance type
    const booking = await Booking.findById(bookingId)
      .populate('payment.financer', 'name');

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    if (booking.payment.type !== 'FINANCE') {
      return next(new AppError('Booking is not a finance booking', 400));
    }

    if (String(booking.payment.financer._id) !== String(financeProviderId)) {
      return next(new AppError('Finance provider does not match booking finance provider', 400));
    }

    // Validate finance provider
    const financeProvider = await FinanceProvider.findById(financeProviderId);
    if (!financeProvider) {
      return next(new AppError('Finance provider not found', 404));
    }

    // Start transaction only if supported
    const useTransactions = supportsTransactions();
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const options = useTransactions && session ? { session } : {};

    // Create finance disbursement
    const disbursementData = {
      booking: bookingId,
      financeProvider: financeProviderId,
      disbursementReference: String(disbursementReference).trim(),
      disbursementDate: disbursementDate ? new Date(disbursementDate) : new Date(),
      amount: disbursementAmount,
      paymentMode: 'Finance Disbursement',
      transactionReference: '',
      createdBy: req.user.id,
      status: 'COMPLETED'
    };

    const disbursement = await FinanceDisbursement.create([disbursementData], options);

    // Create ledger entry for the disbursement amount
    const ledgerData = {
      booking: bookingId,
      type: 'Finance Disbursement',
      isDebit: false,
      paymentMode: 'Finance Disbursement',
      transactionReference: disbursementData.disbursementReference,
      amount: disbursementAmount,
      receivedBy: req.user.id,
      remark: `Finance disbursement from ${financeProvider.name}`,
      source: {
        kind: 'Finance Disbursement',
        refId: disbursement[0]._id,
        refModel: 'FinanceDisbursement',
        refReceipt: null
      }
    };

    const ledger = await Ledger.create([ledgerData], options);

    // Update disbursement with ledger reference
    disbursement[0].ledgerEntry = ledger[0]._id;
    await disbursement[0].save(options);

    // Update booking received amount and balance
    const newReceivedAmount = (booking.receivedAmount || 0) + disbursementAmount;
    
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          receivedAmount: newReceivedAmount,
          balanceAmount: Math.max(0, (booking.discountedAmount || 0) - newReceivedAmount)
        }
      },
      {
        ...options,
        runValidators: false
      }
    );

    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Populate and return the created disbursement
    const populatedDisbursement = await FinanceDisbursement.findById(disbursement[0]._id)
      .populate('booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount')
      .populate('financeProvider', 'name code')
      .populate('createdBy', 'name email')
      .populate('ledgerEntry', 'amount paymentMode transactionReference createdAt');

    res.status(201).json({
      success: true,
      data: populatedDisbursement
    });

  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    logger.error(`createFinanceDisbursement error: ${err.message}`);
    if (err.code === 11000) {
      return next(new AppError('Duplicate disbursement reference', 409));
    }
    next(new AppError('Failed to create finance disbursement', 500));
  }
};

// GET /api/finance-disbursements
exports.listFinanceDisbursements = async (req, res, next) => {
  try {
    const {
      bookingId,
      financeProviderId,
      status,
      from,
      to,
      page = 1,
      limit = 20,
      sort = '-disbursementDate'
    } = req.query;

    const filter = {};

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      filter.booking = bookingId;
    }

    if (financeProviderId && mongoose.Types.ObjectId.isValid(financeProviderId)) {
      filter.financeProvider = financeProviderId;
    }

    if (status && ['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      filter.status = status;
    }

    if (from || to) {
      filter.disbursementDate = {};
      if (from) filter.disbursementDate.$gte = new Date(from);
      if (to) filter.disbursementDate.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const options = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort,
      populate: [
        { path: 'booking', select: 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount' },
        { path: 'financeProvider', select: 'name code' },
        { path: 'createdBy', select: 'name email' },
        { path: 'ledgerEntry', select: 'amount paymentMode transactionReference createdAt' }
      ],
      lean: true
    };

    const result = await FinanceDisbursement.paginate(filter, options);

    res.json({
      success: true,
      ...result
    });

  } catch (err) {
    logger.error(`listFinanceDisbursements error: ${err.message}`);
    next(new AppError('Failed to fetch finance disbursements', 500));
  }
};

// GET /api/finance-disbursements/:id
exports.getFinanceDisbursement = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid disbursement ID', 400));
    }

    const disbursement = await FinanceDisbursement.findById(id)
      .populate('booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount payment')
      .populate('financeProvider', 'name code')
      .populate('createdBy', 'name email')
      .populate('ledgerEntry', 'amount paymentMode transactionReference createdAt');

    if (!disbursement) {
      return next(new AppError('Finance disbursement not found', 404));
    }

    res.json({
      success: true,
      data: disbursement
    });

  } catch (err) {
    logger.error(`getFinanceDisbursement error: ${err.message}`);
    next(new AppError('Failed to fetch finance disbursement', 500));
  }
};

// PATCH /api/finance-disbursements/:id
exports.updateFinanceDisbursement = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const {
      amount,
      status
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid disbursement ID', 400));
    }

    const disbursement = await FinanceDisbursement.findById(id)
      .populate('booking', 'receivedAmount discountedAmount')
      .populate('ledgerEntry', '_id')
      .populate('financeProvider', 'name');

    if (!disbursement) {
      return next(new AppError('Finance disbursement not found', 404));
    }

    if (disbursement.status === 'CANCELLED') {
      return next(new AppError('Cannot update cancelled disbursement', 400));
    }

    // Start transaction only if supported
    const useTransactions = supportsTransactions();
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const options = useTransactions && session ? { session } : {};
    let amountChanged = false;
    let oldAmount = disbursement.amount;

    // Update amount if provided
    if (amount !== undefined) {
      const newAmount = toNum(amount);
      
      if (newAmount <= 0) {
        return next(new AppError('Amount must be greater than 0', 400));
      }

      disbursement.amount = newAmount;
      amountChanged = true;
    }

    // Update status if provided
    if (status && ['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      disbursement.status = status;
    }

    await disbursement.save(options);

    // Update ledger and booking if amount changed
    if (amountChanged && disbursement.ledgerEntry) {
      const amountDifference = disbursement.amount - oldAmount;

      // Update ledger entry
      await Ledger.findByIdAndUpdate(
        disbursement.ledgerEntry,
        { 
          $set: { 
            amount: disbursement.amount
          }
        },
        options
      );

      // Update booking received amount
      const newBookingReceivedAmount = (disbursement.booking.receivedAmount || 0) + amountDifference;
      
      await Booking.findByIdAndUpdate(
        disbursement.booking._id,
        {
          $set: {
            receivedAmount: newBookingReceivedAmount,
            balanceAmount: Math.max(0, (disbursement.booking.discountedAmount || 0) - newBookingReceivedAmount)
          }
        },
        {
          ...options,
          runValidators: false
        }
      );
    }

    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Return updated disbursement
    const updatedDisbursement = await FinanceDisbursement.findById(id)
      .populate('booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount')
      .populate('financeProvider', 'name code')
      .populate('createdBy', 'name email')
      .populate('ledgerEntry', 'amount paymentMode transactionReference createdAt');

    res.json({
      success: true,
      data: updatedDisbursement
    });

  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    logger.error(`updateFinanceDisbursement error: ${err.message}`);
    next(new AppError('Failed to update finance disbursement', 500));
  }
};

// GET /api/bookings/:bookingId/finance-disbursements
exports.getDisbursementsByBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Invalid booking ID', 400));
    }

    const disbursements = await FinanceDisbursement.find({ booking: bookingId })
      .populate('financeProvider', 'name code')
      .populate('createdBy', 'name email')
      .populate('ledgerEntry', 'amount paymentMode transactionReference createdAt')
      .sort({ disbursementDate: -1 });

    const totalDisbursed = disbursements.reduce((sum, d) => {
      if (d.status !== 'CANCELLED') {
        return sum + (d.amount || 0);
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      data: {
        disbursements,
        totalDisbursed,
        count: disbursements.length
      }
    });

  } catch (err) {
    logger.error(`getDisbursementsByBooking error: ${err.message}`);
    next(new AppError('Failed to fetch disbursements for booking', 500));
  }
};