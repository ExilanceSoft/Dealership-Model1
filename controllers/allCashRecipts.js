const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const CashVoucher = require("../models/CashVoucher");
const ContraVoucher = require("../models/ContraVoucherModel");
const Branch = require("../models/Branch");
const Ledger = require("../models/Ledger");
const BrokerLedger = require("../models/BrokerLedger");
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const moment = require("moment");
const { toWords } = require("number-to-words");
const { generatePDFFromHtml } = require("../utils/pdfGenerator1");
const mongoose = require("mongoose");
// Helper for Handlebars date formatting
Handlebars.registerHelper("formatDate", (date) => {
  return date ? moment(date).format("DD/MM/YYYY") : "N/A";
});

// Get all vouchers (with branch populated)
// Get all vouchers (with branch populated)
exports.getAllVouchers = async (req, res) => {
  try {
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find().populate("branch").lean().catch(err => []),
      CashVoucher.find().populate("branch").lean().catch(err => []),
      ContraVoucher.find().populate("branch").lean().catch(err => []),
    ]);

    // Ensure we always have arrays
    const safeWorkshopReceipts = Array.isArray(workshopReceipts) ? workshopReceipts : [];
    const safeCashVouchers = Array.isArray(cashVouchers) ? cashVouchers : [];
    const safeContraVouchers = Array.isArray(contraVouchers) ? contraVouchers : [];

    // Merge and normalize transactions with proper null checks
    let allVouchers = [
      ...safeWorkshopReceipts.map(v => ({
        date: v?.date || v?.createdAt || new Date(),
        receiptNo: v?.voucherId || v?._id?.toString()?.slice(-6) || "N/A",
        accountHead: v?.recipientName || v?.expenseType || "Workshop Receipt",
        particulars: "Workshop Receipt",
        type: "voucher",
        amount: Number(v?.amount) || 0,
        transactionType: v?.voucherType || "credit",
      })),
      ...safeCashVouchers.map(v => ({
        date: v?.date || v?.createdAt || new Date(),
        receiptNo: v?.voucherId || v?._id?.toString()?.slice(-6) || "N/A",
        accountHead: v?.recipientName || v?.expenseType || "Cash Voucher",
        particulars: "Cash Voucher",
        type: "voucher",
        amount: Number(v?.amount) || 0,
        transactionType: v?.voucherType || "credit",
      })),
      ...safeContraVouchers.map(v => ({
        date: v?.date || v?.createdAt || new Date(),
        receiptNo: v?.voucherId || v?._id?.toString()?.slice(-6) || "N/A",
        accountHead: v?.recipientName || "Contra Voucher",
        particulars: "Contra Voucher",
        type: "voucher",
        amount: Number(v?.amount) || 0,
        transactionType: v?.voucherType || "credit",
      }))
    ];

    // Filter out any null/undefined entries and ensure valid objects
    allVouchers = allVouchers.filter(v => v && typeof v === 'object');

    // Sort by time ascending
    allVouchers.sort((a, b) => new Date(a.date || new Date()) - new Date(b.date || new Date()));

    // Running balance logic (Cashbook style: Debit increases, Credit decreases)
    let openingBalance = 1000;
    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactionsWithBalance = allVouchers.map(v => {
      const amt = Number(v.amount) || 0;
      const debit = v.transactionType === "debit" ? amt : 0;
      const credit = v.transactionType === "credit" ? amt : 0;

      totalDebit += debit;
      totalCredit += credit;
      runningBalance += debit - credit;

      return {
        date: moment(v.date || new Date()).format("DD-MM-YYYY HH:mm"),
        receiptNo: v.receiptNo || "N/A",
        accountHead: v.accountHead || "Unknown",
        particulars: v.particulars || "Unknown",
        type: v.type || "voucher",
        debit: debit,
        credit: credit,
        balance: runningBalance
      };
    });

    // Ensure we always return arrays, not undefined
    const responseData = {
      success: true,
      count: transactionsWithBalance.length,
      openingBalance: openingBalance,
      transactions: Array.isArray(transactionsWithBalance) ? transactionsWithBalance : [],
      totals: {
        totalDebit: totalDebit || 0,
        totalCredit: totalCredit || 0,
        closingBalance: runningBalance || openingBalance
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Error fetching vouchers:", error);
    
    // Return a safe response structure even on error
    res.status(500).json({
      success: false,
      message: error.message,
      count: 0,
      openingBalance: 0,
      transactions: [],
      totals: {
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0
      }
    });
  }
};


// Get voucher by ID (with branch populated)
exports.getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;

    let voucher =
      (await WorkShopReciptVoucher.findById(id).populate("branch").lean()) ||
      (await CashVoucher.findById(id).populate("branch").lean()) ||
      (await ContraVoucher.findById(id).populate("branch").lean());

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vouchers by status (with branch populated)
exports.getVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find({ status }).populate("branch").lean(),
      CashVoucher.find({ status }).populate("branch").lean(),
      ContraVoucher.find({ status }).populate("branch").lean(),
    ]);

    const allVouchers = [
      ...workshopReceipts.map((v) => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map((v) => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map((v) => ({ ...v, voucherCategory: "ContraVoucher" })),
    ];

    res.status(200).json({
      success: true,
      count: allVouchers.length,
      data: allVouchers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Download voucher receipt PDF (with branch populated)
exports.downloadVoucherReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    let voucher =
      (await WorkShopReciptVoucher.findById(id).populate("branch").lean()) ||
      (await CashVoucher.findById(id).populate("branch").lean()) ||
      (await ContraVoucher.findById(id).populate("branch").lean());

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const voucherAmount = typeof voucher.amount === "number" ? voucher.amount : 0;
    const templatePath = path.join(__dirname, "../templates/voucherRecipt.html");
    const templateHtml = fs.readFileSync(templatePath, "utf8");
    const compiledTemplate = Handlebars.compile(templateHtml);

    const htmlData = compiledTemplate({
      ...voucher,
      amountInWords: `${toWords(voucherAmount)} only`,
    });

    const pdfBuffer = await generatePDFFromHtml(htmlData);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Receipt-${voucher.voucherId || id}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating voucher PDF:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};
//CashBook-Devu  Get vouchers by branch and date (including Ledger and BrokerLedger)
exports.getVouchersByBranchAndDate = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!branchId || !date) {
      return res.status(400).json({
        success: false,
        message: "Branch ID and date are required",
      });
    }

    const selectedDate = moment(date, "YYYY-MM-DD").startOf("day");
    const previousDate = moment(selectedDate).subtract(1, "day").startOf("day");
    const nextDate = moment(selectedDate).endOf("day");

    // === Get previous day balances ===
    const [previousDayVouchers, previousLedgerTxns, previousBrokerTxns] = await Promise.all([
      Promise.all([
        WorkShopReciptVoucher.find({
          branch: branchId,
          createdAt: { $gte: previousDate.toDate(), $lte: selectedDate.toDate() },
        }).lean(),
        CashVoucher.find({
          branch: branchId,
          createdAt: { $gte: previousDate.toDate(), $lte: selectedDate.toDate() },
        }).lean(),
        ContraVoucher.find({
          branch: branchId,
          createdAt: { $gte: previousDate.toDate(), $lte: selectedDate.toDate() },
        }).lean(),
      ]).then(([wr, cv, cont]) => [...wr, ...cv, ...cont]),

      Ledger.find({
        receiptDate: { $gte: previousDate.toDate(), $lte: selectedDate.toDate() },
      })
        .populate("cashLocationDetails")
        .lean(),

      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.date": { $gte: previousDate.toDate(), $lte: selectedDate.toDate() },
          },
        },
        {
          $lookup: {
            from: "cashlocations",
            localField: "transactions.cashLocation",
            foreignField: "_id",
            as: "cashLocationDetails",
          },
        },
      ]),
    ]);

    let branchOpeningBalance = 0;

    previousDayVouchers.forEach((v) => {
      const amount = Number(v.amount || 0);
      if (v.voucherType === "credit") branchOpeningBalance += amount;
      else if (v.voucherType === "debit") branchOpeningBalance -= amount;
    });

    previousLedgerTxns.forEach((tx) => {
      if (tx.cashLocationDetails?.branchDetails?._id.toString() === branchId) {
        branchOpeningBalance -= tx.amount;
      }
    });

    previousBrokerTxns.forEach((tx) => {
      if (
        tx.cashLocationDetails?.length > 0 &&
        tx.cashLocationDetails[0].branchDetails?._id.toString() === branchId
      ) {
        if (tx.transactions.type === "CREDIT") branchOpeningBalance += tx.transactions.amount;
        else branchOpeningBalance -= tx.transactions.amount;
      }
    });

    if (
      previousDayVouchers.length === 0 &&
      previousLedgerTxns.length === 0 &&
      previousBrokerTxns.length === 0
    ) {
      const branch = await Branch.findById(branchId).lean();
      branchOpeningBalance = branch?.opening_balance || 0;
    }

    // === Fetch today’s transactions ===
    const [workshopReceipts, cashVouchers, contraVouchers, ledgerTxns, brokerTxns] = await Promise.all([
      WorkShopReciptVoucher.find({
        branch: branchId,
        createdAt: { $gte: selectedDate.toDate(), $lte: nextDate.toDate() },
      })
        .populate("branch")
        .lean(),

      CashVoucher.find({
        branch: branchId,
        createdAt: { $gte: selectedDate.toDate(), $lte: nextDate.toDate() },
      })
        .populate("branch")
        .lean(),

      ContraVoucher.find({
        branch: branchId,
        createdAt: { $gte: selectedDate.toDate(), $lte: nextDate.toDate() },
      })
        .populate("branch")
        .lean(),

      Ledger.find({
        receiptDate: { $gte: selectedDate.toDate(), $lte: nextDate.toDate() },
      })
        .populate("cashLocationDetails")
        .populate("bookingDetails")
        .lean(),

      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.date": { $gte: selectedDate.toDate(), $lte: nextDate.toDate() },
          },
        },
        {
          $lookup: { from: "brokers", localField: "broker", foreignField: "_id", as: "brokerDetails" },
        },
        {
          $lookup: { from: "cashlocations", localField: "transactions.cashLocation", foreignField: "_id", as: "cashLocationDetails" },
        },
        {
          $lookup: { from: "bookings", localField: "transactions.booking", foreignField: "_id", as: "bookingDetails" },
        },
      ]),
    ]);

    // === Merge transactions ===
    let allTransactions = [
      ...workshopReceipts.map((v) => ({
        ...v,
        type: "voucher",
        category: "WorkshopReceipt",
        transactionDate: v.date || v.createdAt,
        transactionType: v.voucherType,
      })),
      ...cashVouchers.map((v) => ({
        ...v,
        type: "voucher",
        category: "CashVoucher",
        transactionDate: v.date || v.createdAt,
        transactionType: v.voucherType,
      })),
      ...contraVouchers.map((v) => ({
        ...v,
        type: "voucher",
        category: "ContraVoucher",
        transactionDate: v.date || v.createdAt,
        transactionType: v.voucherType,
      })),
    ];

    ledgerTxns.forEach((tx) => {
      if (tx.cashLocationDetails?.branchDetails?._id.toString() === branchId) {
        allTransactions.push({
          _id: tx._id,
          type: "ledger",
          category: "Booking Payment",
          transactionDate: tx.receiptDate,
          amount: tx.amount,
          transactionType: "debit",
          receiptNo: tx.bookingDetails?.bookingNumber || "N/A",
          accountHead: tx.bookingDetails?.customerName || "Unknown Customer",
          description: `Booking Payment`,
          paymentMode: tx.paymentMode,
          cashLocation: tx.cashLocationDetails?.name,
          createdAt: tx.createdAt,
        });
      }
    });

    brokerTxns.forEach((tx) => {
      if (
        tx.cashLocationDetails?.length > 0 &&
        tx.cashLocationDetails[0].branchDetails?._id.toString() === branchId
      ) {
        const brokerName = tx.brokerDetails?.[0]?.name || "Unknown Broker";
        allTransactions.push({
          _id: tx._id,
          type: "broker",
          category: "Broker Transaction",
          transactionDate: tx.transactions.date,
          amount: tx.transactions.amount,
          transactionType: tx.transactions.type.toLowerCase(),
          receiptNo: `BRK-${tx._id.toString().slice(-6)}`,
          accountHead: brokerName,
          description: "Broker Transaction",
          paymentMode: tx.transactions.modeOfPayment,
          cashLocation: tx.cashLocationDetails[0]?.name,
          createdAt: tx.transactions.createdAt || tx.transactions.date,
        });
      }
    });

    // === Sort ===
    allTransactions.sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));

    // === Format with Debit/Credit, running balance, totals ===
    let runningBalance = branchOpeningBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactionsWithBalance = allTransactions.map((tx) => {
      const amt = Number(tx.amount || 0);
      const debit = tx.transactionType === "debit" ? amt : 0;
      const credit = tx.transactionType === "credit" ? amt : 0;

      totalDebit += debit;
      totalCredit += credit;
      runningBalance += credit - debit;

      let receiptNo = tx.receiptNo || tx.voucherId || "N/A";
      let accountHead = tx.accountHead || tx.recipientName || tx.expenseType || "";

      return {
        date: moment(tx.transactionDate).format("DD-MM-YYYY HH:mm"),
        receiptNo,
        accountHead,
        particulars: tx.category,
        type: tx.type,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    res.status(200).json({
      success: true,
      count: transactionsWithBalance.length,
      openingBalance: branchOpeningBalance,
      transactions: transactionsWithBalance,
      totals: {
        totalDebit,
        totalCredit,
        closingBalance: runningBalance,
      },
    });
  } catch (error) {
    console.error("Error fetching vouchers by branch and date:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// DayBook-Devu
exports.getVouchersByBranchAndUptoDate = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!branchId || !date) {
      return res.status(400).json({
        success: false,
        message: "Branch ID and date are required",
      });
    }

    const selectedDate = moment(date, "YYYY-MM-DD").endOf("day");

    // === Fetch vouchers and ledger transactions up to the selected date ===
    const [workshopReceipts, cashVouchers, contraVouchers, ledgerTxns, brokerTxns] = await Promise.all([
      WorkShopReciptVoucher.find({
        branch: branchId,
        date: { $lte: selectedDate.toDate() },
      })
        .populate("branch")
        .lean(),

      CashVoucher.find({
        branch: branchId,
        date: { $lte: selectedDate.toDate() },
      })
        .populate("branch")
        .lean(),

      ContraVoucher.find({
        branch: branchId,
        date: { $lte: selectedDate.toDate() },
      })
        .populate("branch")
        .lean(),

      Ledger.find({
        receiptDate: { $lte: selectedDate.toDate() },
      })
        .populate("cashLocationDetails")
        .populate("bookingDetails")
        .lean(),

      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        { $match: { "transactions.date": { $lte: selectedDate.toDate() } } },
        { $lookup: { from: "brokers", localField: "broker", foreignField: "_id", as: "brokerDetails" } },
        { $lookup: { from: "cashlocations", localField: "transactions.cashLocation", foreignField: "_id", as: "cashLocationDetails" } },
      ]),
    ]);

    // === Combine all vouchers ===
    let allTransactions = [
      ...workshopReceipts.map((v) => ({
        ...v,
        type: "voucher",
        category: "WorkshopReceipt",
        transactionDate: v.date,
        transactionType: "debit",
        accountHead: v.recipientName || v.customerName || "N/A",
      })),
      ...cashVouchers.map((v) => ({
        ...v,
        type: "voucher",
        category: "CashVoucher",
        transactionDate: v.date,
        transactionType: v.voucherType,
        accountHead: v.recipientName || v.customerName || "N/A",
      })),
      ...contraVouchers.map((v) => ({
        ...v,
        type: "voucher",
        category: "ContraVoucher",
        transactionDate: v.date,
        transactionType: v.voucherType,
        accountHead: v.recipientName || v.customerName || "N/A",
      })),
    ];

    // === Ledger transactions ===
    ledgerTxns.forEach((tx) => {
      if (tx.cashLocationDetails?.branchDetails?._id.toString() === branchId) {
        allTransactions.push({
          _id: tx._id,
          type: "ledger",
          category: "Ledger",
          transactionDate: tx.receiptDate,
          amount: tx.amount,
          transactionType: "debit",
          accountHead: tx.bookingDetails?.customerName || "Unknown Customer",
          description: `Booking Payment - ${tx.bookingDetails?.bookingNumber || "N/A"}`,
          paymentMode: tx.paymentMode,
          cashLocation: tx.cashLocationDetails?.name,
          createdAt: tx.createdAt,
        });
      }
    });

    // === Broker transactions ===
    brokerTxns.forEach((tx) => {
      if (tx.cashLocationDetails?.length > 0 &&
          tx.cashLocationDetails[0].branchDetails?._id.toString() === branchId) {

        const brokerName = tx.brokerDetails?.[0]?.name || "Unknown Broker";

        allTransactions.push({
          _id: tx._id,
          type: "broker",
          category: "BrokerLedger",
          transactionDate: tx.transactions.date,
          amount: tx.transactions.amount,
          transactionType: tx.transactions.type.toLowerCase(),
          accountHead: brokerName,
          description: `Broker Transaction - ${brokerName}`,
          paymentMode: tx.transactions.modeOfPayment,
          cashLocation: tx.cashLocationDetails[0]?.name,
          createdAt: tx.transactions.createdAt || tx.transactions.date,
        });
      }
    });

    // === Sort transactions by date descending ===
    allTransactions.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

    // === Calculate totals ===
    let totalDebit = 0;
    let totalCredit = 0;

    const formattedTransactions = allTransactions.map((tx) => {
      const amt = Number(tx.amount || 0);
      const debit = tx.transactionType === "debit" ? amt : 0;
      const credit = tx.transactionType === "credit" ? amt : 0;

      totalDebit += debit;
      totalCredit += credit;

      return {
        date: moment(tx.transactionDate).format("DD-MM-YYYY HH:mm"),
        receiptNo: tx._id || "N/A",
        accountHead: tx.accountHead || "N/A",
        particulars: tx.category,
        type: tx.type,
        debit,
        credit,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedTransactions.length,
      transactions: formattedTransactions,
      totals: {
        totalDebit,
        totalCredit,
      },
    });
  } catch (error) {
    console.error("Error fetching vouchers by branch up to date:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Cash Book Report (including Ledger and BrokerLedger)
exports.getCashBookReport = async (req, res) => {
  try {
    const { branchId, fromDate, toDate } = req.params;
    
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required",
      });
    }

    const startDate = fromDate ? moment(fromDate).startOf('day') : moment().startOf('month');
    const endDate = toDate ? moment(toDate).endOf('day') : moment().endOf('day');

    // Get opening balance from previous day
    const previousDayEnd = moment(startDate).subtract(1, 'day').endOf('day');
    
    // Get all transactions before the start date to calculate opening balance
    const [previousVouchers, previousLedgerTransactions, previousBrokerTransactions] = await Promise.all([
      // Vouchers from previous days
      Promise.all([
        WorkShopReciptVoucher.find({
          branch: branchId,
          date: { $lte: previousDayEnd.toDate() }
        }).lean(),
        CashVoucher.find({
          branch: branchId,
          date: { $lte: previousDayEnd.toDate() }
        }).lean(),
        ContraVoucher.find({
          branch: branchId,
          date: { $lte: previousDayEnd.toDate() }
        }).lean()
      ]).then(([wr, cv, cont]) => [...wr, ...cv, ...cont]),
      
      // Ledger transactions (cash payments)
      Ledger.find({
        cashLocation: { $exists: true },
        receiptDate: { $lte: previousDayEnd.toDate() }
      }).populate('cashLocationDetails').lean(),
      
      // Broker ledger transactions (cash payments)
      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.modeOfPayment": "Cash",
            "transactions.date": { $lte: previousDayEnd.toDate() }
          }
        },
        {
          $lookup: {
            from: "brokers",
            localField: "broker",
            foreignField: "_id",
            as: "brokerDetails"
          }
        },
        {
          $lookup: {
            from: "cashlocations",
            localField: "transactions.cashLocation",
            foreignField: "_id",
            as: "cashLocationDetails"
          }
        }
      ])
    ]);

    // Calculate opening balance
    let openingBalance = 0;
    
    // Process previous vouchers
    previousVouchers.forEach(voucher => {
      const amount = Number(voucher.amount || 0);
      if (voucher.voucherType === "credit") {
        openingBalance += amount;
      } else if (voucher.voucherType === "debit") {
        openingBalance -= amount;
      }
    });
    
    // Process ledger transactions
    previousLedgerTransactions.forEach(transaction => {
      if (transaction.cashLocationDetails && 
          transaction.cashLocationDetails.branchDetails && 
          transaction.cashLocationDetails.branchDetails._id.toString() === branchId) {
        openingBalance -= transaction.amount; // Cash payments reduce cash balance
      }
    });
    
    // Process broker transactions
    previousBrokerTransactions.forEach(transaction => {
      if (transaction.cashLocationDetails && 
          transaction.cashLocationDetails.length > 0 &&
          transaction.cashLocationDetails[0].branchDetails && 
          transaction.cashLocationDetails[0].branchDetails._id.toString() === branchId) {
        if (transaction.transactions.type === "CREDIT") {
          openingBalance += transaction.transactions.amount;
        } else {
          openingBalance -= transaction.transactions.amount;
        }
      }
    });

    // If no previous transactions, get the branch's opening balance
    if (previousVouchers.length === 0 && previousLedgerTransactions.length === 0 && previousBrokerTransactions.length === 0) {
      const branch = await Branch.findById(branchId).lean();
      openingBalance = branch?.opening_balance || 0;
    }

    // Get all transactions for the date range
    const [vouchers, ledgerTxns, brokerTxns] = await Promise.all([
      // Vouchers
      Promise.all([
        WorkShopReciptVoucher.find({
          branch: branchId,
          date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }).populate('branch').lean(),
        CashVoucher.find({
          branch: branchId,
          date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }).populate('branch').lean(),
        ContraVoucher.find({
          branch: branchId,
          date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }).populate('branch').lean()
      ]).then(([wr, cv, cont]) => [
        ...wr.map(v => ({ ...v, type: 'voucher', category: 'WorkshopReceipt' })),
        ...cv.map(v => ({ ...v, type: 'voucher', category: 'CashVoucher' })),
        ...cont.map(v => ({ ...v, type: 'voucher', category: 'ContraVoucher' }))
      ]),
      
      // Ledger transactions
      Ledger.find({
        cashLocation: { $exists: true },
        receiptDate: { $gte: startDate.toDate(), $lte: endDate.toDate() }
      }).populate('cashLocationDetails').populate('bookingDetails').lean(),
      
      // Broker ledger transactions
      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.modeOfPayment": "Cash",
            "transactions.date": { $gte: startDate.toDate(), $lte: endDate.toDate() }
          }
        },
        {
          $lookup: {
            from: "brokers",
            localField: "broker",
            foreignField: "_id",
            as: "brokerDetails"
          }
        },
        {
          $lookup: {
            from: "cashlocations",
            localField: "transactions.cashLocation",
            foreignField: "_id",
            as: "cashLocationDetails"
          }
        },
        {
          $lookup: {
            from: "bookings",
            localField: "transactions.booking",
            foreignField: "_id",
            as: "bookingDetails"
          }
        }
      ])
    ]);

    // Format all transactions
    let runningBalance = openingBalance;
    const cashBookEntries = [];

    // Process vouchers
    vouchers.forEach(voucher => {
      const amount = Number(voucher.amount || 0);
      let credit = 0;
      let debit = 0;
      
      if (voucher.voucherType === "credit") {
        credit = amount;
        runningBalance += amount;
      } else {
        debit = amount;
        runningBalance -= amount;
      }
      
      cashBookEntries.push({
        date: voucher.date,
        description: `${voucher.category} - ${voucher.recipientName || 'N/A'}`,
        voucherNo: voucher.voucherId,
        credit,
        debit,
        balance: runningBalance,
        type: 'voucher',
        reference: voucher._id
      });
    });

    // Process ledger transactions (cash payments from bookings)
    ledgerTxns.forEach(transaction => {
      if (transaction.cashLocationDetails && 
          transaction.cashLocationDetails.branchDetails && 
          transaction.cashLocationDetails.branchDetails._id.toString() === branchId) {
        runningBalance -= transaction.amount;
        
        cashBookEntries.push({
          date: transaction.receiptDate,
          description: `Booking Payment - ${transaction.bookingDetails?.bookingNumber || 'N/A'}`,
          voucherNo: `LED-${transaction._id.toString().slice(-6)}`,
          credit: 0,
          debit: transaction.amount,
          balance: runningBalance,
          type: 'ledger',
          reference: transaction._id
        });
      }
    });

    // Process broker transactions
    brokerTxns.forEach(transaction => {
      if (transaction.cashLocationDetails && 
          transaction.cashLocationDetails.length > 0 &&
          transaction.cashLocationDetails[0].branchDetails && 
          transaction.cashLocationDetails[0].branchDetails._id.toString() === branchId) {
        
        const amount = Number(transaction.transactions.amount || 0);
        let credit = 0;
        let debit = 0;
        
        if (transaction.transactions.type === "CREDIT") {
          credit = amount;
          runningBalance += amount;
        } else {
          debit = amount;
          runningBalance -= amount;
        }
        
        const brokerName = transaction.brokerDetails && transaction.brokerDetails.length > 0 
          ? transaction.brokerDetails[0].name 
          : 'Unknown Broker';
        
        cashBookEntries.push({
          date: transaction.transactions.date,
          description: `Broker Transaction - ${brokerName}`,
          voucherNo: `BROK-${transaction.transactions._id ? transaction.transactions._id.toString().slice(-6) : 'N/A'}`,
          credit,
          debit,
          balance: runningBalance,
          type: 'broker',
          reference: transaction._id
        });
      }
    });

    // Sort all entries by date
    cashBookEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: {
        branch: branchId,
        fromDate: startDate.toDate(),
        toDate: endDate.toDate(),
        openingBalance,
        closingBalance: runningBalance,
        transactions: cashBookEntries,
        summary: {
          totalCredit: cashBookEntries.reduce((sum, entry) => sum + entry.credit, 0),
          totalDebit: cashBookEntries.reduce((sum, entry) => sum + entry.debit, 0),
          netChange: runningBalance - openingBalance
        }
      }
    });

  } catch (error) {
    console.error("Error generating cash book report:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Day Book Report
exports.getDayBookReport = async (req, res) => {
  try {
    const { branchId, date } = req.params;
    
    if (!branchId || !date) {
      return res.status(400).json({
        success: false,
        message: "Branch ID and date are required",
      });
    }

    const selectedDate = moment(date, "YYYY-MM-DD");
    const startOfDay = selectedDate.startOf('day').toDate();
    const endOfDay = selectedDate.endOf('day').toDate();

    // Get all transactions for the day
    const [vouchers, ledgerTransactions, brokerTransactions] = await Promise.all([
      // Vouchers
      Promise.all([
        WorkShopReciptVoucher.find({
          branch: branchId,
          date: { $gte: startOfDay, $lte: endOfDay }
        }).populate('branch').lean(),
        CashVoucher.find({
          branch: branchId,
          date: { $gte: startOfDay, $lte: endOfDay }
        }).populate('branch').lean(),
        ContraVoucher.find({
          branch: branchId,
          date: { $gte: startOfDay, $lte: endOfDay }
        }).populate('branch').lean()
      ]).then(([wr, cv, cont]) => [
        ...wr.map(v => ({ ...v, type: 'voucher', category: 'WorkshopReceipt', source: 'voucher' })),
        ...cv.map(v => ({ ...v, type: 'voucher', category: 'CashVoucher', source: 'voucher' })),
        ...cont.map(v => ({ ...v, type: 'voucher', category: 'ContraVoucher', source: 'voucher' }))
      ]),
      
      // All ledger transactions (not just cash) - filter by branch
      Ledger.find({
        receiptDate: { $gte: startOfDay, $lte: endOfDay }
      })
      .populate('cashLocationDetails')
      .populate('bankDetails')
      .populate('bookingDetails')
      .populate('receivedByDetails')
      .lean(),
      
      // All broker transactions - filter by branch
      BrokerLedger.aggregate([
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.date": { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $lookup: {
            from: "brokers",
            localField: "broker",
            foreignField: "_id",
            as: "brokerDetails"
          }
        },
        {
          $lookup: {
            from: "cashlocations",
            localField: "transactions.cashLocation",
            foreignField: "_id",
            as: "cashLocationDetails"
          }
        },
        {
          $lookup: {
            from: "banks",
            localField: "transactions.bank",
            foreignField: "_id",
            as: "bankDetails"
          }
        },
        {
          $lookup: {
            from: "bookings",
            localField: "transactions.booking",
            foreignField: "_id",
            as: "bookingDetails"
          }
        }
      ])
    ]);

    // Format day book entries
    const dayBookEntries = [];

    // Process vouchers
    vouchers.forEach(voucher => {
      const amount = Number(voucher.amount || 0);
      
      dayBookEntries.push({
        date: voucher.date,
        type: 'voucher',
        category: voucher.category,
        description: `${voucher.recipientName || 'N/A'} - ${voucher.remark || 'No remarks'}`,
        voucherNo: voucher.voucherId,
        amount,
        transactionType: voucher.voucherType,
        paymentMode: voucher.paymentMode || 'cash',
        reference: voucher._id,
        source: 'voucher'
      });
    });

    // Process ledger transactions - filter by branch
    ledgerTransactions.forEach(transaction => {
      // Check if this transaction belongs to the requested branch
      const isBranchTransaction = 
        (transaction.cashLocationDetails && 
         transaction.cashLocationDetails.branchDetails && 
         transaction.cashLocationDetails.branchDetails._id.toString() === branchId) ||
        (transaction.bankDetails && 
         transaction.bankDetails.branchDetails && 
         transaction.bankDetails.branchDetails._id.toString() === branchId);
      
      if (isBranchTransaction) {
        dayBookEntries.push({
          date: transaction.receiptDate,
          type: 'ledger',
          category: 'Booking Payment',
          description: `Payment for Booking ${transaction.bookingDetails?.bookingNumber || 'N/A'}`,
          voucherNo: `LED-${transaction._id.toString().slice(-6)}`,
          amount: transaction.amount,
          transactionType: transaction.isDebit ? 'debit' : 'credit',
          paymentMode: transaction.paymentMode,
          reference: transaction._id,
          source: 'ledger',
          details: {
            receivedBy: transaction.receivedByDetails?.name,
            bank: transaction.bankDetails?.name,
            cashLocation: transaction.cashLocationDetails?.name,
            isDebit: transaction.isDebit,
            debitReason: transaction.debitReason
          }
        });
      }
    });

    // Process broker transactions - filter by branch
    brokerTransactions.forEach(transaction => {
      // Check if this transaction belongs to the requested branch
      const cashLocationBranch = transaction.cashLocationDetails && 
                               transaction.cashLocationDetails.length > 0 &&
                               transaction.cashLocationDetails[0].branchDetails &&
                               transaction.cashLocationDetails[0].branchDetails._id.toString();
      
      const bankBranch = transaction.bankDetails && 
                        transaction.bankDetails.length > 0 &&
                        transaction.bankDetails[0].branchDetails &&
                        transaction.bankDetails[0].branchDetails._id.toString();
      
      const isBranchTransaction = cashLocationBranch === branchId || bankBranch === branchId;
      
      if (isBranchTransaction) {
        const brokerName = transaction.brokerDetails && transaction.brokerDetails.length > 0 
          ? transaction.brokerDetails[0].name 
          : 'Unknown Broker';
        
        const bankName = transaction.bankDetails && transaction.bankDetails.length > 0 
          ? transaction.bankDetails[0].name 
          : null;
        
        const cashLocation = transaction.cashLocationDetails && transaction.cashLocationDetails.length > 0 
          ? transaction.cashLocationDetails[0].name 
          : null;
        
        dayBookEntries.push({
          date: transaction.transactions.date,
          type: 'broker',
          category: 'Broker Transaction',
          description: `${transaction.transactions.type} - ${brokerName}`,
          voucherNo: `BROK-${transaction.transactions._id ? transaction.transactions._id.toString().slice(-6) : 'N/A'}`,
          amount: transaction.transactions.amount,
          transactionType: transaction.transactions.type.toLowerCase(),
          paymentMode: transaction.transactions.modeOfPayment,
          reference: transaction._id,
          source: 'broker',
          details: {
            bank: bankName,
            cashLocation: cashLocation,
            remark: transaction.transactions.remark,
            booking: transaction.bookingDetails && transaction.bookingDetails.length > 0 
              ? transaction.bookingDetails[0].bookingNumber 
              : null
          }
        });
      }
    });

    // Sort entries by date
    dayBookEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate totals
    const totals = {
      voucherCredit: dayBookEntries
        .filter(e => e.source === 'voucher' && e.transactionType === 'credit')
        .reduce((sum, e) => sum + e.amount, 0),
      voucherDebit: dayBookEntries
        .filter(e => e.source === 'voucher' && e.transactionType === 'debit')
        .reduce((sum, e) => sum + e.amount, 0),
      ledgerCredit: dayBookEntries
        .filter(e => e.source === 'ledger' && e.transactionType === 'credit')
        .reduce((sum, e) => sum + e.amount, 0),
      ledgerDebit: dayBookEntries
        .filter(e => e.source === 'ledger' && e.transactionType === 'debit')
        .reduce((sum, e) => sum + e.amount, 0),
      brokerCredit: dayBookEntries
        .filter(e => e.source === 'broker' && e.transactionType === 'credit')
        .reduce((sum, e) => sum + e.amount, 0),
      brokerDebit: dayBookEntries
        .filter(e => e.source === 'broker' && e.transactionType === 'debit')
        .reduce((sum, e) => sum + e.amount, 0)
    };

    // Calculate net totals
    const totalCredit = totals.voucherCredit + totals.ledgerCredit + totals.brokerCredit;
    const totalDebit = totals.voucherDebit + totals.ledgerDebit + totals.brokerDebit;
    const netCashFlow = totalCredit - totalDebit;

    res.status(200).json({
      success: true,
      data: {
        branch: branchId,
        date: selectedDate.toDate(),
        transactions: dayBookEntries,
        totals,
        summary: {
          totalTransactions: dayBookEntries.length,
          totalCredit,
          totalDebit,
          netCashFlow
        }
      }
    });

  } catch (error) {
    console.error("Error generating day book report:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};