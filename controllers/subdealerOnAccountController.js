const mongoose = require('mongoose');
const SubdealerOnAccountRef = require('../models/SubdealerOnAccountRef');
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const Subdealer = require('../models/Subdealer');
const Bank = require('../models/Bank');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const FinanceDisbursement = require('../models/FinanceDisbursement'); 
const BankSubPaymentMode = require('../models/BankSubPaymentMode');

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
// POST /api/subdealers/:subdealerId/on-account/receipts
exports.createOnAccountReceipt = async (req, res, next) => {
  let session = null;
  try {
    const { subdealerId } = req.params;
    const { refNumber, amount, paymentMode, subPaymentMode, bank, receivedDate, remark } = req.body;

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

    // Validate payment mode specific requirements
    if (paymentMode === 'Bank') {
      if (!subPaymentMode) {
        return next(new AppError('Sub-payment mode is required for Bank payments', 400));
      }
      
      // Validate subPaymentMode exists
      const subPaymentModeExists = await BankSubPaymentMode.findById(subPaymentMode);
      if (!subPaymentModeExists) {
        return next(new AppError('Invalid sub-payment mode selected', 400));
      }
      
      if (!bank) {
        return next(new AppError('Bank is required for Bank payments', 400));
      }
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
    if (subPaymentMode) receiptData.subPaymentMode = subPaymentMode;
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
// GET /api/subdealers/:subdealerId/on-account/receipts
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
        { path: 'subPaymentMode', select: 'payment_mode' }, // Add subPaymentMode population
        { 
          path: 'allocations.booking', 
          select: 'bookingNumber customerDetails chassisNumber discountedAmount receivedAmount balanceAmount subdealer bookingType status model color',
          populate: [
            { path: 'model', select: 'name' },
            { path: 'color', select: 'name' }
          ]
        },
        { path: 'allocations.allocatedBy', select: 'name email' },
        { path: 'allocations.ledger', select: 'amount paymentMode transactionReference createdAt' },
      ],
      lean: true,
    };

    const result = await SubdealerOnAccountRef.paginate(filter, options);

    // Get all unique booking IDs from allocations
    const bookingIds = [];
    result.docs.forEach(receipt => {
      if (receipt.allocations && receipt.allocations.length > 0) {
        receipt.allocations.forEach(allocation => {
          if (allocation.booking && !bookingIds.includes(allocation.booking._id.toString())) {
            bookingIds.push(allocation.booking._id.toString());
          }
        });
      }
    });

    // Fetch finance disbursements for all unique bookings in one query
    let financeDisbursementsMap = {};
    if (bookingIds.length > 0) {
      const financeDisbursements = await FinanceDisbursement.find({
        booking: { $in: bookingIds },
        status: { $ne: 'CANCELLED' }
      })
      .populate('financeProvider', 'name code')
      .select('booking disbursementReference disbursementDate amount status financeProvider')
      .lean();

      // Create a map of booking ID to finance disbursements
      financeDisbursementsMap = financeDisbursements.reduce((map, disbursement) => {
        const bookingId = disbursement.booking.toString();
        if (!map[bookingId]) {
          map[bookingId] = [];
        }
        map[bookingId].push(disbursement);
        return map;
      }, {});
    }

    // Use a cache to avoid duplicate finance data for the same booking
    const financeDataCache = {};

    // Process the result to add finance disbursement info
    result.docs = result.docs.map(receipt => {
      if (receipt.allocations && receipt.allocations.length > 0) {
        receipt.allocations = receipt.allocations.map(allocation => {
          if (allocation.booking) {
            const bookingId = allocation.booking._id.toString();
            
            // Use cached finance data or create it
            if (!financeDataCache[bookingId]) {
              const disbursements = financeDisbursementsMap[bookingId] || [];
              const totalFinanceDisbursed = disbursements.reduce((sum, d) => sum + (d.amount || 0), 0);
              
              financeDataCache[bookingId] = {
                financeDisbursements: disbursements,
                totalFinanceDisbursed: totalFinanceDisbursed
              };
            }
            
            // Add finance data to the booking
            allocation.booking.financeDisbursements = financeDataCache[bookingId].financeDisbursements;
            allocation.booking.totalFinanceDisbursed = financeDataCache[bookingId].totalFinanceDisbursed;
          }
          return allocation;
        });
      }
      return receipt;
    });

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
// POST /api/on-account/receipts/:id/allocate
// POST /api/on-account/receipts/:id/allocate
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

    const receipt = await SubdealerOnAccountRef.findById(id)
      .populate('subPaymentMode');
      
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
      const ledgerData = {
        booking: b._id,
        type: 'BOOKING_PAYMENT',
        isDebit: false,
        paymentMode: receipt.paymentMode,
        subPaymentMode: receipt.subPaymentMode, // Add subPaymentMode
        transactionReference: receipt.refNumber,
        amount: amt,
        receivedBy: req.user?.id,
        remark: a.remark || `On-Account allocation from Subdealer REF ${receipt.refNumber}`,
        source: {
          kind: 'SUBDEALER_ON_ACCOUNT',
          refId: receipt.subdealer,
          refModel: 'Subdealer',
          refReceipt: receipt._id,
        }
      };

      // Add bank reference if payment mode requires it and bank exists
      if (['Bank', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Pay Order'].includes(receipt.paymentMode) && receipt.bank) {
        ledgerData.bank = receipt.bank;
      }

      // For cash payments in on-account allocations, we don't require cashLocation
      if (receipt.paymentMode === 'Cash') {
        ledgerData.cashLocation = null;
      }

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
      .populate('subPaymentMode', 'payment_mode') // Populate subPaymentMode
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

// GET /api/on-account/summary
// GET /api/on-account/summary
exports.getAllSubdealersOnAccountSummary = async (req, res, next) => {
  try {
    const {
      from, // ISO date
      to,   // ISO date
    } = req.query;

    // Build date filter if provided
    const dateFilter = {};
    if (from || to) {
      dateFilter.receivedDate = {};
      if (from) dateFilter.receivedDate.$gte = new Date(from);
      if (to) dateFilter.receivedDate.$lte = new Date(to);
    }

    // Get ALL subdealers first
    const allSubdealers = await Subdealer.find({ status: 'active' })
      .select('_id name location type')
      .lean();

    // Get overall totals (across all subdealers)
    const totals = await SubdealerOnAccountRef.aggregate([
      { $match: dateFilter },
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

    // Get status breakdown PER SUBDEALER
    const statusBySubdealer = await SubdealerOnAccountRef.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            subdealer: '$subdealer',
            status: '$status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedTotal' },
          totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } },
        },
      },
      {
        $lookup: {
          from: 'subdealers',
          localField: '_id.subdealer',
          foreignField: '_id',
          as: 'subdealerDetails'
        }
      },
      {
        $unwind: {
          path: '$subdealerDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          subdealerId: '$_id.subdealer',
          subdealerName: '$subdealerDetails.name',
          subdealerLocation: '$subdealerDetails.location',
          subdealerType: '$subdealerDetails.type',
          status: '$_id.status',
          count: 1,
          totalAmount: 1,
          totalAllocated: 1,
          totalBalance: 1
        }
      }
    ]);

    // Get total summary per subdealer (all statuses combined)
    const subdealerTotals = await SubdealerOnAccountRef.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$subdealer',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedTotal' },
          totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } },
        },
      }
    ]);

    // Create a map of subdealers with totals for easy lookup
    const subdealerTotalsMap = new Map();
    subdealerTotals.forEach(item => {
      subdealerTotalsMap.set(String(item._id), item);
    });

    // Group status breakdown by subdealer
    const statusBreakdownBySubdealer = {};
    statusBySubdealer.forEach(item => {
      const subdealerId = String(item.subdealerId);
      if (!statusBreakdownBySubdealer[subdealerId]) {
        statusBreakdownBySubdealer[subdealerId] = {
          subdealerId: item.subdealerId,
          subdealerName: item.subdealerName,
          subdealerLocation: item.subdealerLocation,
          subdealerType: item.subdealerType,
          statuses: []
        };
      }
      statusBreakdownBySubdealer[subdealerId].statuses.push({
        status: item.status,
        count: item.count,
        totalAmount: item.totalAmount,
        totalAllocated: item.totalAllocated,
        totalBalance: item.totalBalance
      });
    });

    // Combine all subdealers with their data (include zeros for those without receipts)
    const subdealerBreakdown = allSubdealers.map(subdealer => {
      const totalData = subdealerTotalsMap.get(String(subdealer._id));
      const statusData = statusBreakdownBySubdealer[String(subdealer._id)] || { statuses: [] };
      
      return {
        subdealerId: subdealer._id,
        subdealerName: subdealer.name,
        subdealerLocation: subdealer.location,
        subdealerType: subdealer.type,
        count: totalData ? totalData.count : 0,
        totalAmount: totalData ? totalData.totalAmount : 0,
        totalAllocated: totalData ? totalData.totalAllocated : 0,
        totalBalance: totalData ? totalData.totalBalance : 0,
        hasReceipts: !!totalData,
        statusBreakdown: statusData.statuses
      };
    });

    // Sort by total amount descending
    subdealerBreakdown.sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      success: true,
      data: {
        overallTotals: totals[0] || {
          totalReceipts: 0,
          grandAmount: 0,
          grandAllocated: 0,
          grandBalance: 0,
        },
        subdealerBreakdown: subdealerBreakdown,
        totalSubdealers: allSubdealers.length,
        subdealersWithReceipts: subdealerTotals.length,
        subdealersWithoutReceipts: allSubdealers.length - subdealerTotals.length
      },
    });
  } catch (err) {
    logger.error(`getAllSubdealersOnAccountSummary error: ${err.message}`);
    next(new AppError('Failed to fetch all subdealers summary', 500));
  }
};

// Get all details for a specific subdealer and their on-account receipt
// Get all details for a specific subdealer and their on-account receipt
exports.getSubdealerOnAccountDetailsAsReceipt = async (req, res, next) => {
  try {
    const { subdealerId, receiptId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(subdealerId) || 
        !mongoose.Types.ObjectId.isValid(receiptId)) {
      return next(new AppError('Invalid subdealer or receipt ID', 400));
    }

    // Check if subdealer exists
    const subdealer = await Subdealer.findById(subdealerId);
    if (!subdealer) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Get the specific on-account receipt with detailed allocations
    const receipt = await SubdealerOnAccountRef.findOne({
      _id: receiptId,
      subdealer: subdealerId
    })
      .populate('subdealer', 'name location type status')
      .populate('bank', 'name accountNumber ifsc branch')
      .populate('receivedBy', 'name email')
      .populate('closedBy', 'name email')
      .populate({
        path: 'allocations.booking',
        select: 'bookingNumber customerDetails discountedAmount receivedAmount balanceAmount status createdAt',
        // Remove the nested population that was causing the error
      })
      .populate('allocations.allocatedBy', 'name email')
      .populate('allocations.ledger', 'amount paymentMode transactionReference createdAt remark')
      .lean();

    if (!receipt) {
      return next(new AppError('On-account receipt not found for this subdealer', 404));
    }

    // Get additional financial summary for this subdealer
    const bookingStats = await Booking.aggregate([
      { 
        $match: { 
          subdealer: new mongoose.Types.ObjectId(subdealerId),
          bookingType: 'SUBDEALER'
        } 
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalBookingAmount: { $sum: '$totalAmount' },
          totalReceivedAmount: { $sum: '$receivedAmount' },
          totalBalanceAmount: { $sum: '$balanceAmount' },
          totalDiscountedAmount: { $sum: '$discountedAmount' }
        }
      }
    ]);

    const onAccountStats = await SubdealerOnAccountRef.aggregate([
      { 
        $match: { 
          subdealer: new mongoose.Types.ObjectId(subdealerId)
        } 
      },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          totalReceiptAmount: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedTotal' },
          totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } }
        }
      }
    ]);

    const bookingSummary = bookingStats[0] || {
      totalBookings: 0,
      totalBookingAmount: 0,
      totalReceivedAmount: 0,
      totalBalanceAmount: 0,
      totalDiscountedAmount: 0
    };

    const onAccountSummary = onAccountStats[0] || {
      totalReceipts: 0,
      totalReceiptAmount: 0,
      totalAllocated: 0,
      totalBalance: 0
    };

    // Format the response
    const formattedReceipt = {
      ...receipt,
      remainingBalance: receipt.amount - receipt.allocatedTotal,
      formattedAllocations: receipt.allocations.map(allocation => ({
        _id: allocation._id,
        booking: allocation.booking ? {
          _id: allocation.booking._id,
          bookingNumber: allocation.booking.bookingNumber,
          customerName: allocation.booking.customerDetails?.name || 'N/A',
          customerPhone: allocation.booking.customerDetails?.phone || 'N/A',
          discountedAmount: allocation.booking.discountedAmount,
          receivedAmount: allocation.booking.receivedAmount,
          balanceAmount: allocation.booking.balanceAmount,
          status: allocation.booking.status,
          createdAt: allocation.booking.createdAt
        } : null,
        amount: allocation.amount,
        ledger: allocation.ledger ? {
          _id: allocation.ledger._id,
          amount: allocation.ledger.amount,
          paymentMode: allocation.ledger.paymentMode,
          transactionReference: allocation.ledger.transactionReference,
          remark: allocation.ledger.remark,
          createdAt: allocation.ledger.createdAt
        } : null,
        remark: allocation.remark,
        allocatedAt: allocation.allocatedAt,
        allocatedBy: allocation.allocatedBy ? {
          _id: allocation.allocatedBy._id,
          name: allocation.allocatedBy.name,
          email: allocation.allocatedBy.email
        } : null
      }))
    };

    res.status(200).json({
      success: true,
      data: {
        subdealer: {
          _id: subdealer._id,
          name: subdealer.name,
          location: subdealer.location,
          type: subdealer.type,
          status: subdealer.status,
          rateOfInterest: subdealer.rateOfInterest,
          discount: subdealer.discount
        },
        receipt: formattedReceipt,
        financialSummary: {
          bookingSummary,
          onAccountSummary,
          financialOverview: {
            totalOutstanding: bookingSummary.totalBalanceAmount,
            availableCredit: onAccountSummary.totalBalance,
            netPosition: onAccountSummary.totalBalance - bookingSummary.totalBalanceAmount,
            status: (onAccountSummary.totalBalance - bookingSummary.totalBalanceAmount) >= 0 ? 'POSITIVE' : 'NEGATIVE'
          }
        }
      }
    });

  } catch (err) {
    logger.error(`getSubdealerOnAccountDetails error: ${err.message}`);
    next(new AppError('Failed to fetch subdealer on-account details', 500));
  }
};

// controllers/commissionMasterController.js - Add these methods

// controllers/commissionMasterController.js - Add these methods

