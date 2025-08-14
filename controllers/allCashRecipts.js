const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const CashVoucher = require("../models/CashVoucher");
const ContraVoucher = require("../models/ContraVoucherModel");
const Branch = require("../models/Branch");
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const moment = require("moment");
const { toWords } = require("number-to-words");
const { generatePDFFromHtml } = require("../utils/pdfGenerator1");

// Helper for Handlebars date formatting
Handlebars.registerHelper("formatDate", (date) => {
  return date ? moment(date).format("DD/MM/YYYY") : "N/A";
});

// Get all vouchers (with branch populated)
exports.getAllVouchers = async (req, res) => {
  try {
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find().populate("branch").lean(),
      CashVoucher.find().populate("branch").lean(),
      ContraVoucher.find().populate("branch").lean(),
    ]);

    const allVouchers = [
      ...workshopReceipts.map((v) => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map((v) => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map((v) => ({ ...v, voucherCategory: "ContraVoucher" })),
    ];

    allVouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: allVouchers.length,
      data: allVouchers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    const previousDate = moment(selectedDate).subtract(1, 'day').startOf("day");
    const nextDate = moment(selectedDate).endOf("day");

    // First, check if there are vouchers from the previous day to get the closing balance
    const [previousDayVouchers] = await Promise.all([
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
    ]);

    let branchOpeningBalance = 0;
    if (previousDayVouchers.length > 0) {
      // Get the branch's opening balance (from the first voucher of previous day)
      const prevDayOpeningBalance = previousDayVouchers[0]?.branch?.opening_balance || 0;
      
      // Calculate running balance for previous day
      let prevDayRunningBalance = prevDayOpeningBalance;
      previousDayVouchers.forEach(voucher => {
        const amount = Number(voucher.amount || 0);
        if (voucher.voucherType === "credit") {
          prevDayRunningBalance += amount;
        } else if (voucher.voucherType === "debit") {
          prevDayRunningBalance -= amount;
        }
      });
      
      // Use previous day's closing balance as today's opening balance
      branchOpeningBalance = prevDayRunningBalance;
    } else {
      // If no vouchers from previous day, get the branch's opening balance
      const branch = await Branch.findById(branchId).lean();
      branchOpeningBalance = branch?.opening_balance || 0;
    }

    // Fetch all vouchers for the selected branch & date
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
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
    ]);

    let allVouchers = [
      ...workshopReceipts.map((v) => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map((v) => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map((v) => ({ ...v, voucherCategory: "ContraVoucher" })),
    ];

    // Sort vouchers chronologically
    allVouchers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let runningBalance = branchOpeningBalance;

    const vouchersWithBalance = allVouchers.map((voucher) => {
      const amount = Number(voucher.amount || 0);

      // Update running balance
      if (voucher.voucherType === "credit") {
        runningBalance += amount;
      } else if (voucher.voucherType === "debit") {
        runningBalance -= amount;
      }

      return {
        ...voucher,
        openingBalance: branchOpeningBalance,
        runningBalance,
      };
    });

    // Return vouchers sorted latest first
    vouchersWithBalance.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: vouchersWithBalance.length,
      data: vouchersWithBalance,
      dailyOpeningBalance: branchOpeningBalance,
      dailyClosingBalance: runningBalance,
    });
  } catch (error) {
    console.error("Error fetching vouchers by branch and date:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVouchersByBranchAndUptoDate = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!branchId || !date) {
      return res.status(400).json({
        success: false,
        message: "branchId and date are required parameters",
      });
    }

    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // End of day for the selected date
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    // Query to find vouchers for the branch with date <= endDate
    const query = {
      branch: branchId,
      date: { $lte: endDate },
    };

    // Fetch vouchers from all three collections with consistent population
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find(query)
        .populate("branch")
        .sort({ date: -1 })  // Sort by date descending
        .lean(),
      CashVoucher.find(query)
        .populate("branch")
        .sort({ date: -1 })  // Sort by date descending
        .lean(),
      ContraVoucher.find(query)
        .populate("branch")
        .sort({ date: -1 })  // Sort by date descending
        .lean(),
    ]);

    // Combine and add voucherCategory tag
    const allVouchers = [
      ...workshopReceipts.map((v) => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map((v) => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map((v) => ({ ...v, voucherCategory: "ContraVoucher" })),
    ];

    // Sort all vouchers by date descending (newest first)
    allVouchers.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      count: allVouchers.length,
      data: allVouchers,
    });
  } catch (error) {
    console.error("Error fetching vouchers by branch and up to date:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};