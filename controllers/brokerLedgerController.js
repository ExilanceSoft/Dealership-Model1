const BrokerLedger = require('../models/BrokerLedger');
const Broker = require('../models/Broker');
const Booking = require('../models/Booking');
const Bank = require('../models/Bank');
const CashLocation = require('../models/cashLocation');
const BankSubPaymentMode = require('../models/BankSubPaymentMode');
const mongoose = require('mongoose');

// Initialize ledger for new broker in a branch
exports.initializeLedger = async (brokerId, branchId, userId) => {
  try {
    const existingLedger = await BrokerLedger.findOne({ 
      broker: brokerId, 
      branch: branchId 
    });
    if (!existingLedger) {
      const newLedger = await BrokerLedger.create({
        broker: brokerId,
        branch: branchId,
        currentBalance: 0,
        createdBy: userId
      });
      return newLedger;
    }
    return existingLedger;
  } catch (error) {
    console.error('Error initializing ledger:', error);
    throw error;
  }
};

// In brokerLedgerController.js - update autoAllocateOnAccountFunds
const autoAllocateOnAccountFunds = async (ledger, userId) => {
  try {
    // First, ensure we have a fully populated ledger
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('transactions.allocations.booking')
      .populate('transactions.booking');
    
    if (!populatedLedger) return ledger;

    // Get available on-account balance
    const availableOnAccount = populatedLedger.onAccountBalance;
    
    if (availableOnAccount <= 0) return populatedLedger;

    // Get all pending debits
    const pendingDebits = await getPendingDebitsForAutoAllocation(
      populatedLedger.broker, 
      populatedLedger.branch
    );
    
    let remainingOnAccount = availableOnAccount;
    
    for (const debit of pendingDebits) {
      if (remainingOnAccount <= 0) break;
      
      const allocationAmount = Math.min(remainingOnAccount, debit.outstandingAmount);
      
      if (allocationAmount > 0) {
        // Find credit transactions with remaining balance
        const creditTx = await findCreditForAllocation(populatedLedger, allocationAmount);
        
        if (creditTx) {
          // Add allocation to credit transaction
          const creditTransaction = populatedLedger.transactions.id(creditTx._id);
          
          if (creditTransaction) {
            creditTransaction.allocations.push({
              booking: debit.bookingId,
              amount: allocationAmount,
              date: new Date(),
              allocationType: 'AUTO'
            });
            
            // Update on-account balance
            populatedLedger.onAccount -= allocationAmount;
            remainingOnAccount -= allocationAmount;
            
            // Update auto allocation status
            const allocatedAmount = creditTransaction.allocations.reduce(
              (sum, alloc) => sum + alloc.amount, 0
            );
            
            if (allocatedAmount >= creditTransaction.amount) {
              creditTransaction.autoAllocationStatus = 'COMPLETED';
            } else if (allocatedAmount > 0) {
              creditTransaction.autoAllocationStatus = 'PARTIAL';
            }
            
            console.log(`Auto-allocated ${allocationAmount} to booking ${debit.bookingNumber}`);
          }
        }
      }
    }
    
    return populatedLedger;
  } catch (error) {
    console.error('Error in auto-allocation:', error);
    return ledger;
  }
};
exports.getPendingCreditTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, branchId, brokerId } = req.query;
    const skip = (page - 1) * limit;
    
    // Build base filter for ledgers
    const baseFilter = {};
    
    // Add branch filter if provided
    if (branchId && mongoose.isValidObjectId(branchId)) {
      baseFilter.branch = branchId;
    }
    
    // Add broker filter if provided
    if (brokerId && mongoose.isValidObjectId(brokerId)) {
      baseFilter.broker = brokerId;
    }
    
    // Use aggregation to properly filter transactions
    const aggregationPipeline = [
      { $match: baseFilter },
      { $unwind: '$transactions' },
      { 
        $match: { 
          'transactions.approvalStatus': 'Pending',
          'transactions.type': 'CREDIT',
          'transactions.isOnAccount': true
        } 
      },
      { $sort: { 'transactions.date': 1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'brokers',
          localField: 'broker',
          foreignField: '_id',
          as: 'broker'
        }
      },
      { $unwind: '$broker' },
      {
        $lookup: {
          from: 'branches',
          localField: 'branch',
          foreignField: '_id',
          as: 'branch'
        }
      },
      { $unwind: '$branch' },
      {
        $lookup: {
          from: 'bookings',
          localField: 'transactions.booking',
          foreignField: '_id',
          as: 'transactions.bookingDetails'
        }
      },
      { $unwind: { path: '$transactions.bookingDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'banks',
          localField: 'transactions.bank',
          foreignField: '_id',
          as: 'transactions.bankDetails'
        }
      },
      { $unwind: { path: '$transactions.bankDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'cashlocations',
          localField: 'transactions.cashLocation',
          foreignField: '_id',
          as: 'transactions.cashLocationDetails'
        }
      },
      { $unwind: { path: '$transactions.cashLocationDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'banksubpaymentmodes',
          localField: 'transactions.subPaymentMode',
          foreignField: '_id',
          as: 'transactions.subPaymentModeDetails'
        }
      },
      { $unwind: { path: '$transactions.subPaymentModeDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'transactions.createdBy',
          foreignField: '_id',
          as: 'transactions.createdByDetails'
        }
      },
      { $unwind: { path: '$transactions.createdByDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id',
          broker: { $first: '$broker' },
          branch: { $first: '$branch' },
          transactions: { $push: '$transactions' }
        }
      }
    ];

    // Get total count
    const countPipeline = [
      { $match: baseFilter },
      { $unwind: '$transactions' },
      { 
        $match: { 
          'transactions.approvalStatus': 'Pending',
          'transactions.type': 'CREDIT',
          'transactions.isOnAccount': true
        } 
      },
      { $count: 'total' }
    ];

    const [ledgersData, countResult] = await Promise.all([
      BrokerLedger.aggregate(aggregationPipeline),
      BrokerLedger.aggregate(countPipeline)
    ]);

    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Format the response
    const allPendingCredits = [];
    ledgersData.forEach(ledger => {
      if (ledger.transactions && ledger.transactions.length > 0) {
        ledger.transactions.forEach(transaction => {
          const formattedTransaction = {
            ...transaction,
            broker: {
              _id: ledger.broker._id,
              name: ledger.broker.name,
              mobile: ledger.broker.mobile,
              email: ledger.broker.email,
              brokerId: ledger.broker.brokerId
            },
            branch: {
              _id: ledger.branch._id,
              name: ledger.branch.name,
              code: ledger.branch.code
            },
            ledgerId: ledger._id,
            booking: transaction.bookingDetails ? {
              bookingNumber: transaction.bookingDetails.bookingNumber,
              customerName: transaction.bookingDetails.customerDetails ? 
                `${transaction.bookingDetails.customerDetails.salutation || ''} ${transaction.bookingDetails.customerDetails.name || ''}`.trim() : 
                'N/A',
              chassisNumber: transaction.bookingDetails.chassisNumber
            } : null,
            bank: transaction.bankDetails ? {
              _id: transaction.bankDetails._id,
              name: transaction.bankDetails.name
            } : null,
            cashLocation: transaction.cashLocationDetails ? {
              _id: transaction.cashLocationDetails._id,
              name: transaction.cashLocationDetails.name
            } : null,
            subPaymentMode: transaction.subPaymentModeDetails ? {
              _id: transaction.subPaymentModeDetails._id,
              payment_mode: transaction.subPaymentModeDetails.payment_mode
            } : null,
            createdBy: transaction.createdByDetails ? {
              _id: transaction.createdByDetails._id,
              name: transaction.createdByDetails.name
            } : null
          };

          // Remove the temporary populated fields
          delete formattedTransaction.bookingDetails;
          delete formattedTransaction.bankDetails;
          delete formattedTransaction.cashLocationDetails;
          delete formattedTransaction.subPaymentModeDetails;
          delete formattedTransaction.createdByDetails;

          allPendingCredits.push(formattedTransaction);
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        pendingCreditTransactions: allPendingCredits,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / limit),
          count: allPendingCredits.length,
          totalRecords: totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending credit transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching pending credit transactions'
    });
  }
};


const getPendingDebitsForAutoAllocation = async (brokerId, branchId) => {
  const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId })
    .populate('transactions.booking', 'bookingNumber');
  
  if (!ledger) return [];
  
  // Calculate outstanding amounts per booking (oldest first)
  const bookingOutstanding = {};
  
  ledger.transactions.forEach(txn => {
    // Include both approved AND pending DEBIT transactions
    if (txn.booking && txn.type === 'DEBIT') {
      const bookingId = txn.booking._id.toString();
      if (!bookingOutstanding[bookingId]) {
        bookingOutstanding[bookingId] = {
          bookingId: bookingId,
          bookingNumber: txn.booking.bookingNumber,
          totalDebit: 0,
          totalAdjusted: 0,
          oldestDebitDate: txn.date
        };
      }
      bookingOutstanding[bookingId].totalDebit += txn.amount;
      // Track the oldest debit date
      if (txn.date < bookingOutstanding[bookingId].oldestDebitDate) {
        bookingOutstanding[bookingId].oldestDebitDate = txn.date;
      }
    }

    if (txn.type === 'CREDIT' && txn.allocations) {
      txn.allocations.forEach(allocation => {
        if (allocation.booking) {
          const bookingId = allocation.booking.toString();
          if (!bookingOutstanding[bookingId]) {
            bookingOutstanding[bookingId] = {
              bookingId: bookingId,
              totalDebit: 0,
              totalAdjusted: 0,
              oldestDebitDate: new Date()
            };
          }
          bookingOutstanding[bookingId].totalAdjusted += allocation.amount;
        }
      });
    }
  });

  // Convert to array and filter for outstanding amounts
  return Object.values(bookingOutstanding)
    .filter(item => item.totalDebit > item.totalAdjusted)
    .map(item => ({
      bookingId: item.bookingId,
      bookingNumber: item.bookingNumber,
      outstandingAmount: item.totalDebit - item.totalAdjusted,
      oldestDebitDate: item.oldestDebitDate
    }))
    .sort((a, b) => a.oldestDebitDate - b.oldestDebitDate); // Oldest first
};

// Helper function to find credit for allocation (INCLUDE CREDITS WITH REMAINING BALANCE)
const findCreditForAllocation = async (ledger, amountNeeded) => {
  // Find credit transactions with remaining balance (oldest first)
  const creditsWithBalance = ledger.transactions
    .filter(tx => 
      tx.type === 'CREDIT' && 
      tx.referenceNumber && 
      tx.approvalStatus === 'Approved' && // Only approved credits
      tx.isOnAccount // Only on-account credits
    )
    .map(tx => {
      const allocated = tx.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const remaining = tx.amount - allocated;
      return { tx, remaining };
    })
    .filter(item => item.remaining > 0)
    .sort((a, b) => a.tx.date - b.tx.date); // Oldest first
  
  for (const item of creditsWithBalance) {
    if (item.remaining >= amountNeeded) {
      return item.tx;
    }
  }
  
  // If no single credit has enough, we could allocate from multiple credits
  // For now, return the first credit with any remaining balance
  return creditsWithBalance.length > 0 ? creditsWithBalance[0].tx : null;
};
// Approve on-account payment
exports.approveOnAccountPayment = async (req, res) => {
  try {
    const { brokerId, branchId, transactionId } = req.params;
    const { remark } = req.body;
    const userId = req.user.id;

    // Find the ledger
    const ledger = await BrokerLedger.findOne({
      broker: brokerId,
      branch: branchId
    });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Broker ledger not found'
      });
    }

    // Find the transaction
    const transaction = ledger.transactions.id(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if transaction is an on-account payment
    if (!transaction.isOnAccount || transaction.type !== 'CREDIT') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not an on-account payment'
      });
    }

    // Check if transaction is pending approval
    if (transaction.approvalStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending approval'
      });
    }

    // Update transaction status
    transaction.approvalStatus = 'Approved';
    transaction.approvedBy = userId;
    transaction.approvedAt = new Date();
    
    if (remark) {
      transaction.remark = transaction.remark 
        ? `${transaction.remark} | Approval: ${remark}`
        : `Approval: ${remark}`;
    }

    // Update ledger balance and on-account
  ledger.currentBalance -= transaction.amount;
    ledger.onAccount = (ledger.onAccount || 0) + transaction.amount;

    // Auto-allocate on-account funds to pending debits
    await autoAllocateOnAccountFunds(ledger, userId);

    await ledger.save();

    // Populate the response
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('broker', 'name mobile')
      .populate('branch', 'name')
      .populate({
        path: 'transactions.booking',
        select: 'bookingNumber customerDetails chassisNumber',
        transform: (doc) => {
          if (!doc) return null;
          return {
            bookingNumber: doc.bookingNumber,
            customerName: doc.customerDetails ? 
              `${doc.customerDetails.salutation || ''} ${doc.customerDetails.name || ''}`.trim() : 
              'N/A',
            chassisNumber: doc.chassisNumber
          };
        }
      })
      .populate('transactions.bank', 'name')
      .populate('transactions.cashLocation', 'name')
      .populate('transactions.subPaymentMode', 'payment_mode')
      .populate('transactions.createdBy', 'name')
      .populate('transactions.approvedBy', 'name')
      .populate('transactions.adjustedAgainst.booking', 'bookingNumber');

    const approvedTransaction = populatedLedger.transactions.id(transactionId);

    res.status(200).json({
      success: true,
      data: {
        transaction: approvedTransaction,
        currentBalance: populatedLedger.currentBalance,
        onAccount: populatedLedger.onAccount || 0,
        onAccountBalance: populatedLedger.onAccountBalance // Use the virtual property
      },
      message: 'On-account payment approved successfully'
    });

  } catch (error) {
    console.error('Error approving on-account payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving on-account payment'
    });
  }
};


// Helper function to find credit for allocation


exports.addTransaction = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const { 
      type, 
      amount, 
      modeOfPayment, 
      subPaymentMode,
      referenceNumber,
      bookingId, 
      bankId, 
      cashLocation: locationId,
      remark,
      adjustAgainstBookings
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!type || !amount || !modeOfPayment) {
      return res.status(400).json({
        success: false,
        message: 'Type, amount, and modeOfPayment are required fields'
      });
    }

    // Validate subPaymentMode for Bank payments
    if (modeOfPayment === 'Bank' && !subPaymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Sub-payment mode is required for bank payments'
      });
    }

    // Validate subPaymentMode exists if provided
    if (subPaymentMode) {
      const subPaymentModeExists = await BankSubPaymentMode.findById(subPaymentMode);
      if (!subPaymentModeExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sub-payment mode selected'
        });
      }
    }

    // Check if broker exists
    const broker = await Broker.findById(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Check if broker is associated with the branch
    const isBrokerInBranch = broker.branches.some(
      branch => branch.branch.toString() === branchId && branch.isActive
    );
    
    if (!isBrokerInBranch) {
      return res.status(400).json({
        success: false,
        message: 'Broker is not associated with this branch'
      });
    }

    // Find or create ledger
    let ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId });
    if (!ledger) {
      ledger = await this.initializeLedger(brokerId, branchId, userId);
    }

    // Calculate on-account balance
    const onAccountBalance = ledger.onAccount || 0;

    // Handle adjustment logic
    let adjustedBookings = [];
    let remainingAmount = parseFloat(amount);
    let isOnAccount = false;

    if (type === 'CREDIT') {
      if (adjustAgainstBookings && adjustAgainstBookings.length > 0) {
        // Manual adjustment against specific bookings
        for (const adjustment of adjustAgainstBookings) {
          const booking = await Booking.findById(adjustment.bookingId);
          if (!booking) {
            return res.status(404).json({
              success: false,
              message: `Booking ${adjustment.bookingId} not found`
            });
          }

          // Find the debit transactions for this booking
          const bookingDebits = ledger.transactions.filter(t => 
            t.booking && t.booking.toString() === adjustment.bookingId && t.type === 'DEBIT'
          );

          const totalDebit = bookingDebits.reduce((sum, t) => sum + t.amount, 0);
          const alreadyAdjusted = ledger.transactions
            .filter(t => t.type === 'CREDIT' && t.adjustedAgainst)
            .reduce((sum, t) => {
              const adjustmentsForThisBooking = t.adjustedAgainst.filter(a => 
                a.booking && a.booking.toString() === adjustment.bookingId
              );
              return sum + adjustmentsForThisBooking.reduce((s, a) => s + a.amount, 0);
            }, 0);

          const outstanding = totalDebit - alreadyAdjusted;

          if (adjustment.amount > outstanding) {
            return res.status(400).json({
              success: false,
              message: `Adjustment amount (${adjustment.amount}) exceeds outstanding balance (${outstanding}) for booking ${booking.bookingNumber}`
            });
          }

          if (adjustment.amount > remainingAmount) {
            return res.status(400).json({
              success: false,
              message: `Adjustment amount (${adjustment.amount}) exceeds remaining credit amount (${remainingAmount})`
            });
          }

          adjustedBookings.push({
            booking: adjustment.bookingId,
            amount: adjustment.amount
          });

          remainingAmount -= adjustment.amount;
        }
      } else if (!referenceNumber) {
        // No reference number and no specific adjustments = on-account payment
        isOnAccount = true;
      }
    }

    // Determine approval status
     let approvalStatus;
    if (type === 'DEBIT') {
      approvalStatus = 'Approved'; // Debits are auto-approved
    } else {
      approvalStatus = modeOfPayment === 'Cash' ? 'Approved' : 'Pending';
    }

    // Create transaction
   const transaction = {
      type,
      amount: parseFloat(amount),
      modeOfPayment,
      subPaymentMode: modeOfPayment === 'Bank' ? subPaymentMode : undefined,
      referenceNumber,
      remark,
      branch: branchId,
      createdBy: userId,
      booking: bookingId || null,
      bank: modeOfPayment === 'Bank' ? bankId : null,
      cashLocation: modeOfPayment === 'Cash' ? locationId : null,
      isOnAccount,
      adjustedAgainst: adjustedBookings,
      date: new Date(),
      approvalStatus,
      // Auto-approve if debit or cash, otherwise set to pending
      ...((type === 'DEBIT' || modeOfPayment === 'Cash') && {
        approvedBy: userId,
        approvedAt: new Date()
      })
    };
    // Add transaction to ledger
     // Add transaction to ledger
    ledger.transactions.push(transaction);
    
    // Update balance if transaction is approved
    if (approvalStatus === 'Approved') {
      if (type === 'CREDIT') {
        ledger.currentBalance -= parseFloat(amount);
        if (isOnAccount) {
          ledger.onAccount = (ledger.onAccount || 0) + parseFloat(amount);
          
          // Auto-allocate on-account funds to pending debits
          ledger = await autoAllocateOnAccountFunds(ledger, userId);
        }
      } else {
        // This is a DEBIT transaction (auto-approved)
        ledger.currentBalance += parseFloat(amount);
        
        // Try to auto-allocate any existing on-account funds to this new debit
        ledger = await autoAllocateOnAccountFunds(ledger, userId);
      }
    }
    
    await ledger.save();
    // Populate the response with subPaymentMode
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('broker', 'name mobile')
      .populate('branch', 'name')
      .populate({
        path: 'transactions.booking',
        select: 'bookingNumber customerDetails chassisNumber',
        transform: (doc) => {
          if (!doc) return null;
          return {
            bookingNumber: doc.bookingNumber,
            customerName: doc.customerDetails ? 
              `${doc.customerDetails.salutation || ''} ${doc.customerDetails.name || ''}`.trim() : 
              'N/A',
            chassisNumber: doc.chassisNumber
          };
        }
      })
      .populate('transactions.bank', 'name')
      .populate('transactions.cashLocation', 'name')
      .populate('transactions.subPaymentMode', 'payment_mode')
      .populate('transactions.createdBy', 'name')
      .populate('transactions.adjustedAgainst.booking', 'bookingNumber');

    res.status(201).json({
      success: true,
      data: populatedLedger,
      onAccountBalance: populatedLedger.onAccount || 0,
      message: approvalStatus === 'Approved' 
        ? 'Transaction added successfully' 
        : 'Transaction submitted for approval'
    });

  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding transaction'
    });
  }
};

// Get pending approval transactions for a broker in a branch
exports.getPendingTransactions = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Find the ledger
    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId })
      .populate('broker', 'name mobile email')
      .populate('branch', 'name code')
      .populate({
        path: 'transactions',
        match: { approvalStatus: 'Pending' },
        options: { 
          sort: { date: -1 },
          skip: skip,
          limit: parseInt(limit)
        },
        populate: [
          { 
            path: 'booking',
            select: 'bookingNumber customerDetails chassisNumber',
            transform: (doc) => {
              if (!doc) return null;
              return {
                bookingNumber: doc.bookingNumber,
                customerName: doc.customerDetails ? 
                  `${doc.customerDetails.salutation || ''} ${doc.customerDetails.name || ''}`.trim() : 
                  'N/A',
                chassisNumber: doc.chassisNumber
              };
            }
          },
          { path: 'bank', select: 'name' },
          { path: 'cashLocation', select: 'name' },
          { path: 'subPaymentMode', select: 'payment_mode' },
          { path: 'createdBy', select: 'name' }
        ]
      });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker and branch'
      });
    }

    // Get total count of pending transactions
    const totalCount = await BrokerLedger.aggregate([
      { $match: { broker: new mongoose.Types.ObjectId(brokerId), branch: new mongoose.Types.ObjectId(branchId) } },
      { $unwind: '$transactions' },
      { $match: { 'transactions.approvalStatus': 'Pending' } },
      { $count: 'total' }
    ]);

    const total = totalCount.length > 0 ? totalCount[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        broker: ledger.broker,
        branch: ledger.branch,
        pendingTransactions: ledger.transactions || [],
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: ledger.transactions ? ledger.transactions.length : 0,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching pending transactions'
    });
  }
};

// Approve broker ledger transaction
exports.approveBrokerTransaction = async (req, res) => {
  try {
    const { brokerId, branchId, transactionId } = req.params;
    const { remark } = req.body;
    const userId = req.user.id;

    // Find the ledger
    const ledger = await BrokerLedger.findOne({
      broker: brokerId,
      branch: branchId
    });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Broker ledger not found'
      });
    }

    // Find the transaction
    const transaction = ledger.transactions.id(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if transaction is pending approval
    if (transaction.approvalStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending approval'
      });
    }

    // Update transaction status
   transaction.approvalStatus = 'Approved';
    transaction.approvedBy = userId;
    transaction.approvedAt = new Date();
    
    if (remark) {
      transaction.remark = transaction.remark 
        ? `${transaction.remark} | Approval: ${remark}`
        : `Approval: ${remark}`;
    }

    // Update balance when approved
    if (transaction.type === 'CREDIT') {
      ledger.currentBalance -= transaction.amount;
      if (transaction.isOnAccount) {
        ledger.onAccount = (ledger.onAccount || 0) + transaction.amount;
        
        // Auto-allocate on-account funds to pending debits
        await autoAllocateOnAccountFunds(ledger, userId);
      }
    } else {
      ledger.currentBalance += transaction.amount;
      
      // If this is a debit against a booking, try to auto-allocate
      if (transaction.booking) {
        await autoAllocateOnAccountFunds(ledger, userId);
      }
    }

    await ledger.save();

    // Populate the response
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('broker', 'name mobile')
      .populate('branch', 'name')
      .populate({
        path: 'transactions.booking',
        select: 'bookingNumber customerDetails chassisNumber',
        transform: (doc) => {
          if (!doc) return null;
          return {
            bookingNumber: doc.bookingNumber,
            customerName: doc.customerDetails ? 
              `${doc.customerDetails.salutation || ''} ${doc.customerDetails.name || ''}`.trim() : 
              'N/A',
            chassisNumber: doc.chassisNumber
          };
        }
      })
      .populate('transactions.bank', 'name')
      .populate('transactions.cashLocation', 'name')
      .populate('transactions.subPaymentMode', 'payment_mode')
      .populate('transactions.createdBy', 'name')
      .populate('transactions.approvedBy', 'name')
      .populate('transactions.adjustedAgainst.booking', 'bookingNumber');

    const approvedTransaction = populatedLedger.transactions.id(transactionId);

    res.status(200).json({
      success: true,
      data: {
        transaction: approvedTransaction,
        currentBalance: populatedLedger.currentBalance,
        onAccount: populatedLedger.onAccount || 0
      },
      message: 'Transaction approved successfully'
    });

  } catch (error) {
    console.error('Error approving broker transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving transaction'
    });
  }
};

// Get ledger for a broker in a specific branch
exports.getLedger = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const { page = 1, limit = 20, fromDate, toDate } = req.query;
    
    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId })
      .populate('broker', 'name mobile email')
      .populate('branch', 'name')
      .populate({
        path: 'transactions.booking',
        select: 'bookingNumber customerDetails chassisNumber'
      })
      .populate('transactions.bank', 'name')
      .populate('transactions.cashLocation', 'name')
      .populate('transactions.subPaymentMode', 'payment_mode')
      .populate('transactions.createdBy', 'name');

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker and branch'
      });
    }

    res.status(200).json({
      success: true,
      data: ledger
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledger'
    });
  }
};

exports.addOnAccountPayment = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const { 
      amount, 
      modeOfPayment, 
      subPaymentMode,
      referenceNumber, 
      bankId, 
      cashLocation, 
      remark 
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!amount || !modeOfPayment) {
      return res.status(400).json({
        success: false,
        message: 'Amount and modeOfPayment are required fields'
      });
    }

    // Validate subPaymentMode for Bank payments
    if (modeOfPayment === 'Bank' && !subPaymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Sub-payment mode is required for bank payments'
      });
    }

    // Validate subPaymentMode exists if provided
    if (subPaymentMode) {
      const subPaymentModeExists = await BankSubPaymentMode.findById(subPaymentMode);
      if (!subPaymentModeExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sub-payment mode selected'
        });
      }
    }

    // Check if broker exists and is associated with branch
    const broker = await Broker.findById(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    const isBrokerInBranch = broker.branches.some(
      branch => branch.branch.toString() === branchId && branch.isActive
    );
    
    if (!isBrokerInBranch) {
      return res.status(400).json({
        success: false,
        message: 'Broker is not associated with this branch'
      });
    }

    // Check for duplicate reference number
    const existingRef = await BrokerLedger.findOne({
      broker: brokerId,
      branch: branchId,
      'transactions.referenceNumber': referenceNumber
    });

    if (existingRef && referenceNumber) {
      return res.status(400).json({
        success: false,
        message: 'Reference number already exists for this broker and branch'
      });
    }

    // Create transaction
    const transaction = {
      type: 'CREDIT',
      amount: parseFloat(amount),
      modeOfPayment,
      subPaymentMode: modeOfPayment === 'Bank' ? subPaymentMode : undefined,
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      remark: remark || 'On-account payment',
      branch: branchId,
      createdBy: userId,
      booking: null,
      bank: modeOfPayment === 'Bank' ? bankId : null,
      cashLocation: modeOfPayment === 'Cash' ? cashLocation : null,
      isOnAccount: true,
      adjustedAgainst: [],
      date: new Date(),
      approvalStatus: modeOfPayment === 'Cash' ? 'Approved' : 'Pending',
      ...(modeOfPayment === 'Cash' && {
        approvedBy: userId,
        approvedAt: new Date()
      })
    };

    // Use findOneAndUpdate with upsert to handle existing or new ledger
    const ledger = await BrokerLedger.findOneAndUpdate(
      { broker: brokerId, branch: branchId },
      {
        $push: { transactions: transaction },
        $inc: { 
          currentBalance: -parseFloat(amount),
          onAccount: parseFloat(amount)
        },
        $setOnInsert: {
          createdBy: userId,
          lastUpdatedBy: userId
        }
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true 
      }
    )
    .populate('broker', 'name mobile')
    .populate('branch', 'name')
    .populate('transactions.bank', 'name')
    .populate('transactions.cashLocation', 'name')
    .populate('transactions.subPaymentMode', 'payment_mode')
    .populate('transactions.createdBy', 'name');

    // Auto-allocate if payment is approved
    if (transaction.approvalStatus === 'Approved') {
      await autoAllocateOnAccountFunds(ledger, userId);
      await ledger.save();
    }

    res.status(201).json({
      success: true,
      data: ledger,
      onAccountBalance: ledger.onAccount,
      message: 'On-account payment added successfully'
    });

  } catch (error) {
    console.error('Error adding on-account payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding on-account payment'
    });
  }
};

const isObjectId = (v) => mongoose.isValidObjectId(v);

function sum(arr, fn = (x) => x) {
  return (arr || []).reduce((s, x) => s + Number(fn(x) || 0), 0);
}

function remainingForCreditTx(tx) {
  if (!tx || tx.type !== 'CREDIT') return 0;
  const allocated = sum(tx.allocations, (a) => a.amount);
  return Math.max(0, Number(tx.amount || 0) - allocated);
}

function buildPendingMap(ledger) {
  const debitByBooking = new Map();
  const allocatedByBooking = new Map();

  for (const tx of ledger.transactions || []) {
    if (tx.type === 'DEBIT' && tx.booking) {
      const k = String(tx.booking);
      debitByBooking.set(k, (debitByBooking.get(k) || 0) + Number(tx.amount || 0));
    }
    if (tx.type === 'CREDIT' && Array.isArray(tx.allocations)) {
      for (const a of tx.allocations) {
        if (!a?.booking) continue;
        const k = String(a.booking);
        allocatedByBooking.set(k, (allocatedByBooking.get(k) || 0) + Number(a.amount || 0));
      }
    }
  }

  const pending = new Map();
  for (const [k, dsum] of debitByBooking.entries()) {
    const as = allocatedByBooking.get(k) || 0;
    const bal = +(Number(dsum) - Number(as)).toFixed(2);
    if (bal > 0.001) pending.set(k, bal);
  }
  return pending;
}

exports.depositOnAccount = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    if (!isObjectId(brokerId) || !isObjectId(branchId)) {
      return res.status(400).json({ success: false, message: 'Invalid broker or branch id' });
    }

    const { amount, modeOfPayment, subPaymentMode, referenceNumber, bankId, remark, date } = req.body || {};
    const amt = Number(amount || 0);
    if (!(amt > 0)) return res.status(400).json({ success: false, message: 'amount must be > 0' });
    if (!referenceNumber || !String(referenceNumber).trim()) {
      return res.status(400).json({ success: false, message: 'referenceNumber is required' });
    }

    // Validate subPaymentMode for Bank payments
    if (modeOfPayment === 'Bank' && !subPaymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Sub-payment mode is required for bank payments'
      });
    }

    // Validate subPaymentMode exists if provided
    if (subPaymentMode) {
      const subPaymentModeExists = await BankSubPaymentMode.findById(subPaymentMode);
      if (!subPaymentModeExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sub-payment mode selected'
        });
      }
    }

    // Check if broker is associated with the branch
    const broker = await Broker.findById(brokerId);
    if (!broker) {
      return res.status(404).json({ success: false, message: 'Broker not found' });
    }
    
    const isBrokerInBranch = broker.branches.some(
      branch => branch.branch.toString() === branchId && branch.isActive
    );
    
    if (!isBrokerInBranch) {
      return res.status(400).json({
        success: false,
        message: 'Broker is not associated with this branch'
      });
    }

    // Enforce unique referenceNumber per broker per branch
    const dup = await BrokerLedger.findOne({ 
      broker: brokerId, 
      branch: branchId,
      'transactions.referenceNumber': referenceNumber 
    }, { _id: 1 }).lean();
    
    if (dup) return res.status(409).json({ 
      success: false, 
      message: 'referenceNumber already exists for this broker and branch' 
    });
 const creditTx = {
      type: 'CREDIT',
      amount: amt,
      modeOfPayment: modeOfPayment || 'Bank',
      subPaymentMode: modeOfPayment === 'Bank' ? subPaymentMode : undefined,
      referenceNumber: referenceNumber.trim(),
      bank: bankId || null,
      branch: branchId,
      remark: remark || '',
      isOnAccount: true,
      allocations: [],
      date: date ? new Date(date) : new Date(),
      createdBy: req.user?.id,
      approvalStatus: modeOfPayment === 'Cash' ? 'Approved' : 'Pending',
      ...(modeOfPayment === 'Cash' && {
        approvedBy: req.user?.id,
        approvedAt: new Date()
      })
    };

    // Check if ledger exists
    const existingLedger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId });
    
    let ledger;
    if (existingLedger) {
      // Update existing ledger
      ledger = await BrokerLedger.findOneAndUpdate(
        { broker: brokerId, branch: branchId },
        {
          $push: { transactions: creditTx },
          $inc: { 
            onAccount: amt,
            currentBalance: -amt
          }
        },
        { new: true }
      )
      .populate('broker', 'name mobile')
      .populate('branch', 'name')
      .lean();
    } else {
      // Create new ledger
      ledger = await BrokerLedger.create({
        broker: brokerId,
        branch: branchId,
        onAccount: amt,
        currentBalance: -amt,
        transactions: [creditTx],
        createdBy: req.user?.id
      });
      
      // Populate broker and branch info
      ledger = await BrokerLedger.findById(ledger._id)
        .populate('broker', 'name mobile')
        .populate('branch', 'name')
        .lean();
    }

    // Auto-allocate if payment is approved
     if (creditTx.approvalStatus === 'Approved') {
      const ledgerDoc = await BrokerLedger.findById(ledger._id);
      await autoAllocateOnAccountFunds(ledgerDoc, req.user?.id);
      await ledgerDoc.save();
    }
    

    return res.status(201).json({
      success: true,
      data: {
        broker: ledger.broker,
        branch: ledger.branch,
        onAccount: ledger.onAccount,
        reference: {
          referenceNumber: creditTx.referenceNumber,
          amount: creditTx.amount,
          modeOfPayment: creditTx.modeOfPayment,
          bankId: creditTx.bank,
          remark: creditTx.remark,
          remaining: creditTx.amount
        }
      }
    });
  } catch (err) {
    console.error('depositOnAccount error:', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};

exports.allocateReference = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const { referenceNumber, allocations } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!referenceNumber || !allocations || !Array.isArray(allocations)) {
      return res.status(400).json({
        success: false,
        message: 'Reference number and allocations array are required'
      });
    }

    // Find the ledger
    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId });
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker and branch'
      });
    }

    // Find the reference transaction
    const refTransaction = ledger.transactions.find(
      t => t.referenceNumber === referenceNumber && t.type === 'CREDIT'
    );

    if (!refTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Reference transaction not found'
      });
    }

    // Calculate remaining amount in reference
    const alreadyAllocated = refTransaction.allocations.reduce(
      (sum, alloc) => sum + alloc.amount, 0
    );
    const remainingAmount = refTransaction.amount - alreadyAllocated;

    // Validate allocations don't exceed remaining amount
    const totalAllocation = allocations.reduce(
      (sum, alloc) => sum + alloc.amount, 0
    );

    if (totalAllocation > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Total allocation (${totalAllocation}) exceeds remaining reference amount (${remainingAmount})`
      });
    }

    // Process each allocation
    for (const allocation of allocations) {
      // Validate booking exists
      const booking = await Booking.findById(allocation.booking);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: `Booking ${allocation.booking} not found`
        });
      }

      // Add allocation to reference transaction
      refTransaction.allocations.push({
        booking: allocation.booking,
        amount: allocation.amount,
        date: new Date(),
        allocationType: 'MANUAL'
      });

      // Update on-account balance
      ledger.onAccount -= allocation.amount;
    }

    await ledger.save();

    // Populate and return updated ledger
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('broker', 'name mobile')
      .populate('branch', 'name')
      .populate('transactions.booking', 'bookingNumber customerDetails')
      .populate('transactions.bank', 'name')
      .populate('transactions.allocations.booking', 'bookingNumber')
      .populate('transactions.createdBy', 'name');

    res.status(200).json({
      success: true,
      data: populatedLedger,
      message: 'Allocation successful'
    });

  } catch (error) {
    console.error('Error allocating reference:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error allocating reference'
    });
  }
};

exports.getOnAccountSummary = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    if (!isObjectId(brokerId) || !isObjectId(branchId)) {
      return res.status(400).json({ success: false, message: 'Invalid broker or branch id' });
    }

    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId }).lean();
    if (!ledger) {
      return res.json({ success: true, data: { onAccount: 0, references: [] } });
    }

    const references = [];
    for (const tx of ledger.transactions || []) {
      // Only include approved CREDIT transactions with reference numbers
      if (tx.type === 'CREDIT' && tx.referenceNumber && tx.approvalStatus === 'Approved') {
        const allocated = sum(tx.allocations, (a) => a.amount);
        const remaining = remainingForCreditTx(tx);
        references.push({
          referenceNumber: tx.referenceNumber,
          amount: Number(tx.amount || 0),
          allocated,
          remaining,
          modeOfPayment: tx.modeOfPayment || '',
          bankId: tx.bankId || '',
          remark: tx.remark || '',
          date: tx.date,
          isOnAccount: tx.isOnAccount || false
        });
      }
    }
    // newest first
    references.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      success: true,
      data: {
        onAccount: ledger.onAccount || 0,
        onAccountBalance: ledger.onAccountBalance || 0, // Use the virtual property
        references
      }
    });
  } catch (err) {
    console.error('getOnAccountSummary error:', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};

exports.getPendingDebits = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;

    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId })
      .populate('transactions.booking', 'bookingNumber customerDetails chassisNumber exchangeDetails');

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker and branch'
      });
    }

    // Calculate outstanding amounts per booking
    const bookingOutstanding = {};
    
    ledger.transactions.forEach(txn => {
      if (txn.booking && txn.type === 'DEBIT') {
        const bookingId = txn.booking._id.toString();
        if (!bookingOutstanding[bookingId]) {
          bookingOutstanding[bookingId] = {
            booking: txn.booking,
            totalDebit: 0,
            totalAdjusted: 0
          };
        }
        bookingOutstanding[bookingId].totalDebit += txn.amount;
      }

      if (txn.type === 'CREDIT' && txn.adjustedAgainst) {
        txn.adjustedAgainst.forEach(adjustment => {
          if (adjustment.booking) {
            const bookingId = adjustment.booking.toString();
            if (!bookingOutstanding[bookingId]) {
              bookingOutstanding[bookingId] = {
                booking: null,
                totalDebit: 0,
                totalAdjusted: 0
              };
            }
            bookingOutstanding[bookingId].totalAdjusted += adjustment.amount;
          }
        });
      }
    });

    // Format response
    const pendingDebits = Object.values(bookingOutstanding)
      .filter(item => item.totalDebit > item.totalAdjusted)
      .map(item => ({
        booking: item.booking,
        outstandingAmount: item.totalDebit - item.totalAdjusted
      }));

    // Get on-account balance
    const onAccountBalance = ledger.onAccount || 0;

    res.status(200).json({
      success: true,
      data: {
        pendingDebits,
        onAccountBalance
      }
    });

  } catch (error) {
    console.error('Error fetching pending debits:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching pending debits'
    });
  }
};

exports.getStatement = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { fromDate, toDate } = req.query;

    // Validate brokerId
    if (!mongoose.isValidObjectId(brokerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid broker ID'
      });
    }

    // Find all ledgers for this broker across all branches
    const ledgers = await BrokerLedger.find({ broker: brokerId })
      .populate('broker', 'name brokerId')
      .populate('branch', 'name code')
      .populate({
        path: 'transactions',
        match: {
          date: {
            $gte: new Date(fromDate || '1970-01-01'),
            $lte: new Date(toDate || Date.now())
          }
        },
        options: { sort: { date: 1 } },
        populate: [
          { 
            path: 'booking',
            select: 'bookingNumber customerDetails chassisNumber model color branch',
            populate: [
              {
                path: 'model',
                select: 'name'
              },
              {
                path: 'color',
                select: 'name'
              },
              {
                path: 'branch',
                select: 'name'
              }
            ]
          },
          { path: 'bank', select: 'name' },
          { path: 'cashLocation', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      });

    if (!ledgers || ledgers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No ledgers found for this broker'
      });
    }

    // Combine transactions from all branches and sort by date
    let allTransactions = [];
    ledgers.forEach(ledger => {
      if (ledger.transactions && ledger.transactions.length > 0) {
        ledger.transactions.forEach(txn => {
          // Add branch information to each transaction
          allTransactions.push({
            ...txn.toObject ? txn.toObject() : txn,
            branchName: ledger.branch?.name || 'Unknown Branch',
            branchCode: ledger.branch?.code || ''
          });
        });
      }
    });

    // Sort all transactions by date
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance across all branches
    let runningBalance = 0;
    const statement = allTransactions.map(txn => {
      if (txn.type === 'CREDIT') {
        runningBalance -= txn.amount;
      } else {
        runningBalance += txn.amount;
      }

      return {
        date: txn.date,
        type: txn.type,
        amount: txn.amount,
        mode: txn.modeOfPayment,
        referenceNumber: txn.referenceNumber,
        branch: txn.branchName,
        branchCode: txn.branchCode,
        booking: txn.booking ? {
          bookingNumber: txn.booking.bookingNumber,
          customerName: txn.booking.customerDetails ? 
            `${txn.booking.customerDetails.salutation || ''} ${txn.booking.customerDetails.name || ''}`.trim() : 
            'N/A',
          chassisNumber: txn.booking.chassisNumber,
          model: txn.booking.model?.name,
          color: txn.booking.color?.name,
          branch: txn.booking.branch?.name
        } : null,
        bank: txn.bank?.name,
        cashLocation: txn.cashLocation?.name,
        remark: txn.remark,
        balance: runningBalance,
        createdBy: txn.createdBy?.name
      };
    });

    // Get unique branches
    const uniqueBranches = [...new Set(ledgers.map(l => l.branch?.name).filter(Boolean))];

    res.status(200).json({
      success: true,
      data: {
        broker: ledgers[0].broker,
        branches: uniqueBranches,
        closingBalance: runningBalance,
        fromDate: fromDate || ledgers[0].createdAt,
        toDate: toDate || new Date(),
        transactions: statement,
        summary: {
          totalCredit: statement.reduce((sum, t) => t.type === 'CREDIT' ? sum + t.amount : sum, 0),
          totalDebit: statement.reduce((sum, t) => t.type === 'DEBIT' ? sum + t.amount : sum, 0),
          netBalance: runningBalance
        }
      }
    });

  } catch (error) {
    console.error('Error generating statement:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating statement'
    });
  }
};

exports.getDetailedBrokersSummary = async (req, res) => {
  try {
    const { branchId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Build query for brokers
    let brokerQuery = { 'branches.isActive': true };
    if (branchId) {
      brokerQuery['branches.branch'] = branchId;
    }

    // Get all brokers with pagination
    const brokers = await Broker.find(brokerQuery)
      .populate('branches.branch', 'name code address')
      .populate('createdBy', 'name email')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Broker.countDocuments(brokerQuery);

    // Get all exchange bookings with detailed information
    const exchangeBookings = await Booking.find({ exchange: true })
      .populate('exchangeDetails.broker', 'name mobile email')
      .populate('branch', 'name code')
      .populate('model', 'name variant')
      .populate('color', 'name code')
      .populate('salesExecutive', 'name')
      .populate('customerDetails', 'name mobile email address')
      .lean();

    // Get all ledger entries with detailed transactions
    const ledgerEntries = await BrokerLedger.find()
      .populate('broker', 'name mobile email')
      .populate('branch', 'name code')
      .populate({
        path: 'transactions',
        populate: [
          { path: 'booking', select: 'bookingNumber customerDetails chassisNumber' },
          { path: 'bank', select: 'name' },
          { path: 'cashLocation', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      })
      .lean();

    // Create maps for quick lookup
    const bookingsByBrokerAndBranch = {};
    const ledgerByBrokerAndBranch = {};

    // Process exchange bookings with detailed information
    exchangeBookings.forEach(booking => {
      if (booking.exchangeDetails && booking.exchangeDetails.broker && booking.branch) {
        const brokerId = booking.exchangeDetails.broker._id?.toString();
        const branchId = booking.branch._id?.toString();
        
        if (brokerId && branchId) {
          if (!bookingsByBrokerAndBranch[brokerId]) {
            bookingsByBrokerAndBranch[brokerId] = {};
          }
          if (!bookingsByBrokerAndBranch[brokerId][branchId]) {
            bookingsByBrokerAndBranch[brokerId][branchId] = [];
          }
          
          // Add detailed booking information
          const detailedBooking = {
            _id: booking._id,
            bookingNumber: booking.bookingNumber,
            bookingDate: booking.bookingDate,
            customerDetails: booking.customerDetails ? {
              name: booking.customerDetails.name,
              mobile: booking.customerDetails.mobile,
              email: booking.customerDetails.email,
              address: booking.customerDetails.address
            } : null,
            vehicleDetails: {
              model: booking.model ? {
                name: booking.model.name,
                variant: booking.model.variant
              } : null,
              color: booking.color ? {
                name: booking.color.name,
                code: booking.color.code
              } : null,
              chassisNumber: booking.chassisNumber,
              engineNumber: booking.engineNumber
            },
            exchangeDetails: {
              exchangeAmount: booking.exchangeDetails?.exchangeAmount || 0,
              oldVehicleDetails: booking.exchangeDetails?.oldVehicleDetails || {},
              rcStatus: booking.exchangeDetails?.rcStatus
            },
            financeDetails: booking.financeDetails ? {
              bank: booking.financeDetails.bank?.name,
              loanAmount: booking.financeDetails.loanAmount,
              status: booking.financeDetails.status
            } : null,
            salesExecutive: booking.salesExecutive?.name,
            bookingStatus: booking.bookingStatus,
            deliveryStatus: booking.deliveryStatus,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
          };
          
          bookingsByBrokerAndBranch[brokerId][branchId].push(detailedBooking);
        }
      }
    });

    // Process ledger entries with detailed transactions
    ledgerEntries.forEach(ledger => {
      if (ledger.broker && ledger.branch) {
        const brokerId = ledger.broker._id?.toString();
        const branchId = ledger.branch._id?.toString();
        
        if (brokerId && branchId) {
          if (!ledgerByBrokerAndBranch[brokerId]) {
            ledgerByBrokerAndBranch[brokerId] = {};
          }
          
          // Add detailed ledger information
          const detailedLedger = {
            _id: ledger._id,
            currentBalance: ledger.currentBalance || 0,
            onAccount: ledger.onAccount || 0,
            transactions: (ledger.transactions || []).map(txn => ({
              _id: txn._id,
              date: txn.date,
              type: txn.type,
              amount: txn.amount,
              modeOfPayment: txn.modeOfPayment,
              referenceNumber: txn.referenceNumber,
              bank: txn.bank?.name,
              cashLocation: txn.cashLocation?.name,
              booking: txn.booking ? {
                bookingNumber: txn.booking.bookingNumber,
                customerName: txn.booking.customerDetails ? 
                  `${txn.booking.customerDetails.salutation || ''} ${txn.booking.customerDetails.name || ''}`.trim() : 
                  'N/A',
                chassisNumber: txn.booking.chassisNumber
              } : null,
              remark: txn.remark,
              isOnAccount: txn.isOnAccount,
              allocations: txn.allocations || [],
              adjustedAgainst: txn.adjustedAgainst || [],
              createdBy: txn.createdBy?.name,
              createdAt: txn.createdAt
            })),
            createdAt: ledger.createdAt,
            updatedAt: ledger.updatedAt
          };
          
          ledgerByBrokerAndBranch[brokerId][branchId] = detailedLedger;
        }
      }
    });

    // Prepare the response data with comprehensive details
    const brokerSummaries = [];

    for (const broker of brokers) {
      const brokerId = broker._id.toString();
      
      for (const branchInfo of broker.branches || []) {
        if (!branchInfo.branch) continue;
        
        const currentBranchId = branchInfo.branch._id.toString();
        
        // Skip if we're filtering by branch and this isn't the right branch
        if (branchId && currentBranchId !== branchId) {
          continue;
        }

        // Get bookings for this broker and branch
        const bookings = bookingsByBrokerAndBranch[brokerId]?.[currentBranchId] || [];
        
        // Calculate total exchange amount and other metrics
        const totalExchangeAmount = bookings.reduce((sum, booking) => {
          return sum + (booking.exchangeDetails?.exchangeAmount || 0);
        }, 0);

        const deliveredBookings = bookings.filter(b => b.deliveryStatus === 'Delivered').length;
        const pendingBookings = bookings.filter(b => b.deliveryStatus !== 'Delivered').length;

        // Get ledger information
        const ledgerInfo = ledgerByBrokerAndBranch[brokerId]?.[currentBranchId] || {
          currentBalance: 0,
          onAccount: 0,
          transactions: []
        };

        // Calculate total credit and debit from transactions
        let totalCredit = 0;
        let totalDebit = 0;
        let recentTransactions = [];

        if (ledgerInfo.transactions) {
          ledgerInfo.transactions.forEach(txn => {
            if (txn.type === 'CREDIT') {
              totalCredit += txn.amount || 0;
            } else if (txn.type === 'DEBIT') {
              totalDebit += txn.amount || 0;
            }
          });

          // Get recent 5 transactions sorted by date (newest first)
          recentTransactions = [...ledgerInfo.transactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        }

        // Calculate outstanding amount (debits - credits)
        const outstandingAmount = Math.max(0, totalDebit - totalCredit);

        brokerSummaries.push({
          broker: {
            _id: broker._id,
            name: broker.name,
            mobile: broker.mobile,
            email: broker.email,
            address: broker.address,
            brokerId: broker.brokerId,
            panNumber: broker.panNumber,
            gstNumber: broker.gstNumber,
            bankDetails: broker.bankDetails,
            createdAt: broker.createdAt
          },
          branch: {
            _id: branchInfo.branch._id,
            name: branchInfo.branch.name,
            code: branchInfo.branch.code,
            address: branchInfo.branch.address
          },
          bookings: {
            total: bookings.length,
            delivered: deliveredBookings,
            pending: pendingBookings,
            details: bookings.map(booking => ({
              _id: booking._id,
              bookingNumber: booking.bookingNumber,
              bookingDate: booking.bookingDate,
              customer: booking.customerDetails,
              vehicle: booking.vehicleDetails,
              exchangeAmount: booking.exchangeDetails.exchangeAmount,
              status: {
                booking: booking.bookingStatus,
                delivery: booking.deliveryStatus
              },
              createdAt: booking.createdAt
            }))
          },
          financials: {
            totalExchangeAmount,
            ledger: {
              currentBalance: ledgerInfo.currentBalance,
              onAccount: ledgerInfo.onAccount,
              totalCredit,
              totalDebit,
              outstandingAmount,
              transactions: ledgerInfo.transactions.length
            },
            summary: {
              totalReceived: totalCredit,
              totalPayable: totalDebit,
              netBalance: ledgerInfo.currentBalance
            }
          },
          recentTransactions: recentTransactions,
          association: {
            since: branchInfo.associationDate,
            isActive: branchInfo.isActive,
            commissionRate: branchInfo.commissionRate
          },
          lastUpdated: broker.updatedAt || broker.createdAt
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        brokers: brokerSummaries,
        summary: {
          totalBrokers: brokerSummaries.length,
          totalBookings: brokerSummaries.reduce((sum, b) => sum + b.bookings.total, 0),
          totalExchangeAmount: brokerSummaries.reduce((sum, b) => sum + b.financials.totalExchangeAmount, 0),
          totalOutstanding: brokerSummaries.reduce((sum, b) => sum + b.financials.ledger.outstandingAmount, 0),
          totalOnAccount: brokerSummaries.reduce((sum, b) => sum + b.financials.ledger.onAccount, 0)
        },
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / limit),
          count: brokerSummaries.length,
          totalRecords: totalCount,
          hasNext: parseInt(page) < Math.ceil(totalCount / limit),
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching detailed brokers summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching detailed brokers summary',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.getBrokerWiseSummary = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get all brokers for the specified branch
    const brokers = await Broker.find({ 
      'branches.branch': branchId, 
      'branches.isActive': true 
    })
    .populate('branches.branch')
    .populate('createdBy', 'name email')
    .skip(skip)
    .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Broker.countDocuments({ 
      'branches.branch': branchId, 
      'branches.isActive': true 
    });

    // Get all exchange bookings for this branch
    const exchangeBookings = await Booking.find({ 
      exchange: true,
      branch: branchId 
    })
    .populate('exchangeDetails.broker')
    .populate('model')
    .populate('color')
    .lean();

    // Get all ledger entries for this branch
    const ledgerEntries = await BrokerLedger.find({ branch: branchId })
      .populate('broker')
      .lean();

    // Create maps for quick lookup
    const bookingsByBroker = {};
    const ledgerByBroker = {};

    exchangeBookings.forEach(booking => {
      if (booking.exchangeDetails && booking.exchangeDetails.broker) {
        const brokerId = booking.exchangeDetails.broker._id.toString();
        if (!bookingsByBroker[brokerId]) {
          bookingsByBroker[brokerId] = [];
        }
        bookingsByBroker[brokerId].push(booking);
      }
    });

    ledgerEntries.forEach(ledger => {
      const brokerId = ledger.broker._id.toString();
      ledgerByBroker[brokerId] = ledger;
    });

    // Prepare response
    const brokerSummaries = brokers.map(broker => {
      const brokerId = broker._id.toString();
      const bookings = bookingsByBroker[brokerId] || [];
      const ledger = ledgerByBroker[brokerId] || {
        currentBalance: 0,
        onAccount: 0
      };

      const totalExchangeAmount = bookings.reduce((sum, booking) => {
        return sum + (booking.exchangeDetails?.exchangeAmount || 0);
      }, 0);

      return {
        broker: {
          _id: broker._id,
          name: broker.name,
          mobile: broker.mobile,
          email: broker.email,
          brokerId: broker.brokerId
        },
        totalBookings: bookings.length,
        totalExchangeAmount,
        ledger: {
          currentBalance: ledger.currentBalance,
          onAccount: ledger.onAccount
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        branch: branchId,
        brokers: brokerSummaries,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / limit),
          count: brokerSummaries.length,
          totalRecords: totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching broker-wise summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching broker-wise summary'
    });
  }
};
// Add this new function to manually trigger auto-allocation
// In brokerLedgerController.js - update the autoAllocateFunds function
exports.autoAllocateFunds = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const userId = req.user.id;

    console.log(`Auto-allocation triggered for broker: ${brokerId}, branch: ${branchId}`);

    // Find the ledger with proper population
    const ledger = await BrokerLedger.findOne({ broker: brokerId, branch: branchId })
      .populate('transactions.allocations.booking')
      .populate('transactions.booking');
    
    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker and branch'
      });
    }

    console.log(`Current onAccount balance: ${ledger.onAccountBalance}`);

    // Auto-allocate on-account funds
    const updatedLedger = await autoAllocateOnAccountFunds(ledger, userId);
    
    if (updatedLedger.isModified()) {
      await updatedLedger.save();
      console.log('Auto-allocation completed and saved');
    } else {
      console.log('No changes made during auto-allocation');
    }

    // Return detailed response
    res.status(200).json({
      success: true,
      data: {
        onAccountBalanceBefore: ledger.onAccountBalance,
        onAccountBalanceAfter: updatedLedger.onAccountBalance,
        allocationsMade: updatedLedger.transactions.reduce((count, tx) => 
          count + (tx.allocations?.filter(a => a.allocationType === 'AUTO').length || 0), 0
        )
      },
      message: 'Auto-allocation completed successfully'
    });

  } catch (error) {
    console.error('Error in auto-allocation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error in auto-allocation',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};