const BrokerLedger = require('../models/BrokerLedger');
const Broker = require('../models/Broker');
const Booking = require('../models/Booking');
const Bank = require('../models/Bank');
const CashLocation = require('../models/cashLocation');
const booking = require('../models/Booking');

// Initialize ledger for new broker
// Initialize ledger for new broker
exports.initializeLedger = async (brokerId, userId) => {
  try {
    const existingLedger = await BrokerLedger.findOne({ broker: brokerId });
    if (!existingLedger) {
      const newLedger = await BrokerLedger.create({
        broker: brokerId,
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

// Add transaction to ledger
exports.addTransaction = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { 
      type, 
      amount, 
      modeOfPayment, 
      bookingId, 
      bankId, 
      cashLocation: locationId,
      remark 
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!type || !amount || !modeOfPayment) {
      return res.status(400).json({
        success: false,
        message: 'Type, amount, and modeOfPayment are required fields'
      });
    }

    // Validate payment mode specific fields
    if (modeOfPayment === 'Bank' && !bankId) {
      return res.status(400).json({
        success: false,
        message: 'Bank reference is required for bank payments'
      });
    }

    if (modeOfPayment === 'Cash' && !locationId) {
      return res.status(400).json({
        success: false,
        message: 'Cash location is required for cash payments'
      });
    }

    // Check if broker exists
    const broker = await Broker.findById(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Validate bank if provided
    if (bankId) {
      const bank = await Bank.findById(bankId);
      if (!bank) {
        return res.status(404).json({
          success: false,
          message: 'Bank not found'
        });
      }
    }

    // Validate cash location if provided
    if (locationId) {
      const location = await CashLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Cash location not found'
        });
      }
    }

    // Validate booking if provided
    let bookingDetails = null;
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      bookingDetails = {
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerDetails ? 
          `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name || ''}`.trim() : 
          'N/A',
        chassisNumber: booking.chassisNumber
      };
    }

    // Find or create ledger
    let ledger = await BrokerLedger.findOne({ broker: brokerId });
    if (!ledger) {
      ledger = await this.initializeLedger(brokerId, userId);
    }

    // Create transaction
    const transaction = {
      type,
      amount: parseFloat(amount),
      modeOfPayment,
      remark,
      createdBy: userId,
      booking: bookingId || null,
      bank: modeOfPayment === 'Bank' ? bankId : null,
      cashLocation: modeOfPayment === 'Cash' ? locationId : null
    };

    // Add transaction to ledger
    ledger.transactions.push(transaction);
    
    // Update current balance
    if (type === 'CREDIT') {
      ledger.currentBalance += parseFloat(amount);
    } else {
      ledger.currentBalance -= parseFloat(amount);
    }
    
    await ledger.save();

    // Update exchange status if this is a credit transaction for a booking with exchange
    if (type === 'CREDIT' && bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking && booking.exchange && booking.exchangeDetails && booking.exchangeDetails.status === 'PENDING') {
        booking.exchangeDetails.status = 'COMPLETED';
        booking.exchangeDetails.completedAt = new Date();
        await booking.save();
      }
    }

    // Populate the response data
    const populatedLedger = await BrokerLedger.findById(ledger._id)
      .populate('broker', 'name brokerId')
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
      .populate('transactions.createdBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedLedger
    });

  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding transaction'
    });
  }
};

// Get ledger with transactions
exports.getLedger = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { page = 1, limit = 20, fromDate, toDate } = req.query;

    const query = { broker: brokerId };
    
    // Date range filter
    if (fromDate || toDate) {
      query['transactions.date'] = {};
      if (fromDate) query['transactions.date'].$gte = new Date(fromDate);
      if (toDate) query['transactions.date'].$lte = new Date(toDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { 'transactions.date': -1 },
      populate: [
        { path: 'broker', select: 'name brokerId' },
        { 
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
        },
        { path: 'transactions.bank', select: 'name' },
        { path: 'transactions.cashLocation', select: 'name' },
        { path: 'transactions.createdBy', select: 'name' }
      ]
    };

    const ledger = await BrokerLedger.paginate(query, options);

    if (!ledger || ledger.totalDocs === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker'
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

// Get ledger statement
exports.getStatement = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { fromDate, toDate } = req.query;

    const ledger = await BrokerLedger.findOne({ broker: brokerId })
      .populate('broker', 'name brokerId')
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

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker'
      });
    }

    // Calculate running balance
    let runningBalance = 0;
    const statement = ledger.transactions.map(txn => {
      if (txn.type === 'CREDIT') runningBalance += txn.amount;
      else runningBalance -= txn.amount;

      return {
        date: txn.date,
        type: txn.type,
        amount: txn.amount,
        mode: txn.modeOfPayment,
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

    res.status(200).json({
      success: true,
      data: {
        broker: ledger.broker,
        closingBalance: runningBalance,
        fromDate: fromDate || ledger.createdAt,
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
// Get summary of all brokers with their ledger information
// Add this to brokerLedgerController.js

/**
 * Get detailed broker summary with bookings and ledger information
 */
/**
 * Get detailed broker summary with bookings and ledger information
 */
exports.getDetailedBrokersSummary = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // First get all brokers
    const brokers = await Broker.find({})
      .populate('branches.branch')
      .populate('createdBy', 'name email');

    // Get all bookings with exchange=true and populate broker details
    const exchangeBookings = await Booking.find({ exchange: true })
      .populate('exchangeDetails.broker')
      .populate('branch')
      .populate('model')
      .populate('color')
      .lean();

    // Group bookings by broker
    const bookingsByBroker = {};
    exchangeBookings.forEach(booking => {
      if (booking.exchangeDetails && booking.exchangeDetails.broker) {
        const brokerId = booking.exchangeDetails.broker._id.toString();
        if (!bookingsByBroker[brokerId]) {
          bookingsByBroker[brokerId] = [];
        }
        bookingsByBroker[brokerId].push(booking);
      }
    });

    // Get all ledger entries grouped by broker
    const ledgerEntries = await BrokerLedger.aggregate([
      {
        $group: {
          _id: '$broker',
          currentBalance: { $first: '$currentBalance' },
          totalCredit: {
            $sum: {
              $reduce: {
                input: '$transactions',
                initialValue: 0,
                in: {
                  $cond: [
                    { $eq: ['$$this.type', 'CREDIT'] },
                    { $add: ['$$value', '$$this.amount'] },
                    '$$value'
                  ]
                }
              }
            }
          },
          totalDebit: {
            $sum: {
              $reduce: {
                input: '$transactions',
                initialValue: 0,
                in: {
                  $cond: [
                    { $eq: ['$$this.type', 'DEBIT'] },
                    { $add: ['$$value', '$$this.amount'] },
                    '$$value'
                  ]
                }
              }
            }
          }
        }
      }
    ]);

    const ledgerByBroker = {};
    ledgerEntries.forEach(entry => {
      ledgerByBroker[entry._id.toString()] = {
        currentBalance: entry.currentBalance || 0,
        totalCredit: entry.totalCredit || 0,
        totalDebit: entry.totalDebit || 0
      };
    });

    // Prepare the response data
    const brokerSummaries = brokers.map(broker => {
      const brokerId = broker._id.toString();
      const bookings = bookingsByBroker[brokerId] || [];
      const ledger = ledgerByBroker[brokerId] || {
        currentBalance: 0,
        totalCredit: 0,
        totalDebit: 0
      };

      const pending = bookings.filter(b => 
        b.exchangeDetails.status === 'PENDING'
      ).length;
      const completed = bookings.filter(b => 
        b.exchangeDetails.status === 'COMPLETED'
      ).length;

      return {
        broker: {
          _id: broker._id,
          name: broker.name,
          mobile: broker.mobile,
          email: broker.email,
          otp_required: broker.otp_required,
          branches: broker.branches
        },
        currentBalance: ledger.currentBalance,
        totalCredit: ledger.totalCredit,
        totalDebit: ledger.totalDebit,
        bookingsCount: bookings.length,
        bookings: bookings.map(booking => ({
          _id: booking._id,
          bookingNumber: booking.bookingNumber,
          customerName: `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name || ''}`.trim(),
          chassisNumber: booking.chassisNumber,
          exchangeDetails: {
            price: booking.exchangeDetails.price,
            vehicleNumber: booking.exchangeDetails.vehicleNumber,
            chassisNumber: booking.exchangeDetails.chassisNumber,
            otpVerified: booking.exchangeDetails.otpVerified,
            status: booking.exchangeDetails.status,
            completedAt: booking.exchangeDetails.completedAt,
            createdAt: booking.exchangeDetails.createdAt
          },
          bookingStatus: booking.status,
          totalAmount: booking.totalAmount,
          discountedAmount: booking.discountedAmount,
          createdAt: booking.createdAt,
          branchDetails: booking.branch
        })),
        exchangeStats: {
          pending,
          completed,
          total: bookings.length
        }
      };
    });

    // Apply pagination
    const total = brokerSummaries.length;
    const paginatedData = brokerSummaries.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        docs: paginatedData,
        totalDocs: total,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        pagingCounter: skip + 1,
        hasPrevPage: page > 1,
        hasNextPage: page * limit < total,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page * limit < total ? page + 1 : null
      }
    });

  } catch (error) {
    console.error('Error fetching detailed brokers summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching detailed brokers summary'
    });
  }
};