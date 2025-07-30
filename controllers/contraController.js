const ContraVoucher = require('../models/ContraVoucherModel');

// Create a new contra voucher
exports.createContraVoucher = async (req, res) => {
  try {
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
    const vouchers = await ContraVoucher.find();
    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get all pending contra vouchers
exports.getPendingContraVouchers = async (req, res) => {
  try {
    const pendingVouchers = await ContraVoucher.find({ status: 'pending' });
    res.status(200).json({ success: true, data: pendingVouchers });
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

// Get all approved contra vouchers
exports.getApprovedContraVouchers = async (req, res) => {
  try {
    const vouchers = await ContraVoucher.find({ status: 'approved' });
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all rejected contra vouchers
exports.getRejectedContraVouchers = async (req, res) => {
  try {
    const vouchers = await ContraVoucher.find({ status: 'rejected' });
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Update contra voucher by ID
exports.updateContraVoucher = async (req, res) => {
  try {
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
