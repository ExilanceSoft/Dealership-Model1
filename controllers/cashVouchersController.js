const CashVoucher = require('../models/CashVoucher');

// Create a new Cash Voucher
exports.createCashVoucher = async (req, res) => {
  try {
    const voucher = new CashVoucher(req.body);
    const savedVoucher = await voucher.save();
    res.status(201).json(savedVoucher);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all Cash Vouchers
exports.getAllCashVouchers = async (req, res) => {
  try {
    const vouchers = await CashVoucher.find().sort({ createdAt: -1 });
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a Cash Voucher by ID
exports.getCashVoucherById = async (req, res) => {
  try {
    const voucher = await CashVoucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.status(200).json(voucher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a Cash Voucher by ID
exports.updateCashVoucher = async (req, res) => {
  try {
    const updatedVoucher = await CashVoucher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedVoucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.status(200).json(updatedVoucher);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a Cash Voucher by ID
exports.deleteCashVoucher = async (req, res) => {
  try {
    const deletedVoucher = await CashVoucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.status(200).json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
