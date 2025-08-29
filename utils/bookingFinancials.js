// utils/bookingFinancials.js
const mongoose = require('mongoose');
const Ledger = require('../models/Ledger');
const BrokerLedger = require('../models/BrokerLedger');

async function computeBookingFinancials(bookingDoc) {
  const bookingId = bookingDoc._id;
  const branchId = bookingDoc.branch;

  const dealAmount = bookingDoc.discountedAmount ?? bookingDoc.dealAmount ?? bookingDoc.netAmount ?? 0;

  // 1) Native Ledger entries (Pending/Approved)
  const ledgerRows = await Ledger.find({
    booking: bookingId,
    approvalStatus: { $in: ['Pending', 'Approved'] }
  }).select('amount paymentMode approvalStatus').lean();

  let customerPayments = 0;
  let financeDisbursements = 0;
  for (const row of ledgerRows) {
    if (row.paymentMode === 'Finance Disbursement') financeDisbursements += row.amount || 0;
    else customerPayments += row.amount || 0;
  }

  // 2) BrokerLedger -> On-Account allocations
  const brokerAllocLedgers = await BrokerLedger.find({
    branch: branchId,
    transactions: {
      $elemMatch: {
        type: 'CREDIT',
        allocations: { $elemMatch: { booking: bookingId } }
      }
    }
  }).select('transactions').lean();

  let onAccountAllocations = 0;
  for (const bl of brokerAllocLedgers) {
    for (const tx of (bl.transactions || [])) {
      if (tx.type !== 'CREDIT' || !Array.isArray(tx.allocations)) continue;
      for (const alloc of tx.allocations) {
        if (String(alloc.booking) === String(bookingId)) {
          onAccountAllocations += alloc.amount || 0;
        }
      }
    }
  }

  // 3) BrokerLedger -> Exchange DEBITs
  const brokerExchLedgers = await BrokerLedger.find({
    branch: branchId,
    transactions: {
      $elemMatch: {
        type: 'DEBIT',
        modeOfPayment: 'Exchange',
        booking: bookingId
      }
    }
  }).select('transactions').lean();

  let exchangeValue = 0;
  for (const bl of brokerExchLedgers) {
    for (const tx of (bl.transactions || [])) {
      if (
        tx.type === 'DEBIT' &&
        tx.modeOfPayment === 'Exchange' &&
        String(tx.booking) === String(bookingId)
      ) {
        exchangeValue += tx.amount || 0;
      }
    }
  }

  // 4) BrokerLedger -> Commission DEBITs
  const brokerCommLedgers = await BrokerLedger.find({
    branch: branchId,
    transactions: {
      $elemMatch: {
        type: 'DEBIT',
        modeOfPayment: 'Commission',
        booking: bookingId
      }
    }
  }).select('transactions').lean();

  let commissionValue = 0;
  for (const bl of brokerCommLedgers) {
    for (const tx of (bl.transactions || [])) {
      if (
        tx.type === 'DEBIT' &&
        tx.modeOfPayment === 'Commission' &&
        String(tx.booking) === String(bookingId)
      ) {
        commissionValue += tx.amount || 0;
      }
    }
  }

  const totalCredit = customerPayments + financeDisbursements + onAccountAllocations + exchangeValue + commissionValue;
  const finalBalance = (dealAmount || 0) - totalCredit;

  return {
    dealAmount,
    credits: {
      customerPayments,
      onAccountAllocations,
      exchangeValue,
      commissionValue,
      financeDisbursements,
    },
    totalCredit,
    finalBalance,
  };
}

module.exports = { computeBookingFinancials };