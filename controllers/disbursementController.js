const mongoose = require('mongoose');
const Disbursement = require('../models/Disbursement');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Role = require('../models/Role');

exports.createDisbursement = async (req, res) => {
  try {
    const { bookingId, disbursementAmount, downPaymentExpected, is_deviation } = req.body;

    if (!bookingId || disbursementAmount === undefined || downPaymentExpected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, disbursementAmount, and downPaymentExpected are required'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    // Check if disbursement already exists for this booking
    const existingDisbursement = await Disbursement.findOne({ booking: bookingId });
    if (existingDisbursement) {
      return res.status(400).json({
        success: false,
        message: 'A disbursement already exists for this booking. Only one disbursement is allowed per booking.'
      });
    }

    // Load booking
    const booking = await Booking.findById(bookingId)
      .populate('payment.financer', 'name')
      .populate('branch', 'name')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (!booking.payment || booking.payment.type !== 'FINANCE') {
      return res.status(400).json({ success: false, message: 'Booking is not a finance type' });
    }

    // Customer paid so far (ledger/receipts); DO NOT include manager deviation here
    const customerPaid = typeof booking.receivedAmount === 'number'
      ? Number(booking.receivedAmount)
      : (Array.isArray(booking.receipts)
          ? booking.receipts.reduce((sum, r) => sum + Number(r?.amount || 0), 0)
          : 0);

    const dpExpected = Number(downPaymentExpected || 0);
    const disbursementAmt = Number(disbursementAmount || 0);
    const shortfall = Math.max(0, dpExpected - customerPaid);

    // ===== Deal Amount Validation =====
    const dealAmount = Number(booking.discountedAmount || 0);
    
    // Check if disbursement + down payment equals deal amount
    if (!is_deviation) {
      // Without deviation: disbursement + downPaymentExpected should equal deal amount
      if (disbursementAmt + dpExpected !== dealAmount) {
        return res.status(400).json({
          success: false,
          message: `Without manager deviation, disbursement amount (${disbursementAmt}) + down payment expected (${dpExpected}) must equal deal amount (${dealAmount})`
        });
      }
    }

    // ===== Deviation handling from Branch Manager =====
    let deviationUsed = 0;
    let perTxnLimit = 0;
    let availableBefore = 0;
    let availableAfter = 0;
    let managerDoc = null;

    if (is_deviation && shortfall > 0) {
      // 1) MANAGER role
      const managerRole = await Role.findOne({ name: { $regex: /^manager$/i } }).lean();
      if (!managerRole) {
        return res.status(404).json({ success: false, message: 'MANAGER role not found' });
      }

      // 2) Manager in same branch & ACTIVE
      const branchId = booking.branch && booking.branch._id ? booking.branch._id : booking.branch;
      managerDoc = await User.findOne({
        branch: branchId,
        roles: managerRole._id,
        status: 'ACTIVE'
      }).select('name totalDeviationAmount currentDeviationUsage perTransactionDeviationLimit').exec();

      if (!managerDoc) {
        return res.status(404).json({ success: false, message: 'Branch manager not configured for this branch' });
      }

      // 3) Compute remaining deviation & per-txn cap
      const totalDeviationAmount = Number(managerDoc.totalDeviationAmount || 0);
      const currentDeviationUsage = Number(managerDoc.currentDeviationUsage || 0);
      perTxnLimit = Number(managerDoc.perTransactionDeviationLimit || 0);

      const remainingDeviation = Math.max(0, totalDeviationAmount - currentDeviationUsage);
      availableBefore = remainingDeviation;

      // === CORE RULE YOU ASKED FOR ===
      // Take from manager exactly up to perTransactionDeviationLimit,
      // but never more than remainingDeviation or the actual shortfall.
      deviationUsed = Math.min(
        shortfall,
        remainingDeviation,
        perTxnLimit > 0 ? perTxnLimit : shortfall
      );

      availableAfter = Math.max(0, remainingDeviation - deviationUsed);
      
      // ===== With deviation: disbursement + downPaymentExpected + deviation should equal deal amount =====
      if (disbursementAmt + dpExpected + deviationUsed !== dealAmount) {
        return res.status(400).json({
          success: false,
          message: `With manager deviation, disbursement amount (${disbursementAmt}) + down payment expected (${dpExpected}) + deviation (${deviationUsed}) must equal deal amount (${dealAmount})`
        });
      }
    } else if (is_deviation && shortfall <= 0) {
      // Deviation requested but no shortfall exists
      return res.status(400).json({
        success: false,
        message: 'Manager deviation requested but no down payment shortfall exists'
      });
    }

    // Create the disbursement (financer's amount). Deviation is logical, not ledger.
    const disbursement = await Disbursement.create({
      booking: bookingId,
      disbursementAmount: disbursementAmt,
      notes: '',
      status: 'COMPLETED',
      createdBy: req.user?.id,
      deviationApplied: deviationUsed > 0,
      deviationAmount: deviationUsed
    });

    // Update manager usage by the amount ACTUALLY used
    if (managerDoc && deviationUsed > 0) {
      managerDoc.currentDeviationUsage = Number(managerDoc.currentDeviationUsage || 0) + deviationUsed;
      await managerDoc.save();
    }

    // Effective down-payment considered for chassis allocation:
    // customerPaid (ledger) + deviationUsed (manager support)
    const allocationDownPaymentCovered = customerPaid + deviationUsed;

    return res.status(201).json({
      success: true,
      data: {
        disbursement: disbursement.toObject(),
        inputs: {
          disbursementAmount: disbursementAmt,
          downPaymentExpected: dpExpected
        },
        customer: {
          paid: customerPaid,
          pendingCustomerDownPayment: Math.max(0, dpExpected - customerPaid) // ledger-facing pending (do not subtract deviation)
        },
        deviation: {
          used: deviationUsed,
          perTransactionDeviationLimit: perTxnLimit,
          availableBefore,
          availableAfter
        },
        allocationCheck: {
          // Use this in your chassis allocation rule:
          // finance (disbursementAmount) + allocationDownPaymentCovered should meet deal amount condition
          downPaymentCoveredForAllocation: allocationDownPaymentCovered
        }
      }
    });
  } catch (err) {
    console.error('Error creating disbursement:', err);
    return res.status(500).json({
      success: false,
      message: 'Error creating disbursement'
    });
  }
};