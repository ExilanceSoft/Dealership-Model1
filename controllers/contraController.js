const ContraVoucher = require('../models/ContraVoucherModel');
const fs = require('fs');
const path = require('path');
const Branch = require('../models/Branch'); // Assuming you have this model
const mongoose = require('mongoose');

// Create Contra Voucher
exports.createContraVoucher = async (req, res) => {
  try {
    const {
      voucherType,
      recipientName,
      contraType,
      amount,
      bankLocation,
      remark,
      status,
      branch
    } = req.body;

    // Validation
    if (!voucherType || !['credit', 'debit'].includes(voucherType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing voucherType (must be credit or debit)' });
    }
    if (!recipientName?.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required' });
    }
    if (!contraType || !['cash_at_bank', 'cash_at_home'].includes(contraType)) {
      return res.status(400).json({ success: false, message: 'Invalid contra type (must be cash_at_bank or cash_at_home)' });
    }
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount (greater than 0) is required' });
    }
    if (contraType === 'cash_at_bank' && !bankLocation?.trim()) {
      return res.status(400).json({ success: false, message: 'Bank location is required for cash_at_bank type' });
    }
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (!branch) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    // Check if branch exists
    const branchExists = await Branch.findById(branch);
    if (!branchExists) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // Create new voucher
    const voucher = new ContraVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      contraType,
      amount: parseFloat(amount),
      bankLocation: contraType === 'cash_at_bank' ? bankLocation.trim() : undefined,
      remark: remark?.trim() || '',
      status: status || 'pending',
      paymentMode: 'cash',
      branch
    });

    const savedVoucher = await voucher.save();
    const populatedVoucher = await savedVoucher.populate('branch');

    res.status(201).json({
      success: true,
      data: populatedVoucher,
      message: 'Contra voucher created successfully'
    });

  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: Object.values(error.errors).map(val => val.message) });
    }
    res.status(500).json({ success: false, error: 'Server error while creating contra voucher' });
  }
};

// Get All Contra Vouchers (with filters & pagination)
exports.getAllContraVouchers = async (req, res) => {
  try {
    const { status, voucherType, contraType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;
    if (voucherType && ['credit', 'debit'].includes(voucherType)) query.voucherType = voucherType;
    if (contraType && ['cash_at_bank', 'cash_at_home'].includes(contraType)) query.contraType = contraType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const vouchers = await ContraVoucher.find(query)
      .populate('branch')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ContraVoucher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vouchers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error while fetching contra vouchers' });
  }
};

// Get Contra Voucher by ID
exports.getContraVoucherById = async (req, res) => {
  try {
    const voucher = await ContraVoucher.findById(req.params.id).populate('branch');
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Contra voucher not found' });
    }
    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }
    res.status(500).json({ success: false, error: 'Server error while fetching contra voucher' });
  }
};

// Get Contra Vouchers by Status
exports.getContraVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (must be pending, approved, or rejected)' });
    }

    const vouchers = await ContraVoucher.find({ status })
      .populate('branch')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: vouchers, count: vouchers.length });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error while fetching contra vouchers by status' });
  }
};

// Update Contra Voucher
exports.updateContraVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const file = req.file;

    // Basic validation
    if (updates.voucherType && !['credit', 'debit'].includes(updates.voucherType)) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: 'Invalid voucherType' });
    }
    if (updates.contraType && !['cash_at_bank', 'cash_at_home'].includes(updates.contraType)) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: 'Invalid contraType (must be cash_at_bank or cash_at_home)' });
    }
    if (updates.contraType === 'cash_at_bank' && !updates.bankLocation?.trim()) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: 'Bank location is required for cash_at_bank type' });
    }

    // Handle file upload
    if (file) {
      const fileUrl = `/uploads/contra-vouchers/${file.filename}`;
      updates.$push = { billUrl: { url: fileUrl } };
    }

    // Trim string fields
    ['recipientName', 'contraType', 'bankLocation', 'remark'].forEach(field => {
      if (updates[field]) updates[field] = updates[field].trim();
    });

    // Convert amount to number
    if (updates.amount) {
      updates.amount = parseFloat(updates.amount);
      if (isNaN(updates.amount)) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({ success: false, message: 'Amount must be a number' });
      }
    }

    const updatedVoucher = await ContraVoucher.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('branch');

    if (!updatedVoucher) {
      if (file) fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, message: 'Contra voucher not found' });
    }

    res.status(200).json({
      success: true,
      data: updatedVoucher,
      message: 'Contra voucher updated successfully' + (file ? ' with file upload' : '')
    });

  } catch (error) {
    console.error('Update error:', error);
   
    // Clean up uploaded file if error occurred
    if (req.file) fs.unlinkSync(req.file.path);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(error.errors).map(val => val.message)
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while updating contra voucher'
    });
  }
};

// Delete Contra Voucher
exports.deleteContraVoucher = async (req, res) => {
  try {
    const deletedVoucher = await ContraVoucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) {
      return res.status(404).json({ success: false, message: 'Contra voucher not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Contra voucher deleted successfully',
      data: { voucherId: deletedVoucher.voucherId, deletedAt: new Date() }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    }
    res.status(500).json({ success: false, error: 'Server error while deleting contra voucher' });
  }
};