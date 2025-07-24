const Receipt = require('../models/Receipt');
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

// Helper function to create ledger entries
const createLedgerEntries = async (receipt, user) => {
  const ledgerEntries = [];
  
  for (const payment of receipt.payments) {
    const ledgerData = {
      booking: receipt.booking,
      receipt: receipt._id,
      type: 'CREDIT',
      amount: payment.amount,
      mode: payment.mode,
      bank: payment.bank,
      bankLocation: payment.bankLocation,
      cashLocation: payment.cashLocation,
      referenceNumber: payment.referenceNumber,
      date: payment.date,
      remarks: `Receipt ${receipt.receiptNumber} payment`,
      status: 'CLEARED',
      createdBy: user.id
    };
    
    const ledgerEntry = await Ledger.create(ledgerData);
    ledgerEntries.push(ledgerEntry._id);
  }
  
  return ledgerEntries;
};

exports.createReceipt = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['booking', 'totalAmount', 'receivedAmount', 'payments'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate booking
    const booking = await Booking.findById(req.body.booking);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if received amount is valid
    if (req.body.receivedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received amount must be greater than 0'
      });
    }

    // Check if total amount matches booking's discounted amount
    if (req.body.totalAmount !== booking.discountedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Total amount does not match booking amount'
      });
    }

    // Validate payments
    let totalPayments = 0;
    for (const payment of req.body.payments) {
      if (!payment.mode || !payment.amount) {
        return res.status(400).json({
          success: false,
          message: 'Each payment must have mode and amount'
        });
      }
      
      if (payment.amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than 0'
        });
      }
      
      // Validate bank details for bank/payorder modes
      if ((payment.mode === 'BANK' || payment.mode === 'PAYORDER') && !payment.bank) {
        return res.status(400).json({
          success: false,
          message: 'Bank is required for bank/payorder payments'
        });
      }
      
      totalPayments += payment.amount;
    }

    // Check if payments match received amount
    if (Math.abs(totalPayments - req.body.receivedAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Sum of payments must equal received amount'
      });
    }

    // Create receipt
    const receiptData = {
      booking: req.body.booking,
      totalAmount: req.body.totalAmount,
      receivedAmount: req.body.receivedAmount,
      payments: req.body.payments,
      remarks: req.body.remarks,
      createdBy: req.user.id
    };

    const receipt = await Receipt.create(receiptData);

    // Create ledger entries
    const ledgerEntries = await createLedgerEntries(receipt, req.user);

    // Update booking with receipt and ledger info
    await Booking.findByIdAndUpdate(req.body.booking, {
      $inc: { receivedAmount: req.body.receivedAmount },
      $push: { 
        receipts: receipt._id,
        ledgerEntries: { $each: ledgerEntries }
      }
    });

    // Log the creation
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Receipt',
      entityId: receipt._id,
      user: req.user.id,
      ip: req.ip,
      metadata: receiptData,
      status: 'SUCCESS'
    });

    res.status(201).json({
      success: true,
      data: receipt
    });
  } catch (err) {
    console.error('Error creating receipt:', err);
    
    let message = 'Error creating receipt';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    } else if (err.code === 11000) {
      message = 'Duplicate value entered for unique field';
    }
    
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Receipt',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: message
    }).catch(logErr => console.error('Failed to create audit log:', logErr));
    
    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.confirmReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    if (receipt.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Only draft receipts can be confirmed'
      });
    }

    // Update receipt status
    receipt.status = 'CONFIRMED';
    receipt.confirmedBy = req.user.id;
    await receipt.save();

    // Log the confirmation
    await AuditLog.create({
      action: 'CONFIRM',
      entity: 'Receipt',
      entityId: receipt._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { receiptId: receipt._id },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (err) {
    console.error('Error confirming receipt:', err);
    
    await AuditLog.create({
      action: 'CONFIRM',
      entity: 'Receipt',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error confirming receipt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getReceiptsByBooking = async (req, res) => {
  try {
    const receipts = await Receipt.find({ booking: req.params.bookingId })
      .sort({ createdAt: -1 })
      .populate('bookingDetails')
      .populate('createdByDetails')
      .populate('confirmedByDetails');

    res.status(200).json({
      success: true,
      count: receipts.length,
      data: receipts
    });
  } catch (err) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('bookingDetails')
      .populate('createdByDetails')
      .populate('confirmedByDetails')
      .populate({
        path: 'payments.bank',
        model: 'Bank'
      });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.generateReceiptPDF = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('bookingDetails')
      .populate('createdByDetails')
      .populate('confirmedByDetails')
      .populate({
        path: 'payments.bank',
        model: 'Bank'
      });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // TODO: Implement PDF generation logic here
    // This would use a template similar to your booking form template

    res.status(200).json({
      success: true,
      message: 'PDF generation endpoint - implement actual PDF generation',
      data: receipt
    });
  } catch (err) {
    console.error('Error generating receipt PDF:', err);
    res.status(500).json({
      success: false,
      message: 'Error generating receipt PDF',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};