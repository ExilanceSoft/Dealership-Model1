const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const KYC = require('../models/KYC');
const FinanceLetter = require('../models/FinanceLetter');

module.exports = async (req, res, next) => {
  try {
    // Skip if not a booking creation request
    if (req.method !== 'POST' || !req.originalUrl.includes('/bookings')) {
      return next();
    }

    const user = await User.findById(req.user.id).populate('roles');
    if (!user) {
      await AuditLog.create({
        action: 'VALIDATE_SALES_EXECUTIVE',
        entity: 'Booking',
        user: req.user.id,
        ip: req.ip,
        status: 'FAILED',
        error: 'User not found'
      });
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const isSalesExecutive = user.roles.some(r => r.name === 'SALES_EXECUTIVE');
    const isSuperAdmin = user.roles.some(r => r.isSuperAdmin);

    // Super Admins must select a sales executive
    if (isSuperAdmin) {
      if (!req.body.sales_executive) {
        await AuditLog.create({
          action: 'VALIDATE_SALES_EXECUTIVE',
          entity: 'Booking',
          user: req.user.id,
          ip: req.ip,
          status: 'FAILED',
          error: 'Super Admin did not select sales executive'
        });
        return res.status(400).json({
          success: false,
          message: 'Sales executive selection is required for Super Admin'
        });
      }
      
      // Check if selected sales executive is frozen
      const selectedSE = await User.findById(req.body.sales_executive);
      if (selectedSE.isFrozen) {
        return res.status(400).json({
          success: false,
          message: `Selected sales executive is frozen due to: ${selectedSE.freezeReason}`
        });
      }
      return next();
    }

    // Non-Sales Executive users must select a sales executive
    if (isSalesExecutive) {
  // Find their latest booking with pending documents
  const latestBooking = await Booking.findOne({
    $or: [
      { createdBy: user._id },
      { salesExecutive: user._id }
    ],
    status: { $in: ['APPROVED', 'PENDING_APPROVAL'] }
  }).sort({ createdAt: -1 });

  if (latestBooking) {
    const [kyc, financeLetter] = await Promise.all([
      KYC.findOne({ booking: latestBooking._id }),
      latestBooking.payment.type === 'FINANCE' 
        ? FinanceLetter.findOne({ booking: latestBooking._id })
        : Promise.resolve(true)
    ]);

    // Check if any documents are missing
    const missingDocuments = [];
    if (!kyc) missingDocuments.push('KYC');
    if (latestBooking.payment.type === 'FINANCE' && !financeLetter) {
      missingDocuments.push('Finance Letter');
    }

    if (missingDocuments.length > 0) {
      // Freeze the user if not already frozen (original behavior)
      if (!user.isFrozen) {
        await User.findByIdAndUpdate(user._id, {
          isFrozen: true,
          freezeReason: `Pending ${missingDocuments.join(' and ')} submission for booking ${latestBooking.bookingNumber}`
        });
      }

      return res.status(400).json({
        success: false,
        message: `You have pending document submissions for booking ${latestBooking.bookingNumber}. Please submit all required documents before creating new bookings.`
      });
    }
  }

  // If no pending documents, allow booking creation
  if (!req.body.sales_executive) {
    req.body.sales_executive = req.user.id;
  }
}

    // For Sales Executives - check if they're frozen
    if (user.isFrozen) {
      return res.status(400).json({
        success: false,
        message: `Your account is frozen due to: ${user.freezeReason}. Please submit pending documents before creating new bookings.`
      });
    }

    // Check if they have pending documents from previous bookings
    const now = new Date();
    if (user.documentBufferTime && user.documentBufferTime < now) {
      // Find their latest booking with pending documents
      const latestBooking = await Booking.findOne({
        $or: [
          { createdBy: user._id },
          { salesExecutive: user._id }
        ],
        status: { $in: ['APPROVED', 'PENDING_APPROVAL'] }
      }).sort({ createdAt: -1 });

      if (latestBooking) {
        const [kyc, financeLetter] = await Promise.all([
          KYC.findOne({ booking: latestBooking._id }),
          latestBooking.payment.type === 'FINANCE' 
            ? FinanceLetter.findOne({ booking: latestBooking._id })
            : Promise.resolve(true)
        ]);

        if (!kyc || (latestBooking.payment.type === 'FINANCE' && !financeLetter)) {
          // Freeze the user if not already frozen
          if (!user.isFrozen) {
            await User.findByIdAndUpdate(user._id, {
              isFrozen: true,
              freezeReason: `Pending ${!kyc ? 'KYC' : ''}${!kyc && !financeLetter ? ' and ' : ''}${!financeLetter && latestBooking.payment.type === 'FINANCE' ? 'Finance Letter' : ''} submission for booking ${latestBooking.bookingNumber}`
            });
          }

          return res.status(400).json({
            success: false,
            message: `You have pending document submissions for booking ${latestBooking.bookingNumber}. Please submit all required documents before creating new bookings.`
          });
        }
      }
    }

    // Sales Executives can create bookings for themselves
    if (!req.body.sales_executive) {
      req.body.sales_executive = req.user.id;
    }
    
    next();
  } catch (err) {
    console.error('Error in validateSalesExecutive middleware:', err);
    await AuditLog.create({
      action: 'VALIDATE_SALES_EXECUTIVE',
      entity: 'Booking',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error during sales executive validation'
    });
  }
};