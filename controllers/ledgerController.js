const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const Receipt = require('../models/Receipt');
const Bank = require('../models/Bank');
const CashLocation = require('../models/cashLocation');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

exports.addReceipt = async (req, res, next) => {
  try {
    const { bookingId, paymentMode, amount, cashLocation, bank, transactionReference, remark } = req.body;
    
    // Validate required fields
    if (!bookingId || !paymentMode || !amount) {
      return next(new AppError('Booking ID, payment mode and amount are required', 400));
    }

    // Validate amount
    if (amount <= 0) {
      return next(new AppError('Amount must be greater than 0', 400));
    }

    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(new AppError('No booking found with that ID', 404));
    }

    // Calculate current balance
    const currentBalance = booking.discountedAmount - (booking.receivedAmount || 0);
    
    // Check if payment would exceed balance
    if (amount > currentBalance) {
      return next(new AppError(`Amount exceeds balance. Maximum allowed: ${currentBalance}`, 400));
    }

    // Validate payment mode specific fields
    if (paymentMode === 'Cash') {
      if (!cashLocation) {
        return next(new AppError('Cash location is required for cash payments', 400));
      }
      
      // Validate cash location exists
      const cashLoc = await CashLocation.findById(cashLocation);
      if (!cashLoc) {
        return next(new AppError('Invalid cash location selected', 400));
      }
    } 
    else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode)) {
      if (!bank) {
        return next(new AppError('Bank is required for non-cash payments', 400));
      }
      
      // Validate bank exists
      const bankExists = await Bank.findById(bank);
      if (!bankExists) {
        return next(new AppError('Invalid bank selected', 400));
      }
    }

    // Create ledger entry (transactionReference is now optional)
    const ledgerEntry = await Ledger.create({
      booking: bookingId,
      paymentMode,
      amount,
      receivedBy: req.user.id,
      cashLocation: paymentMode === 'Cash' ? cashLocation : undefined,
      bank: ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode) ? bank : undefined,
      transactionReference: transactionReference || undefined,
      remark
    });

    // Generate unique receipt number
    const receiptNumber = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create receipt
    const receipt = await Receipt.create({
      booking: bookingId,
      amount,
      paymentMode,
      details: ledgerEntry._id,
      generatedBy: req.user.id,
      receiptNumber
    });

    // Update booking amounts
    booking.receivedAmount = (booking.receivedAmount || 0) + amount;
    booking.balanceAmount = booking.discountedAmount - booking.receivedAmount;
    booking.receipts.push(receipt._id);
    booking.ledgerEntries.push(ledgerEntry._id);
    
    await booking.save();

    // Populate the response
    const populatedLedger = await Ledger.findById(ledgerEntry._id)
      .populate('bankDetails')
      .populate('cashLocationDetails')
      .populate('receivedByDetails');

    res.status(201).json({
      status: 'success',
      data: {
        ledger: populatedLedger,
        booking: {
          receivedAmount: booking.receivedAmount,
          balanceAmount: booking.balanceAmount,
          discountedAmount: booking.discountedAmount
        }
      }
    });
  } catch (err) {
    logger.error(`Error adding receipt: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

exports.getLedgerEntries = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Invalid booking ID format', 400));
    }

    const ledgerEntries = await Ledger.find({ booking: bookingId })
      .populate('bankDetails')
      .populate('cashLocationDetails')
      .populate('receivedByDetails')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: ledgerEntries.length,
      data: {
        ledgerEntries
      }
    });
  } catch (err) {
    logger.error(`Error getting ledger entries: ${err.message}`);
    next(err);
  }
};

exports.getLedgerSummary = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Invalid booking ID format', 400));
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(new AppError('No booking found with that ID', 404));
    }

    const totalReceived = await Ledger.aggregate([
      { $match: { booking: new mongoose.Types.ObjectId(bookingId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalAmount: booking.discountedAmount,
        totalReceived: totalReceived.length > 0 ? totalReceived[0].total : 0,
        balanceAmount: booking.discountedAmount - (totalReceived.length > 0 ? totalReceived[0].total : 0)
      }
    });
  } catch (err) {
    logger.error(`Error getting ledger summary: ${err.message}`);
    next(err);
  }
};

exports.updateLedgerEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { receiptId } = req.params;
    const { paymentMode, amount, cashLocation, bank, transactionReference, remark } = req.body;

    if (!mongoose.Types.ObjectId.isValid(receiptId)) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Invalid receipt ID format', 400));
    }

    const ledgerEntry = await Ledger.findById(receiptId).session(session);
    if (!ledgerEntry) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('No ledger entry found with that ID', 404));
    }

    // Check if the ledger entry is associated with a booking
    const booking = await Booking.findOne({ ledgerEntries: ledgerEntry._id }).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Associated booking not found', 404));
    }

    // Calculate the difference if amount is being updated
    let amountDifference = 0;
    if (amount && amount !== ledgerEntry.amount) {
      if (amount <= 0) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Amount must be greater than 0', 400));
      }
      amountDifference = amount - ledgerEntry.amount;
      
      // Check if new amount would exceed balance
      if (amountDifference > 0 && amountDifference > booking.balanceAmount) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(`Amount increase exceeds balance. Maximum allowed increase: ${booking.balanceAmount}`, 400));
      }
    }

    // Validate payment mode specific fields
    if (paymentMode === 'Cash') {
      if (!cashLocation) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Cash location is required for cash payments', 400));
      }
      
      // Validate cash location exists
      const cashLoc = await CashLocation.findById(cashLocation).session(session);
      if (!cashLoc) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Invalid cash location selected', 400));
      }
    } 
    else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode)) {
      if (!bank) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Bank is required for non-cash payments', 400));
      }
      
      // Validate bank exists
      const bankExists = await Bank.findById(bank).session(session);
      if (!bankExists) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError('Invalid bank selected', 400));
      }
    }

    // Save old amount for audit
    const oldAmount = ledgerEntry.amount;

    // Update the ledger entry
    ledgerEntry.paymentMode = paymentMode || ledgerEntry.paymentMode;
    ledgerEntry.amount = amount || ledgerEntry.amount;
    ledgerEntry.cashLocation = paymentMode === 'Cash' ? cashLocation : undefined;
    ledgerEntry.bank = ['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(paymentMode) ? bank : undefined;
    ledgerEntry.transactionReference = transactionReference || undefined;
    ledgerEntry.remark = remark || ledgerEntry.remark;
    
    await ledgerEntry.save({ session });

    // Update booking amounts if amount changed
    if (amountDifference !== 0) {
      booking.receivedAmount += amountDifference;
      booking.balanceAmount = booking.discountedAmount - booking.receivedAmount;
      await booking.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedLedger = await Ledger.findById(ledgerEntry._id)
      .populate('bankDetails')
      .populate('cashLocationDetails')
      .populate('receivedByDetails');

    res.status(200).json({
      status: 'success',
      data: {
        ledger: populatedLedger,
        booking: {
          receivedAmount: booking.receivedAmount,
          balanceAmount: booking.balanceAmount
        }
      }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error updating ledger entry: ${err.message}`);
    next(err);
  }
};

exports.getBankList = async (req, res, next) => {
  try {
    const banks = await Bank.find({ status: 'active' })
      .select('name branchDetails')
      .populate('branchDetails', 'name')
      .sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: banks.length,
      data: {
        banks: banks.map(bank => ({
          _id: bank._id,
          name: bank.name,
          branch: bank.branchDetails?.name || 'N/A'
        }))
      }
    });
  } catch (err) {
    logger.error(`Error getting bank list: ${err.message}`);
    next(err);
  }
};

exports.getCashLocations = async (req, res, next) => {
  try {
    const cashLocations = await CashLocation.find({ status: 'active' })
      .select('name description branchDetails')
      .populate('branchDetails', 'name')
      .sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: cashLocations.length,
      data: {
        cashLocations: cashLocations.map(loc => ({
          _id: loc._id,
          name: loc.name,
          description: loc.description,
          branch: loc.branchDetails?.name || 'N/A'
        }))
      }
    });
  } catch (err) {
    logger.error(`Error getting cash locations: ${err.message}`);
    next(err);
  }
};

exports.getLedgerReport = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Invalid booking ID format', 400));
    }

    // Get booking details with all necessary population
    const booking = await Booking.findById(bookingId)
      .populate('customerDetails')
      .populate('salesExecutiveDetails', 'name')
      .populate('modelDetails', 'name')
      .populate('colorDetails', 'name')
      .populate({
        path: 'branchDetails',
        select: 'name address city state pincode phone email gst_number is_active logo1 logo2 createdAt updatedAt'
      })
      .populate({
        path: 'payment.financer',
        select: 'name',
        model: 'FinanceProvider'
      });

    if (!booking) {
      return next(new AppError('No booking found with that ID', 404));
    }

    // Get all ledger entries for this booking with full branch details
    const ledgerEntries = await Ledger.find({ booking: bookingId })
      .populate({
        path: 'bankDetails',
        select: 'name ifscCode',
        populate: {
          path: 'branchDetails',
          select: 'name address city state pincode phone email gst_number is_active logo1 logo2 createdAt updatedAt'
        }
      })
      .populate({
        path: 'cashLocationDetails',
        select: 'name description',
        populate: {
          path: 'branchDetails',
          select: 'name address city state pincode phone email gst_number is_active logo1 logo2 createdAt updatedAt'
        }
      })
      .populate('receivedByDetails', 'name')
      .sort({ createdAt: 1 });

    // Prepare entries with running balance
    let balance = booking.discountedAmount;
    const formattedEntries = [];
    
    // Add initial booking entry (as debit)
    formattedEntries.push({
      date: booking.createdAt.toLocaleDateString('en-GB'),
      description: `${booking.modelDetails?.name || 'N/A'} ${booking.colorDetails?.name || 'N/A'} SALES PRICE AGAINST BOOKING`,
      receiptNo: booking.bookingNumber,
      status: 'Active',
      credit: 0,
      debit: booking.discountedAmount,
      balance: balance,
      branch: booking.branchDetails
    });

    // Add all payment entries (as credits that reduce the balance)
    ledgerEntries.forEach(entry => {
      balance -= entry.amount;
      
      let description = '';
      let branchDetails = booking.branchDetails;

      // Determine branch for this entry
      if (entry.paymentMode === 'Cash' && entry.cashLocationDetails?.branchDetails) {
        branchDetails = entry.cashLocationDetails.branchDetails;
      } else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(entry.paymentMode) && 
                 entry.bankDetails?.branchDetails) {
        branchDetails = entry.bankDetails.branchDetails;
      }

      if (entry.paymentMode === 'Cash') {
        description = `Cash Payment - ${entry.cashLocationDetails?.name || 'N/A'}`;
      } else if (['Bank', 'Finance Disbursement', 'Exchange', 'Pay Order'].includes(entry.paymentMode)) {
        description = `${entry.paymentMode} - ${entry.bankDetails?.name || 'N/A'} (Ref: ${entry.transactionReference})`;
      } else {
        description = `${entry.paymentMode} Payment`;
      }

      formattedEntries.push({
        date: entry.createdAt.toLocaleDateString('en-GB'),
        description: description,
        receiptNo: entry._id.toString().slice(-6).toUpperCase(),
        status: 'Active',
        credit: entry.amount,
        debit: 0,
        balance: balance,
        branch: branchDetails
      });
    });

    // Prepare response
    const response = {
      customerDetails: {
        name: `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name}`.trim(),
        address: `${booking.customerDetails.address}, ${booking.customerDetails.taluka}, ${booking.customerDetails.district}, ${booking.customerDetails.pincode}`,
        phone: booking.customerDetails.mobile1,
        aadharNo: booking.customerDetails.aadharNumber || 'N/A',
        panNo: booking.customerDetails.panNo || 'N/A'
      },
      vehicleDetails: {
        chassisNo: booking.chassisNumber || 'N/A',
        engineNo: booking.engineNumber || 'N/A',
        model: booking.modelDetails?.name || 'N/A',
        color: booking.colorDetails?.name || 'N/A'
      },
      financeDetails: {
        financer: booking.payment.type === 'FINANCE' 
          ? (booking.payment.financer?.name || 'N/A') 
          : '---Select Financer Name----'
      },
      branchDetails: booking.branchDetails,
      salesExecutive: booking.salesExecutiveDetails?.name || 'N/A',
      ledgerDate: new Date().toLocaleDateString('en-GB'),
      entries: formattedEntries,
      totals: {
        totalCredit: formattedEntries.reduce((sum, entry) => sum + entry.credit, 0),
        totalDebit: formattedEntries.reduce((sum, entry) => sum + entry.debit, 0),
        finalBalance: balance
      }
    };

    res.status(200).json({
      status: 'success',
      data: response
    });
  } catch (err) {
    logger.error(`Error getting ledger report: ${err.message}`);
    next(err);
  }
};

exports.getBookingTypeCounts = async (req, res, next) => {
  try {
    // Get counts for different booking statuses
    const counts = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          pfBookings: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'PENDING_APPROVAL'] },
                1,
                0
              ]
            }
          },
          npfBookings: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'APPROVED'] },
                1,
                0
              ]
            }
          },
          draftBookings: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'DRAFT'] },
                1,
                0
              ]
            }
          },
          rejectedBookings: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'REJECTED'] },
                1,
                0
              ]
            }
          },
          completedBookings: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'COMPLETED'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalBookings: 1,
          pfBookings: 1,
          npfBookings: 1,
          draftBookings: 1,
          rejectedBookings: 1,
          completedBookings: 1
        }
      }
    ]);

    // If no bookings exist yet
    const result = counts.length > 0 ? counts[0] : {
      totalBookings: 0,
      pfBookings: 0,
      npfBookings: 0,
      draftBookings: 0,
      rejectedBookings: 0,
      completedBookings: 0
    };

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    logger.error(`Error getting booking type counts: ${err.message}`);
    next(err);
  }
};

exports.getBranchLedgerSummary = async (req, res, next) => {
  try {
    // Aggregate all bookings and their ledger entries
    const branchSummary = await Booking.aggregate([
      {
        $lookup: {
          from: 'ledgers',
          localField: '_id',
          foreignField: 'booking',
          as: 'ledgerEntries'
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
      {
        $unwind: {
          path: '$branchDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          branchId: '$branch',
          branchName: '$branchDetails.name',
          discountedAmount: 1, // This is the debit (vehicle cost)
          creditAmount: {
            $sum: '$ledgerEntries.amount' // Sum of all payments (credits)
          }
        }
      },
      {
        $group: {
          _id: '$branchId',
          branchName: { $first: '$branchName' },
          totalDebit: { $sum: '$discountedAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      },
      {
        $project: {
          _id: 0,
          branchId: '$_id',
          branchName: 1,
          totalDebit: 1,
          totalCredit: 1,
          finalBalance: { $subtract: ['$totalDebit', '$totalCredit'] }
        }
      },
      {
        $sort: { branchName: 1 }
      }
    ]);

    // Calculate totals across all branches
    const allBranchesSummary = {
      totalDebit: 0,
      totalCredit: 0,
      finalBalance: 0
    };

    branchSummary.forEach(branch => {
      allBranchesSummary.totalDebit += branch.totalDebit;
      allBranchesSummary.totalCredit += branch.totalCredit;
      allBranchesSummary.finalBalance += branch.finalBalance;
    });

    res.status(200).json({
      status: 'success',
      data: {
        allBranches: allBranchesSummary,
        byBranch: branchSummary
      }
    });
  } catch (err) {
    logger.error(`Error getting branch ledger summary: ${err.message}`);
    next(err);
  }
};

exports.addDebit = async (req, res, next) => {
  try {
    const { bookingId, amount, debitReason, remark } = req.body;
    
    // Validate required fields
    if (!bookingId || !amount || !debitReason) {
      return next(new AppError('Booking ID, amount and debit reason are required', 400));
    }

    // Validate amount
    if (amount <= 0) {
      return next(new AppError('Amount must be greater than 0', 400));
    }

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return next(new AppError('Authentication required', 401));
    }

    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(new AppError('No booking found with that ID', 404));
    }

    // Create ledger entry (without paymentMode)
    const ledgerEntry = await Ledger.create({
      booking: bookingId,
      type: 'DEBIT_ENTRY',
      amount,
      debitReason,
      isDebit: true,
      receivedBy: req.user.id,
      remark
    });

    // Update booking balance
    booking.balanceAmount = (booking.balanceAmount || 0) + amount;
    booking.ledgerEntries.push(ledgerEntry._id);
    await booking.save();

    // Populate the response
    const populatedLedger = await Ledger.findById(ledgerEntry._id)
      .populate('receivedByDetails', 'name email')
      .populate('bookingDetails', 'bookingNumber customerDetails.name');

    res.status(201).json({
      status: 'success',
      data: {
        ledger: populatedLedger,
        booking: {
          balanceAmount: booking.balanceAmount
        }
      }
    });
  } catch (err) {
    logger.error(`Error adding debit: ${err.message}`);
    next(new AppError('Failed to add debit entry', 500));
  }
};


exports.getDebitsByBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new AppError('Invalid booking ID format', 400));
    }

    const debits = await Ledger.find({ 
      booking: bookingId, 
      isDebit: true 
    })
    .populate('receivedByDetails', 'name email')
    .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: debits.length,
      data: {
        debits
      }
    });
  } catch (err) {
    logger.error(`Error getting debits by booking: ${err.message}`);
    next(new AppError('Failed to get debits for booking', 500));
  }
};