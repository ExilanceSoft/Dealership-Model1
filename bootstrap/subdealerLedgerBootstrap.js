// bootstrap/subdealerLedgerBootstrap.js
const Booking = require('../models/Booking');
const Ledger = require('../models/Ledger');
const logger = require('../config/logger');

/**
 * Automatically creates an opening DEBIT ledger entry for new bookings.
 * - For B2B (SUBDEALER): entity.kind='SUBDEALER'
 * - For B2C: entity.kind='CUSTOMER'
 */
(function attachOpeningDebitHook() {
  if (Booking.schema._openingDebitHookAttached) return;
  Booking.schema._openingDebitHookAttached = true;

  Booking.schema.post('save', async function (doc) {
    try {
      if (!doc.isNew) return;

      // Compute opening amount (prefer discountedAmount, fallback to totalAmount)
      const debitAmount =
        typeof doc.discountedAmount === 'number'
          ? doc.discountedAmount
          : typeof doc.totalAmount === 'number'
          ? doc.totalAmount
          : 0;

      if (debitAmount <= 0) return;

      // Already has a debit?
      const exists = await Ledger.exists({ booking: doc._id, isDebit: true });
      if (exists) return;

      // Decide entity by booking type
      let entity = { kind: 'CUSTOMER', displayName: doc?.customerDetails?.name || 'Customer' };
      const typeVal = (doc.bookingType || '').toString().toUpperCase();
      if (typeVal.includes('SUBDEALER') || typeVal.includes('B2B')) {
        entity = { kind: 'SUBDEALER', refId: doc.subdealer, refModel: 'Subdealer', displayName: 'Subdealer' };
      }

      await Ledger.create({
        booking: doc._id,
        type: 'DEBIT_ENTRY',
        isDebit: true,
        debitReason: 'BOOKING_AMOUNT',
        amount: debitAmount,
        remark: 'Opening debit on booking creation',
        entity,
      });

      // Initialize received & balance on booking, if fields exist
      try {
        const received = doc.receivedAmount || 0;
        const balance = debitAmount - received;
        await Booking.updateOne(
          { _id: doc._id },
          { $set: { balanceAmount: balance } }
        );
      } catch (_) {}
    } catch (err) {
      logger.error(`Opening debit hook failed: ${err.message}`);
    }
  });

  logger.info('Attached opening debit hook to Booking schema (B2B/B2C)');
})();
