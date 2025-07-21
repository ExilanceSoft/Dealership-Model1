// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const Booking = require('../models/Booking');
// const Role = require('../models/Role');

// const DOCUMENT_BUFFER_MINUTES = 2;
// const CHECK_INTERVAL_SECONDS = 30;

// const runDocumentCheck = async () => {
//   try {
//     console.log('\n=== [Document Check] Starting document submission check ===');
    
//     const salesExecutiveRole = await Role.findOne({ name: 'SALES_EXECUTIVE' });
//     if (!salesExecutiveRole) {
//       console.log('[✖] Sales Executive role not found');
//       return;
//     }

//     const now = new Date();
    
//     // Find ALL sales executives
//     const salesExecutives = await User.find({
//       roles: salesExecutiveRole._id
//     }).select('_id email isFrozen freezeReason');

//     console.log(`[ℹ] Checking ${salesExecutives.length} sales executives`);

//     for (const user of salesExecutives) {
//       try {
//         console.log(`\n[→] Processing: ${user.email} (${user.isFrozen ? 'FROZEN' : 'active'})`);
        
//         // Find bookings with status containing "PENDING_APPROVAL" or "APPROVED"
//         const bookings = await Booking.find({
//           $or: [{ createdBy: user._id }, { salesExecutive: user._id }],
//           status: { 
//             $regex: /PENDING_APPROVAL|APPROVED/,
//             $options: 'i' 
//           }
//         })
//         .sort({ createdAt: -1 });

//         if (bookings.length === 0) {
//           console.log('   - No active bookings found');
//           if (user.isFrozen && user.freezeReason?.includes('submission for booking')) {
//             await User.findByIdAndUpdate(user._id, {
//               isFrozen: false,
//               freezeReason: ''
//             });
//             console.log('[✓] Unfroze - no bookings requiring documents');
//           }
//           continue;
//         }

//         for (const booking of bookings) {
//           const minutesOld = (now - booking.createdAt) / (1000 * 60);
//           console.log(`   - Booking #${booking.bookingNumber} (${booking.createdAt})`);
//           console.log(`     - Status: ${booking.status}`);
//           console.log(`     - Age: ${minutesOld.toFixed(1)} minutes`);
          
//           if (minutesOld < DOCUMENT_BUFFER_MINUTES) {
//             console.log(`     - Skipping: Within ${DOCUMENT_BUFFER_MINUTES} minute buffer`);
//             continue;
//           }

//           console.log(`     - KYC: ${booking.kycStatus || 'NOT_SUBMITTED'}`);
//           console.log(`     - Finance: ${booking.financeLetterStatus || 'NOT_SUBMITTED'}`);

//           const needsKYC = booking.kycStatus === 'NOT_SUBMITTED';
//           const needsFinance = booking.payment?.type === 'FINANCE' && 
//                               booking.financeLetterStatus === 'NOT_SUBMITTED';

//           if (needsKYC || needsFinance) {
//             if (!user.isFrozen) {
//               const reason = `Pending ${
//                 needsKYC ? 'KYC' : ''
//               }${
//                 needsKYC && needsFinance ? ' and ' : ''
//               }${
//                 needsFinance ? 'Finance Letter' : ''
//               } submission for booking ${booking.bookingNumber}`;

//               await User.findByIdAndUpdate(user._id, {
//                 isFrozen: true,
//                 freezeReason: reason
//               });
//               console.log(`[✖] Froze - ${reason}`);
//             }
//             break;
//           } else if (user.isFrozen && user.freezeReason?.includes(booking.bookingNumber)) {
//             await User.findByIdAndUpdate(user._id, {
//               isFrozen: false,
//               freezeReason: ''
//             });
//             console.log('[✓] Unfroze - documents now submitted');
//           }
//         }
//       } catch (err) {
//         console.error(`[⚠] Error processing ${user.email}:`, err.message);
//       }
//     }
//     console.log('=== [Document Check] Completed check ===\n');
//   } catch (err) {
//     console.error('[⚠] System error:', err.message);
//   }
// };

// cron.schedule(`*/${CHECK_INTERVAL_SECONDS} * * * * *`, runDocumentCheck);

// module.exports = { runDocumentCheck };

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Role = require('../models/Role');

const DOCUMENT_BUFFER_MINUTES = 1440; // Changed from 2 to 1440 (24 hours)
const CHECK_INTERVAL_SECONDS = 30;    // Still checks every 30 seconds

const runDocumentCheck = async () => {
  try {
    console.log('\n=== [Document Check] Starting document submission check ===');
    
    const salesExecutiveRole = await Role.findOne({ name: 'SALES_EXECUTIVE' });
    if (!salesExecutiveRole) {
      console.log('[✖] Sales Executive role not found');
      return;
    }

    const now = new Date();
    
    // Find ALL sales executives
    const salesExecutives = await User.find({
      roles: salesExecutiveRole._id
    }).select('_id email isFrozen freezeReason');

    console.log(`[ℹ] Checking ${salesExecutives.length} sales executives`);

    for (const user of salesExecutives) {
      try {
        console.log(`\n[→] Processing: ${user.email} (${user.isFrozen ? 'FROZEN' : 'active'})`);
        
        // Find bookings with status containing "PENDING_APPROVAL" or "APPROVED"
        const bookings = await Booking.find({
          $or: [{ createdBy: user._id }, { salesExecutive: user._id }],
          status: { 
            $regex: /PENDING_APPROVAL|APPROVED/,
            $options: 'i' 
          }
        })
        .sort({ createdAt: -1 });

        if (bookings.length === 0) {
          console.log('   - No active bookings found');
          if (user.isFrozen && user.freezeReason?.includes('submission for booking')) {
            await User.findByIdAndUpdate(user._id, {
              isFrozen: false,
              freezeReason: ''
            });
            console.log('[✓] Unfroze - no bookings requiring documents');
          }
          continue;
        }

        for (const booking of bookings) {
          const minutesOld = (now - booking.createdAt) / (1000 * 60);
          const hoursOld = minutesOld / 60; // Convert to hours for better readability
          console.log(`   - Booking #${booking.bookingNumber} (${booking.createdAt})`);
          console.log(`     - Status: ${booking.status}`);
          console.log(`     - Age: ${hoursOld.toFixed(1)} hours`);
          
          if (minutesOld < DOCUMENT_BUFFER_MINUTES) {
            console.log(`     - Skipping: Within ${DOCUMENT_BUFFER_MINUTES/60} hour buffer`);
            continue;
          }

          console.log(`     - KYC: ${booking.kycStatus || 'NOT_SUBMITTED'}`);
          console.log(`     - Finance: ${booking.financeLetterStatus || 'NOT_SUBMITTED'}`);

          const needsKYC = booking.kycStatus === 'NOT_SUBMITTED';
          const needsFinance = booking.payment?.type === 'FINANCE' && 
                              booking.financeLetterStatus === 'NOT_SUBMITTED';

          if (needsKYC || needsFinance) {
            if (!user.isFrozen) {
              const reason = `Pending ${
                needsKYC ? 'KYC' : ''
              }${
                needsKYC && needsFinance ? ' and ' : ''
              }${
                needsFinance ? 'Finance Letter' : ''
              } submission for booking ${booking.bookingNumber}`;

              await User.findByIdAndUpdate(user._id, {
                isFrozen: true,
                freezeReason: reason
              });
              console.log(`[✖] Froze - ${reason}`);
            }
            break;
          } else if (user.isFrozen && user.freezeReason?.includes(booking.bookingNumber)) {
            await User.findByIdAndUpdate(user._id, {
              isFrozen: false,
              freezeReason: ''
            });
            console.log('[✓] Unfroze - documents now submitted');
          }
        }
      } catch (err) {
        console.error(`[⚠] Error processing ${user.email}:`, err.message);
      }
    }
    console.log('=== [Document Check] Completed check ===\n');
  } catch (err) {
    console.error('[⚠] System error:', err.message);
  }
};

cron.schedule(`*/${CHECK_INTERVAL_SECONDS} * * * * *`, runDocumentCheck);

module.exports = { runDocumentCheck };