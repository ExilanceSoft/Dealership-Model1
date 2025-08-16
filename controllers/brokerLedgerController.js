const BrokerLedger = require('../models/BrokerLedger');
const Broker = require('../models/Broker');
const AuditLog = require('../models/AuditLog');

// Initialize ledger when a new broker is created
exports.initializeLedger = async (brokerId, userId) => {
  try {
    const existingLedger = await BrokerLedger.findOne({ broker: brokerId });
    if (!existingLedger) {
      await BrokerLedger.create({
        broker: brokerId,
        totalAmount: 0,
        balanceAmount: 0,
        createdBy: userId
      });
    }
  } catch (err) {
    console.error('Error initializing broker ledger:', err);
    throw err;
  }
};

// Add payment to broker ledger
exports.addPayment = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { amount, modeOfPayment, bank, cashLocation, remark } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!amount || !modeOfPayment) {
      return res.status(400).json({
        success: false,
        message: 'Amount and mode of payment are required'
      });
    }
    // Validate mode-specific fields
    if (modeOfPayment === 'Bank' && !bank) {
      return res.status(400).json({
        success: false,
        message: 'Bank reference is required for bank payments'
      });
    }

    if (modeOfPayment === 'Cash' && !cashLocation) {
      return res.status(400).json({
        success: false,
        message: 'Cash location is required for cash payments'
      });
    }

    // Find or create ledger
    let ledger = await BrokerLedger.findOne({ broker: brokerId });

    if (!ledger) {
      ledger = await BrokerLedger.create({
        broker: brokerId,
        totalAmount: 0,
        balanceAmount: 0,
        createdBy: userId
      });
    }

    // Add payment
    const payment = {
      amount,
      modeOfPayment,
      remark,
      createdBy: userId
    };

    if (modeOfPayment === 'Bank') {
      payment.bank = bank;
    } else if (modeOfPayment === 'Cash') {
      payment.cashLocation = cashLocation;
    }

    ledger.payments.push(payment);
    ledger.totalAmount += amount;
    await ledger.save();

    // Log the action
    await AuditLog.create({
      action: 'ADD_PAYMENT',
      entity: 'BrokerLedger',
      entityId: ledger._id,
      user: userId,
      ip: req.ip,
      metadata: {
        broker: brokerId,
        amount,
        modeOfPayment,
        newBalance: ledger.balanceAmount
      }
    });

    res.status(201).json({
      success: true,
      data: ledger
    });
  } catch (err) {
    console.error('Error adding payment to broker ledger:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error adding payment'
    });
  }
};

// Get broker ledger
// Get broker ledger
exports.getLedger = async (req, res) => {
  try {
    const { brokerId } = req.params;

    const ledger = await BrokerLedger.findOne({ broker: brokerId })
      .populate('brokerDetails')
      .populate('createdByDetails')
      .populate({
        path: 'payments.bank',
        select: 'name'
      })
      .populate({
        path: 'payments.cashLocation',
        select: 'name'
      })
      .populate({
        path: 'payments.createdBy',
        select: 'name email'
      });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found for this broker'
      });
    }

    // Transform the data into the requested format
    const responseData = {
      broker: {
        id: ledger.broker._id,
        name: ledger.brokerDetails?.name || '',
        mobile: ledger.brokerDetails?.mobile || '',
        email: ledger.brokerDetails?.email || ''
      },
      ledgerDate: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      branch: "JOGPREET Asher Estate, Near Ichhamani Lawns, Upnagar, Nashik Road, Nashik", // Static for now, you might want to populate this from broker's branch
      transactions: ledger.payments.map((payment, index) => ({
        date: payment.date.toISOString().split('T')[0],
        description: payment.remark || `Payment ${index + 1}`,
        receiptNo: `REC${index + 1}`.padStart(5, '0'), // Generate a receipt number
        credit: payment.amount,
        debit: 0,
        balance: ledger.balanceAmount // This might need adjustment based on your business logic
      })),
      totals: {
        credit: ledger.totalAmount,
        debit: 0, // You might need to adjust this based on your business logic
        balance: ledger.balanceAmount
      }
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (err) {
    console.error('Error fetching broker ledger:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error fetching ledger'
    });
  }
};


// Get all broker ledgers
exports.getAllLedgers = async (req, res) => {
  try {
    const ledgers = await BrokerLedger.find({})
      .populate('brokerDetails')
      .populate('createdByDetails');

    res.status(200).json({
      success: true,
      count: ledgers.length,
      data: ledgers
    });
  } catch (err) {
    console.error('Error fetching all broker ledgers:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error fetching ledgers'
    });
  }
};