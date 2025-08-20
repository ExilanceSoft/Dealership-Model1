const WorkShopReceiptVoucher = require('../models/workshopReciptModel');
const Branch = require('../models/Branch');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Create Workshop Receipt Voucher
 */
exports.createWorkShopReceiptVoucher = async (req, res) => {
  try {
    const {
      voucherType,
      recipientName,
      receiptType,
      amount,
      remark,
      status,
      bankName,
      bankLocation,
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
    if (!receiptType?.trim()) {
      return res.status(400).json({ success: false, message: 'Receipt type is required' });
    }
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
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
      const uploadDir = path.join(__dirname, '../uploads/workshop-bills');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `workshop-bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      billUrl = `/uploads/workshop-bills/${filename}`;

      await fs.promises.writeFile(filePath, req.file.buffer);
    }

    const voucher = new WorkShopReceiptVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      receiptType: receiptType.trim(),
      amount: parseFloat(amount),
      remark: remark?.trim() || '',
      status: status || 'pending',
      bankName: bankName?.trim() || '',
      bankLocation: bankLocation?.trim() || '',
      branch,
      billUrl,
      date: date || new Date()
    });

    const savedVoucher = await voucher.save();
    const populatedVoucher = await savedVoucher.populate('branch');

    res.status(201).json({
      success: true,
      data: populatedVoucher,
      message: 'Workshop receipt voucher created successfully'
    });

  } catch (error) {
    console.error('Error creating workshop receipt voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while creating workshop receipt voucher' });
  }
};

/**
 * Get All Workshop Receipt Vouchers (with filtering & pagination)
 */
exports.getAllWorkShopReceiptVouchers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      voucherType,
      receiptType,
      fromDate,
      toDate,
      branch,
      minAmount,
      maxAmount
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (voucherType) query.voucherType = voucherType;
    if (receiptType) query.receiptType = receiptType;
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

    const vouchers = await WorkShopReceiptVoucher.find(query)
      .populate('branch', 'name address city state')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await WorkShopReceiptVoucher.countDocuments(query);

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
    console.error('Error fetching workshop receipt vouchers:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching workshop receipt vouchers' });
  }
};

/**
 * Get Workshop Receipt Voucher by ID
 */
exports.getWorkShopReceiptVoucherById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }

    const voucher = await WorkShopReceiptVoucher.findById(req.params.id)
      .populate('branch', 'name address city state');

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Workshop receipt voucher not found' });
    }

    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    console.error('Error fetching workshop receipt voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching workshop receipt voucher' });
  }
};

/**
 * Update Workshop Receipt Voucher
 */
/**
 * Update Workshop Receipt Voucher
 * Only allows updating status and billUrl
 */
exports.updateWorkShopReceiptVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Validate and set status
    if (req.body.status) {
      const allowedStatuses = ['pending', 'approved', 'rejected'];
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        });
      }
      updates.status = req.body.status;
    }

    // Handle bill file upload
    if (req.file) {
      const uploadDir = path.join(__dirname, '../uploads/workshop-bills');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `workshop-bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);

      updates.billUrl = `/uploads/workshop-bills/${filename}`;
      await fs.promises.writeFile(filePath, req.file.buffer);
    }

    // No valid fields provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update'
      });
    }

    const updatedVoucher = await WorkShopReceiptVoucher.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('branch');

    if (!updatedVoucher) {
      // Delete uploaded file if voucher not found
      if (req.file) fs.unlinkSync(path.join(__dirname, `..${updates.billUrl}`));
      return res.status(404).json({
        success: false,
        message: 'Workshop receipt voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedVoucher,
      message: 'Workshop receipt voucher updated successfully'
    });

  } catch (error) {
    console.error('Error updating workshop receipt voucher:', error);
    if (req.file && updates.billUrl) {
      fs.unlinkSync(path.join(__dirname, `..${updates.billUrl}`));
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating workshop receipt voucher'
    });
  }
};

/**
 * Delete Workshop Receipt Voucher
 */
exports.deleteWorkShopReceiptVoucher = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }

    const deletedVoucher = await WorkShopReceiptVoucher.findByIdAndDelete(req.params.id);

    if (!deletedVoucher) {
      return res.status(404).json({ success: false, message: 'Workshop receipt voucher not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Workshop receipt voucher deleted successfully',
      data: {
        voucherId: deletedVoucher.voucherId,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error deleting workshop receipt voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while deleting workshop receipt voucher' });
  }
};

/**
 * Get Workshop Receipt Vouchers by Status
 */
exports.getWorkShopReceiptVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
    }

    const vouchers = await WorkShopReceiptVoucher.find({ status })
      .populate('branch', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: vouchers.length, data: vouchers });

  } catch (err) {
    console.error('Error fetching workshop vouchers by status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};



