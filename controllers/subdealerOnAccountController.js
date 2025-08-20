const mongoose = require('mongoose');
const SubdealerOnAccountRef = require('../models/SubdealerOnAccountRef');
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const Subdealer = require('../models/Subdealer');
const Bank = require('../models/Bank');
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

// POST /api/subdealers/:subdealerId/on-account/receipts
exports.createOnAccountReceipt = async (req, res, next) => {
  let session = null;
  try {
    const { subdealerId } = req.params;
    const { refNumber, amount, paymentMode, bank, receivedDate, remark } = req.body;

    if (!mongoose.Types.ObjectId.isValid(subdealerId)) {
      return next(new AppError('Invalid subdealer id', 400));
    }

    // Check for duplicate refNumber for this subdealer first
    const existingReceipt = await SubdealerOnAccountRef.findOne({
      subdealer: subdealerId,
      refNumber: String(refNumber).trim()
    });
    
    if (existingReceipt) {
      return next(new AppError('Duplicate UTR/REF for this subdealer', 409));
    }

    const sd = await Subdealer.findById(subdealerId);
    if (!sd) {
      return next(new AppError('Subdealer not found', 404));
    }

    const amt = toNum(amount);
    if (amt <= 0) {
      return next(new AppError('Amount must be greater than 0', 400));
    }

    if (!refNumber || !refNumber.trim()) {
      return next(new AppError('UTR/REF number is required', 400));
    }

    if (
      ['Bank', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Pay Order'].includes(paymentMode || 'Bank')
      && !bank
    ) {
      return next(new AppError('Bank is required for selected payment mode', 400));
    }

    if (bank) {
      const bankDoc = await Bank.findById(bank);
      if (!bankDoc) {
        return next(new AppError('Invalid bank', 400));
      }
    }

    // Start transaction only if supported
    const useTransactions = supportsTransactions();
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const receiptData = {
      subdealer: subdealerId,
      refNumber: String(refNumber).trim(),
      paymentMode: paymentMode || 'Bank',
      amount: amt,
      receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      receivedBy: req.user?.id,
      status: 'OPEN',
      allocatedTotal: 0,
    };

    // Add optional fields only if they exist
    if (bank) receiptData.bank = bank;
    if (remark) receiptData.remark = remark;

    const options = useTransactions && session ? { session } : {};
    const receipt = await SubdealerOnAccountRef.create([receiptData], options);

    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.status(201).json({
      success: true,
      data: receipt[0],
    });
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    logger.error(`createOnAccountReceipt error: ${err.message}`);
    if (err.code === 11000) {
      return next(new AppError('Duplicate UTR/REF for this subdealer', 409));
    }
    next(new AppError('Failed to create On-Account receipt', 500));
  }
};

// GET /api/subdealers/:subdealerId/on-account/receipts
exports.listOnAccountReceipts = async (req, res, next) => {
  try {
    const { subdealerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subdealerId)) {
      return next(new AppError('Invalid subdealer id', 400));
    }

    const {
      status, // OPEN|PARTIAL|CLOSED
      q, // refNumber search
      from, // ISO date
      to,   // ISO date
      page = 1,
      limit = 20,
      sort = '-receivedDate',
    } = req.query;

    const filter = { subdealer: subdealerId };
    if (status) filter.status = status;

    if (q && q.trim()) {
      filter.refNumber = { $regex: q.trim(), $options: 'i' };
    }
    if (from || to) {
      filter.receivedDate = {};
      if (from) filter.receivedDate.$gte = new Date(from);
      if (to) filter.receivedDate.$lte = new Date(to);
    }

    const options = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort,
      populate: [
        { path: 'subdealer', select: 'name location type' },
        { path: 'bank', select: 'name accountNumber ifsc' },
        { path: 'allocations.booking', select: 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount subdealer bookingType' },
        { path: 'allocations.allocatedBy', select: 'name email' },
        { path: 'allocations.ledger', select: 'amount paymentMode transactionReference createdAt' },
      ],
      lean: true,
    };

    const result = await SubdealerOnAccountRef.paginate(filter, options);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error(`listOnAccountReceipts error: ${err.message}`);
    next(new AppError('Failed to fetch On-Account receipts', 500));
  }
};

// GET /api/on-account/receipts/:id
exports.getOnAccountReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid receipt id', 400));
    }

    const doc = await SubdealerOnAccountRef.findById(id)
      .populate('subdealer', 'name location type')
      .populate('bank', 'name accountNumber ifsc')
      .populate('allocations.booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount subdealer bookingType')
      .populate('allocations.allocatedBy', 'name email')
      .populate('allocations.ledger', 'amount paymentMode transactionReference createdAt')
      .lean();

    if (!doc) return next(new AppError('Receipt not found', 404));

    res.json({ success: true, data: doc });
  } catch (err) {
    logger.error(`getOnAccountReceipt error: ${err.message}`);
    next(new AppError('Failed to fetch receipt', 500));
  }
};

// POST /api/on-account/receipts/:id/allocate
// body: { allocations: [{ bookingId, amount, remark? }, ...] }
exports.allocateOnAccount = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const { allocations } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid receipt id', 400));
    }

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return next(new AppError('Allocations array is required', 400));
    }

    const receipt = await SubdealerOnAccountRef.findById(id);
    if (!receipt) {
      return next(new AppError('Receipt not found', 404));
    }
    if (receipt.status === 'CLOSED') {
      return next(new AppError('Receipt is already CLOSED', 400));
    }

    // Validate and sum
    let sumAlloc = 0;
    for (const a of allocations) {
      const amt = toNum(a.amount);
      if (!a.bookingId || !mongoose.Types.ObjectId.isValid(a.bookingId)) {
        return next(new AppError('Invalid bookingId in allocations', 400));
      }
      if (amt <= 0) {
        return next(new AppError('Allocation amount must be > 0', 400));
      }
      sumAlloc += amt;
    }

    if (sumAlloc > (receipt.amount - receipt.allocatedTotal)) {
      return next(new AppError('Allocation exceeds available balance of receipt', 400));
    }

    // Validate bookings belong to this subdealer and are SUBDEALER bookings
    const bookingIds = allocations.map((a) => a.bookingId);
    const bookings = await Booking.find({ _id: { $in: bookingIds } })
      .select('bookingNumber discountedAmount receivedAmount balanceAmount subdealer bookingType');

    const bookingMap = new Map(bookings.map((b) => [String(b._id), b]));

    for (const a of allocations) {
      const b = bookingMap.get(String(a.bookingId));
      if (!b) {
        return next(new AppError(`Booking not found: ${a.bookingId}`, 404));
      }
      if (String(b.subdealer) !== String(receipt.subdealer)) {
        return next(new AppError(`Booking ${b.bookingNumber} does not belong to this subdealer`, 400));
      }
      if (b.bookingType !== 'SUBDEALER') {
        return next(new AppError(`Booking ${b.bookingNumber} is not a SUBDEALER booking`, 400));
      }
    }

    // Start transaction only if supported
    const useTransactions = supportsTransactions();
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const options = useTransactions && session ? { session } : {};

    // Perform allocations: create Ledger entries & update booking amounts
    const now = new Date();
    for (const a of allocations) {
      const b = bookingMap.get(String(a.bookingId));
      const amt = toNum(a.amount);

      // Create a credit ledger entry sourced from Subdealer On-Account REF
      // Use the original payment mode from the receipt, not "On-Account"
      const ledgerData = {
        booking: b._id,
        type: 'BOOKING_PAYMENT',
        isDebit: false,
        paymentMode: receipt.paymentMode, // Use the original payment mode
        transactionReference: receipt.refNumber,
        amount: amt,
        receivedBy: req.user?.id,
        remark: a.remark || `On-Account allocation from Subdealer REF ${receipt.refNumber}`,
        source: {
          kind: 'SUBDEALER',
          refId: receipt.subdealer,
          refModel: 'Subdealer',
          refReceipt: receipt._id,
        },
      };

      // Add optional fields only if they exist
      if (receipt.bank) ledgerData.bank = receipt.bank;

      const ledger = await Ledger.create([ledgerData], options);

      // Update booking received/balance - bypass validation to allow overpayment
      const currentReceived = b.receivedAmount || 0;
      const newReceived = currentReceived + amt;
      
      // Use findByIdAndUpdate to bypass validation
      await Booking.findByIdAndUpdate(
        b._id,
        {
          $set: {
            receivedAmount: newReceived,
            balanceAmount: (b.discountedAmount || 0) - newReceived
          }
        },
        { 
          ...options,
          runValidators: false // Disable validation to allow overpayment
        }
      );

      // Push allocation in receipt
      receipt.allocations.push({
        booking: b._id,
        amount: amt,
        ledger: ledger[0]._id,
        remark: a.remark,
        allocatedAt: now,
        allocatedBy: req.user?.id,
      });

      receipt.allocatedTotal = (receipt.allocatedTotal || 0) + amt;
    }

    // Update status and close if fully allocated
    if (receipt.allocatedTotal >= receipt.amount) {
      receipt.status = 'CLOSED';
      receipt.closedAt = now;
      receipt.closedBy = req.user?.id;
    } else if (receipt.allocatedTotal > 0) {
      receipt.status = 'PARTIAL';
    } else {
      receipt.status = 'OPEN';
    }

    await receipt.save(options);

    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    const populated = await SubdealerOnAccountRef.findById(receipt._id)
      .populate('subdealer', 'name location type')
      .populate('bank', 'name accountNumber ifsc')
      .populate('allocations.booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount subdealer bookingType')
      .populate('allocations.allocatedBy', 'name email')
      .populate('allocations.ledger', 'amount paymentMode transactionReference createdAt');

    res.json({ success: true, data: populated });
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    logger.error(`allocateOnAccount error: ${err.message}`);
    next(new AppError('Failed to allocate On-Account receipt', 500));
  }
};

// DELETE /api/on-account/receipts/:id/allocations/:allocId
// Guard: cannot modify if receipt CLOSED
exports.deallocateAllocation = async (req, res, next) => {
  let session = null;
  try {
    const { id, allocId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(allocId)) {
      return next(new AppError('Invalid id(s)', 400));
    }

    const receipt = await SubdealerOnAccountRef.findById(id);
    if (!receipt) {
      return next(new AppError('Receipt not found', 404));
    }
    if (receipt.status === 'CLOSED') {
      return next(new AppError('Receipt is CLOSED; cannot deallocate', 400));
    }

    const alloc = receipt.allocations.id(allocId);
    if (!alloc) {
      return next(new AppError('Allocation not found', 404));
    }

    // Reverse booking amounts
    const booking = await Booking.findById(alloc.booking);
    if (!booking) {
      return next(new AppError('Booking not found for allocation', 404));
    }

    // Start transaction only if supported
    const useTransactions = supportsTransactions();
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const options = useTransactions && session ? { session } : {};

    // Use findByIdAndUpdate to bypass validation
    const newReceivedAmount = Math.max(0, (booking.receivedAmount || 0) - alloc.amount);
    await Booking.findByIdAndUpdate(
      booking._id,
      {
        $set: {
          receivedAmount: newReceivedAmount,
          balanceAmount: (booking.discountedAmount || 0) - newReceivedAmount
        }
      },
      { 
        ...options,
        runValidators: false // Disable validation
      }
    );

    // Remove ledger entry
    if (alloc.ledger) {
      await Ledger.deleteOne({ _id: alloc.ledger }, options);
    }

    // Update receipt running totals
    receipt.allocatedTotal = (receipt.allocatedTotal || 0) - alloc.amount;
    if (receipt.allocatedTotal < 0) receipt.allocatedTotal = 0;
    alloc.remove();

    // Update status
    if (receipt.allocatedTotal <= 0) {
      receipt.status = 'OPEN';
      receipt.closedAt = undefined;
      receipt.closedBy = undefined;
    } else if (receipt.allocatedTotal < receipt.amount) {
      receipt.status = 'PARTIAL';
      receipt.closedAt = undefined;
      receipt.closedBy = undefined;
    }

    await receipt.save(options);

    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    const populated = await SubdealerOnAccountRef.findById(receipt._id)
      .populate('subdealer', 'name location type')
      .populate('bank', 'name accountNumber ifsc')
      .populate('allocations.booking', 'bookingNumber customerDetails.name discountedAmount receivedAmount balanceAmount subdealer bookingType')
      .populate('allocations.allocatedBy', 'name email')
      .populate('allocations.ledger', 'amount paymentMode transactionReference createdAt');

    res.json({ success: true, data: populated });
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    logger.error(`deallocateAllocation error: ${err.message}`);
    next(new AppError('Failed to deallocate On-Account allocation', 500));
  }
};

// GET /api/subdealers/:subdealerId/on-account/summary
exports.getSubdealerOnAccountSummary = async (req, res, next) => {
  try {
    const { subdealerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subdealerId)) {
      return next(new AppError('Invalid subdealer id', 400));
    }

    const agg = await SubdealerOnAccountRef.aggregate([
      { $match: { subdealer: new mongoose.Types.ObjectId(subdealerId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedTotal' },
          totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } },
        },
      },
    ]);

    const totals = await SubdealerOnAccountRef.aggregate([
      { $match: { subdealer: new mongoose.Types.ObjectId(subdealerId) } },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          grandAmount: { $sum: '$amount' },
          grandAllocated: { $sum: '$allocatedTotal' },
          grandBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        byStatus: agg || [],
        totals: totals[0] || {
          totalReceipts: 0,
          grandAmount: 0,
          grandAllocated: 0,
          grandBalance: 0,
        },
      },
    });
  } catch (err) {
    logger.error(`getSubdealerOnAccountSummary error: ${err.message}`);
    next(new AppError('Failed to fetch subdealer summary', 500));
  }
};