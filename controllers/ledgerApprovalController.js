const Ledger = require('../models/Ledger');
const BrokerLedger = require('../models/BrokerLedger');
const Booking = require('../models/Booking');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Approve ledger entry
exports.approveLedgerEntry = async (req, res, next) => {
  try {
    const { ledgerId } = req.params;
    const { remark } = req.body;

    const ledgerEntry = await Ledger.findById(ledgerId);
    if (!ledgerEntry) {
      return next(new AppError('Ledger entry not found', 404));
    }

    if (ledgerEntry.approvalStatus !== 'Pending') {
      return next(new AppError('Entry is not pending approval', 400));
    }

    // Update ledger entry
    ledgerEntry.approvalStatus = 'Approved';
    ledgerEntry.approvedBy = req.user.id;
    ledgerEntry.approvedAt = new Date();
    if (remark) ledgerEntry.remark = remark;

    await ledgerEntry.save();

    // If approved, update booking amounts
    if (ledgerEntry.type !== 'DEBIT_ENTRY') {
      await Booking.findByIdAndUpdate(
        ledgerEntry.booking,
        {
          $inc: { receivedAmount: ledgerEntry.amount },
          $set: {
            balanceAmount: mongoose.model('Booking').discountedAmount - 
                          (mongoose.model('Booking').receivedAmount + ledgerEntry.amount)
          }
        }
      );
    }

    res.status(200).json({
      status: 'success',
      data: {
        ledger: await Ledger.findById(ledgerEntry._id)
          .populate('approvedBy', 'name email')
          .populate('bankDetails')
          .populate('cashLocationDetails')
      }
    });

  } catch (err) {
    logger.error(`Error approving ledger entry: ${err.message}`);
    next(new AppError('Failed to approve ledger entry', 500));
  }
};

// Reject ledger entry
exports.rejectLedgerEntry = async (req, res, next) => {
  try {
    const { ledgerId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return next(new AppError('Rejection reason is required', 400));
    }

    const ledgerEntry = await Ledger.findById(ledgerId);
    if (!ledgerEntry) {
      return next(new AppError('Ledger entry not found', 404));
    }

    if (ledgerEntry.approvalStatus !== 'Pending') {
      return next(new AppError('Entry is not pending approval', 400));
    }

    ledgerEntry.approvalStatus = 'Rejected';
    ledgerEntry.rejectionReason = rejectionReason;
    ledgerEntry.approvedBy = req.user.id;
    ledgerEntry.approvedAt = new Date();

    await ledgerEntry.save();

    res.status(200).json({
      status: 'success',
      data: {
        ledger: ledgerEntry
      }
    });

  } catch (err) {
    logger.error(`Error rejecting ledger entry: ${err.message}`);
    next(new AppError('Failed to reject ledger entry', 500));
  }
};

// Approve broker ledger transaction
exports.approveBrokerTransaction = async (req, res, next) => {
  try {
    const { brokerId, branchId, transactionId } = req.params;
    const { remark } = req.body;

    const brokerLedger = await BrokerLedger.findOne({
      broker: brokerId,
      branch: branchId
    });

    if (!brokerLedger) {
      return next(new AppError('Broker ledger not found', 404));
    }

    const transaction = brokerLedger.transactions.id(transactionId);
    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    if (transaction.approvalStatus !== 'Pending') {
      return next(new AppError('Transaction is not pending approval', 400));
    }

    transaction.approvalStatus = 'Approved';
    transaction.approvedBy = req.user.id;
    transaction.approvedAt = new Date();
    if (remark) transaction.remark = remark;

    // Update balance only when approved
    if (transaction.type === 'CREDIT') {
      brokerLedger.currentBalance -= transaction.amount;
      if (transaction.isOnAccount) {
        brokerLedger.onAccount += transaction.amount;
      }
    } else {
      brokerLedger.currentBalance += transaction.amount;
    }

    await brokerLedger.save();

    res.status(200).json({
      status: 'success',
      data: {
        transaction,
        currentBalance: brokerLedger.currentBalance,
        onAccount: brokerLedger.onAccount
      }
    });

  } catch (err) {
    logger.error(`Error approving broker transaction: ${err.message}`);
    next(new AppError('Failed to approve broker transaction', 500));
  }
};

// Reject broker ledger transaction
exports.rejectBrokerTransaction = async (req, res, next) => {
  try {
    const { brokerId, branchId, transactionId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return next(new AppError('Rejection reason is required', 400));
    }

    const brokerLedger = await BrokerLedger.findOne({
      broker: brokerId,
      branch: branchId
    });

    if (!brokerLedger) {
      return next(new AppError('Broker ledger not found', 404));
    }

    const transaction = brokerLedger.transactions.id(transactionId);
    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    if (transaction.approvalStatus !== 'Pending') {
      return next(new AppError('Transaction is not pending approval', 400));
    }

    transaction.approvalStatus = 'Rejected';
    transaction.rejectionReason = rejectionReason;
    transaction.approvedBy = req.user.id;
    transaction.approvedAt = new Date();

    await brokerLedger.save();

    res.status(200).json({
      status: 'success',
      data: {
        transaction
      }
    });

  } catch (err) {
    logger.error(`Error rejecting broker transaction: ${err.message}`);
    next(new AppError('Failed to reject broker transaction', 500));
  }
};

// Get pending approvals
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get pending ledger entries
    const ledgerPending = await Ledger.find({
      approvalStatus: 'Pending',
      paymentMode: { $ne: 'Cash' }
    })
      .populate('bookingDetails')
      .populate('receivedByDetails')
      .populate('bankDetails')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get pending broker transactions
    const brokerPending = await BrokerLedger.aggregate([
      { $unwind: '$transactions' },
      {
        $match: {
          'transactions.approvalStatus': 'Pending',
          'transactions.modeOfPayment': { $ne: 'Cash' }
        }
      },
      {
        $lookup: {
          from: 'brokers',
          localField: 'broker',
          foreignField: '_id',
          as: 'brokerDetails'
        }
      },
      {
        $lookup: {
          from: 'branches',
          localField: 'branch',
          foreignField: '_id',
          as: 'branchDetails'
        }
      },
      { $unwind: '$brokerDetails' },
      { $unwind: '$branchDetails' },
      {
        $project: {
          transaction: '$transactions',
          broker: '$brokerDetails',
          branch: '$branchDetails',
          ledgerId: '$_id'
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        ledgerEntries: ledgerPending,
        brokerTransactions: brokerPending,
        totalPending: ledgerPending.length + brokerPending.length
      }
    });

  } catch (err) {
    logger.error(`Error fetching pending approvals: ${err.message}`);
    next(new AppError('Failed to fetch pending approvals', 500));
  }
};