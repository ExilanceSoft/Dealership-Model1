const CashVoucher = require('../models/CashVoucher');
const Branch = require('../models/Branch');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Create Cash Voucher
 */
exports.createCashVoucher = async (req, res) => {
  try {
    const {
      voucherType,
      recipientName,
      amount,
      cashLocation,
      expenseType,
      remark,
      status,
      branch,
      date
    } = req.body;

    // === Validations ===
    const allowedVoucherTypes = ['credit', 'debit'];
    if (!voucherType || !allowedVoucherTypes.includes(voucherType)) {
      return res.status(400).json({ success: false, message: `voucherType must be one of: ${allowedVoucherTypes.join(', ')}` });
    }
    if (!recipientName?.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required' });
    }
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }
    if (!cashLocation?.trim()) {
      return res.status(400).json({ success: false, message: 'Cash location is required' });
    }
    if (!expenseType?.trim()) {
      return res.status(400).json({ success: false, message: 'Expense type is required' });
    }

    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
    }

    if (!branch || !mongoose.Types.ObjectId.isValid(branch)) {
      return res.status(400).json({ success: false, message: 'Valid branch ObjectId is required' });
    }

    const branchExists = await Branch.findById(branch);
    if (!branchExists) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // === Bill Upload Handling ===
    let billUrl = null;
    if (req.file) {
      const uploadDir = path.join(__dirname, '../uploads/bills');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      billUrl = `/uploads/bills/${filename}`;

      await fs.promises.writeFile(filePath, req.file.buffer);
    }

    const voucher = new CashVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      amount: parseFloat(amount),
      cashLocation: cashLocation.trim(),
      expenseType: expenseType.trim(),
      remark: remark?.trim() || '',
      status: status || 'pending',
      branch,
      billUrl,
      date: date || new Date()
    });

    const savedVoucher = await voucher.save();
    const populatedVoucher = await savedVoucher.populate('branch');

    res.status(201).json({
      success: true,
      data: populatedVoucher,
      message: 'Cash voucher created successfully'
    });

  } catch (error) {
    console.error('Error creating cash voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while creating cash voucher' });
  }
};

/**
 * Get All Cash Vouchers (with filtering and pagination)
 */
exports.getAllCashVouchers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      voucherType,
      fromDate,
      toDate,
      branch,
      minAmount,
      maxAmount
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (voucherType) query.voucherType = voucherType;
    if (branch && mongoose.Types.ObjectId.isValid(branch)) query.branch = branch;

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const vouchers = await CashVoucher.find(query)
      .populate('branch', 'name address city state')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await CashVoucher.countDocuments(query);

    res.json({
      success: true,
      data: vouchers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching cash vouchers:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching cash vouchers' });
  }
};

/**
 * Get Cash Voucher by ID
 */
exports.getCashVoucherById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }

    const voucher = await CashVoucher.findById(req.params.id)
      .populate('branch', 'name address city state');

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Cash voucher not found' });
    }

    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    console.error('Error fetching cash voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching cash voucher' });
  }
};

/**
 * Update Cash Voucher
 */
exports.updateCashVoucher = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // If bill file uploaded
    if (req.file) {
      const uploadDir = path.join(__dirname, '../uploads/bills');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      updateData.billUrl = `/uploads/bills/${filename}`;
      await fs.promises.writeFile(filePath, req.file.buffer);
    }

    // Validate branch if provided
    if (updateData.branch && !mongoose.Types.ObjectId.isValid(updateData.branch)) {
      return res.status(400).json({ success: false, message: "Invalid branch ObjectId" });
    }

    const updatedVoucher = await CashVoucher.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('branch');

    if (!updatedVoucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, data: updatedVoucher });

  } catch (error) {
    console.error("Error updating cash voucher:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Delete Cash Voucher
 */
exports.deleteCashVoucher = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }

    const deletedVoucher = await CashVoucher.findByIdAndDelete(req.params.id);

    if (!deletedVoucher) {
      return res.status(404).json({ success: false, message: 'Cash voucher not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Cash voucher deleted successfully',
      data: {
        voucherId: deletedVoucher.voucherId,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error deleting cash voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while deleting cash voucher' });
  }
};

/**
 * Get Cash Voucher by voucherId
 */
exports.getCashVoucherByVoucherId = async (req, res) => {
  try {
    const voucher = await CashVoucher.findOne({ voucherId: req.params.voucherId })
      .populate('branch', 'name address city state');

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Cash voucher not found' });
    }

    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    console.error('Error fetching cash voucher by voucherId:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching cash voucher' });
  }
};

/**
 * Get Cash Vouchers by Status
 */
exports.getCashVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
    }

    const vouchers = await CashVoucher.find({ status })
      .populate('branch', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: vouchers.length, data: vouchers });

  } catch (err) {
    console.error('Error fetching vouchers by status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
