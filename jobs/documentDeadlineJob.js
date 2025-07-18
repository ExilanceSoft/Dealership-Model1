const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const KYC = require('../models/KYC');
const FinanceLetter = require('../models/FinanceLetter');
const Role = require('../models/Role');

const runDocumentCheck = async () => {
  try {
    console.log('Running document submission check...');
    
    const salesExecutiveRole = await Role.findOne({ name: 'SALES_EXECUTIVE' });
    if (!salesExecutiveRole) return;

    const now = new Date();
    
    // Find all sales executives with expired buffer time or already frozen
    const salesExecutives = await User.find({
      roles: salesExecutiveRole._id,
      $or: [
        { documentBufferTime: { $lt: now } },
        { isFrozen: true }
      ]
    });

    for (const user of salesExecutives) {
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
              freezeReason: `Pending ${!kyc ? 'KYC' : ''}${!kyc && !financeLetter ? ' and ' : ''}${!financeLetter && latestBooking.payment.type === 'FINANCE' ? 'Finance Letter' : ''} submission for booking ${latestBooking.bookingNumber}`,
              documentBufferTime: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes buffer time
            });
          }
        } else {
          // Unfreeze if documents are now complete
          if (user.isFrozen) {
            await User.findByIdAndUpdate(user._id, {
              isFrozen: false,
              freezeReason: '',
              documentBufferTime: new Date(Date.now() + 2 * 60 * 1000) // Reset buffer time (2 minutes)
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in document submission check:', err);
  }
};

// Run every 30 seconds for testing (adjust as needed)
cron.schedule('*/30 * * * * *', runDocumentCheck);

module.exports = { runDocumentCheck };