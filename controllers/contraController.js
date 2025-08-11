const ContraVoucher = require('../models/ContraVoucherModel');
const { v4: uuidv4 } = require('uuid');

// Create a new contra voucher
exports.createContraVoucher = async (req, res) => {
  try {
    // Ensure voucherId is unique (if not provided, generate)
    if (!req.body.voucherId) {
      req.body.voucherId = `CV-${uuidv4()}`;
    }

    // Force paymentMode to "cash" (per schema restriction)
    req.body.paymentMode = 'cash';

    const contra = new ContraVoucher(req.body);
    await contra.save();
    res.status(201).json({ success: true, data: contra });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all contra vouchers
exports.getAllContraVouchers = async (req, res) => {
  try {
    const vouchers = await ContraVoucher.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get contra vouchers by status
exports.getContraVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    const vouchers = await ContraVoucher.find({ status });
    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get contra voucher by ID
exports.getContraVoucherById = async (req, res) => {
  try {
    const voucher = await ContraVoucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Contra Voucher not found' });
    }
    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update contra voucher by ID
exports.updateContraVoucher = async (req, res) => {
  try {
    // Enforce paymentMode to remain 'cash'
    if (req.body.paymentMode && req.body.paymentMode !== 'cash') {
      return res.status(400).json({ success: false, message: 'paymentMode must be "cash"' });
    }

    const updated = await ContraVoucher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Contra Voucher not found' });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete contra voucher by ID
exports.deleteContraVoucher = async (req, res) => {
  try {
    const deleted = await ContraVoucher.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Contra Voucher not found' });
    }
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
