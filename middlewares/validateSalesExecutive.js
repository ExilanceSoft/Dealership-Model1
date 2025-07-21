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
      
      // Create error object and pass to next
      const err = new Error('User not found');
      err.status = 401;
      return next(err);
    }

    const isSalesExecutive = user.roles.some(r => r.name === 'SALES_EXECUTIVE');
    const isSuperAdmin = user.roles.some(r => r.isSuperAdmin);

    // 1. Handle Super Admin case
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
        
        const err = new Error('Sales executive selection is required for Super Admin');
        err.status = 400;
        return next(err);
      }
      
      // Check if selected sales executive is frozen
      const selectedSE = await User.findById(req.body.sales_executive);
      if (selectedSE.isFrozen) {
        const err = new Error(`Selected sales executive is frozen due to: ${selectedSE.freezeReason}`);
        err.status = 400;
        return next(err);
      }
      return next();
    }

    // 2. Handle Sales Executive case
    if (isSalesExecutive) {
      // Check if user is frozen
      if (user.isFrozen) {
        const err = new Error(`Your account is frozen due to: ${user.freezeReason}. Please submit pending documents before creating new bookings.`);
        err.status = 400;
        return next(err);
      }

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
            : Promise.resolve(null)
        ]);

        // Check if any documents are missing
        const missingDocuments = [];
        if (!kyc || kyc.status !== 'APPROVED') missingDocuments.push('KYC');
        if (latestBooking.payment.type === 'FINANCE' && (!financeLetter || financeLetter.status !== 'APPROVED')) {
          missingDocuments.push('Finance Letter');
        }

        if (missingDocuments.length > 0) {
          // Check if deadline has passed
          const now = new Date();
          if (user.documentBufferTime && now > user.documentBufferTime) {
            // Freeze the user if not already frozen
            if (!user.isFrozen) {
              await User.findByIdAndUpdate(user._id, {
                isFrozen: true,
                freezeReason: `Pending ${missingDocuments.join(' and ')} submission for booking ${latestBooking.bookingNumber}`
              });
            }

            const err = new Error(`You have pending document submissions for booking ${latestBooking.bookingNumber}. Please submit all required documents before creating new bookings.`);
            err.status = 400;
            return next(err);
          }
        }
      }

      // If no pending documents or deadline not passed, allow booking creation
      if (!req.body.sales_executive) {
        req.body.sales_executive = req.user.id;
      }
      return next();
    }

    // 3. Handle regular users (non-Sales Executive, non-Super Admin)
    if (!req.body.sales_executive) {
      const err = new Error('Sales executive selection is required');
      err.status = 400;
      return next(err);
    }

    // Check if selected sales executive is frozen
    const selectedSE = await User.findById(req.body.sales_executive);
    if (selectedSE.isFrozen) {
      const err = new Error(`Selected sales executive is frozen due to: ${selectedSE.freezeReason}`);
      err.status = 400;
      return next(err);
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
    
    // Pass error to Express error handler
    next(err);
  }
};