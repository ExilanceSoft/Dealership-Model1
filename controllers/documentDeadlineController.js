// controllers/documentDeadlineController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const FrozenSalesExecutive = require('../models/FrozenSalesExecutive');
const AuditLog = require('../models/AuditLog');
const moment = require('moment');

// Check document deadlines and freeze sales executives if needed
exports.checkDocumentDeadlines = async () => {
  try {
    const now = new Date();
    const overdueBookings = await Booking.find({
      status: 'APPROVED',
      documentDeadline: { $lt: now },
      $or: [
        { kycStatus: { $in: ['NOT_SUBMITTED', 'PENDING'] } },
        { 
          'payment.type': 'FINANCE',
          financeLetterStatus: { $in: ['NOT_SUBMITTED', 'PENDING'] }
        }
      ]
    }).populate('salesExecutive');

    for (const booking of overdueBookings) {
      // Check if sales executive is already frozen
      const salesExecutive = await User.findById(booking.salesExecutive);
      if (salesExecutive && !salesExecutive.isFrozen) {
        // Freeze the sales executive
        salesExecutive.isFrozen = true;
        salesExecutive.frozenAt = now;
        salesExecutive.frozenReason = `Failed to submit required documents for booking ${booking.bookingNumber} within deadline`;
        await salesExecutive.save();

        // Record in FrozenSalesExecutive collection
        await FrozenSalesExecutive.create({
          user: salesExecutive._id,
          frozenBy: booking.createdBy, // or system user if automated
          reason: salesExecutive.frozenReason
        });

        // Log the action
        await AuditLog.create({
          action: 'AUTO_FREEZE_SALES_EXECUTIVE',
          entity: 'User',
          entityId: salesExecutive._id,
          user: null, // system action
          ip: 'system',
          metadata: {
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            reason: 'Document submission deadline missed'
          },
          status: 'SUCCESS'
        });
      }

      // Update booking status to show documents are overdue
      booking.kycStatus = booking.kycStatus === 'PENDING' ? 'PENDING_OVERDUE' : 'NOT_SUBMITTED_OVERDUE';
      if (booking.payment.type === 'FINANCE') {
        booking.financeLetterStatus = booking.financeLetterStatus === 'PENDING' ? 'PENDING_OVERDUE' : 'NOT_SUBMITTED_OVERDUE';
      }
      await booking.save();
    }

    return { success: true, processed: overdueBookings.length };
  } catch (error) {
    console.error('Error checking document deadlines:', error);
    return { success: false, error: error.message };
  }
};

// Extend deadline for a booking
exports.extendDeadline = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { hours, reason } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // Check if user has permission to extend deadlines
    const isManagerOrAdmin = req.user.roles.some(r => 
      ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(r.name)
    );
    
    if (!isManagerOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to extend deadlines' 
      });
    }

    const currentDeadline = booking.documentDeadline;
    const newDeadline = new Date(currentDeadline);
    newDeadline.setHours(newDeadline.getHours() + parseInt(hours));

    // Record the extension
    booking.documentDeadline = newDeadline;
    booking.deadlineExtended = true;
    booking.deadlineExtensions.push({
      extendedBy: userId,
      previousDeadline: currentDeadline,
      newDeadline: newDeadline,
      reason: reason || 'No reason provided'
    });
    
    await booking.save();

    // Log the action
    await AuditLog.create({
      action: 'EXTEND_DOCUMENT_DEADLINE',
      entity: 'Booking',
      entityId: booking._id,
      user: userId,
      ip: req.ip,
      metadata: {
        previousDeadline: currentDeadline,
        newDeadline: newDeadline,
        hoursExtended: hours,
        reason: reason
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        previousDeadline: currentDeadline,
        newDeadline: newDeadline,
        extendedBy: userId
      }
    });
  } catch (error) {
    console.error('Error extending deadline:', error);
    
    await AuditLog.create({
      action: 'EXTEND_DOCUMENT_DEADLINE',
      entity: 'Booking',
      entityId: req.params.bookingId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Error extending deadline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Unfreeze a sales executive
exports.unfreezeSalesExecutive = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }

    // Check if requester has permission
    const isManagerOrAdmin = req.user.roles.some(r => 
      ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(r.name)
    );
    
    if (!isManagerOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to unfreeze users' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isFrozen) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not frozen' 
      });
    }

    // Unfreeze the user
    user.isFrozen = false;
    user.frozenReason = undefined;
    user.frozenAt = undefined;
    await user.save();

    // Update frozen record
    await FrozenSalesExecutive.findOneAndUpdate(
      { user: userId, unfrozenAt: { $exists: false } },
      { 
        unfrozenAt: new Date(),
        unfrozenBy: adminId,
        unfrozenReason: reason || 'No reason provided'
      }
    );

    // Log the action
    await AuditLog.create({
      action: 'UNFREEZE_SALES_EXECUTIVE',
      entity: 'User',
      entityId: userId,
      user: adminId,
      ip: req.ip,
      metadata: {
        reason: reason
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        unfrozenAt: new Date(),
        unfrozenBy: adminId
      }
    });
  } catch (error) {
    console.error('Error unfreezing sales executive:', error);
    
    await AuditLog.create({
      action: 'UNFREEZE_SALES_EXECUTIVE',
      entity: 'User',
      entityId: req.params.userId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Error unfreezing sales executive',
      error: process.env.NODE_ENN === 'development' ? error.message : undefined
    });
  }
};