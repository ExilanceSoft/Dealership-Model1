// middlewares/documentDeadline.js
const Booking = require('../models/Booking');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const checkDocumentDeadlines = async () => {
  try {
    // Find all APPROVED bookings where documents aren't submitted within 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const overdueBookings = await Booking.find({
      status: 'APPROVED',
      createdAt: { $lte: oneDayAgo },
      $or: [
        { kycStatus: { $in: ['NOT_SUBMITTED', 'PENDING'] } },
        { 
          payment: { type: 'FINANCE' },
          financeLetterStatus: { $in: ['NOT_SUBMITTED', 'PENDING'] }
        }
      ]
    }).populate('salesExecutive');

    for (const booking of overdueBookings) {
      const salesExecutive = booking.salesExecutive;
      if (!salesExecutive) continue;

      // Check if buffer time has expired
      if (new Date() > salesExecutive.documentBufferTime) {
        // Freeze the sales executive
        salesExecutive.isFrozen = true;
        salesExecutive.freezeReason = `Failed to submit required documents for booking ${booking.bookingNumber} within deadline`;
        await salesExecutive.save();

        // Log the freeze action
        await AuditLog.create({
          action: 'FREEZE_USER',
          entity: 'User',
          entityId: salesExecutive._id,
          user: null, // System action
          ip: 'SYSTEM',
          metadata: {
            reason: salesExecutive.freezeReason,
            booking: booking._id
          },
          status: 'SUCCESS'
        });
      }
    }
  } catch (error) {
    console.error('Error checking document deadlines:', error);
  }
};

// Run this check every hour
setInterval(checkDocumentDeadlines, 60 * 60 * 1000);

// Also run immediately on startup
checkDocumentDeadlines();

module.exports = checkDocumentDeadlines;