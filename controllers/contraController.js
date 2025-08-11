// controllers/contraVoucherController.js
const ContraVoucher = require('../models/ContraVoucherModel');

// Create Contra Voucher with numeric ID
exports.createContraVoucher = async (req, res) => {
  try {
    const { voucherType, recipientName, contraType, amount, bankLocation, remark, status } = req.body;

    // Validation
    if (!voucherType || !['credit', 'debit'].includes(voucherType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing voucherType (must be credit or debit)' });
    }
    if (!recipientName || !recipientName.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required' });
    }
    if (!contraType || !contraType.trim()) {
      return res.status(400).json({ success: false, message: 'Contra type is required' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount (greater than 0) is required' });
    }
    if (!bankLocation || !bankLocation.trim()) {
      return res.status(400).json({ success: false, message: 'Bank location is required' });
    }
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Get last voucher to determine next ID
    const lastVoucher = await ContraVoucher.findOne().sort({ createdAt: -1 });
    let nextId = 1;
    if (lastVoucher && lastVoucher.voucherId) {
      const lastNum = parseInt(lastVoucher.voucherId.replace(/\D/g, ''), 10); // remove non-numbers
      if (!isNaN(lastNum)) {
        nextId = lastNum + 1;
      }
    }

    const voucher = new ContraVoucher({
      voucherId: `CV-${nextId}`,
      voucherType,
      recipientName: recipientName.trim(),
      contraType: contraType.trim(),
      amount: parseFloat(amount),
      bankLocation: bankLocation.trim(),
      remark: remark ? remark.trim() : '',
      status: status || 'pending',
      paymentMode: 'cash'
    });

    const savedVoucher = await voucher.save();

    res.status(201).json({
      success: true,
      data: savedVoucher,
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


exports.getAllContraVouchers = async (req, res) => {
  try {
    const { status, voucherType, startDate, endDate} = req.query;
    const query = {};

    if (status) query.status = status;
    if (voucherType) query.voucherType = voucherType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const vouchers = await ContraVoucher.find(query).sort({ createdAt: -1 }).skip(skip);
    const total = await ContraVoucher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vouchers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error while fetching contra vouchers' });
  }
};

// Get Contra Voucher by ID
exports.getContraVoucherById = async (req, res) => {
  try {
    const voucher = await ContraVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Contra voucher not found' });

    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    res.status(500).json({ success: false, error: 'Server error while fetching contra voucher' });
  }
};

// Update Contra Voucher
exports.updateContraVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.voucherType && !['credit', 'debit'].includes(updates.voucherType)) {
      return res.status(400).json({ success: false, message: 'Invalid voucherType (must be credit or debit)' });
    }
    if (updates.status && !['pending', 'approved', 'rejected'].includes(updates.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (must be pending, approved, or rejected)' });
    }
    if (updates.amount && (isNaN(updates.amount) || updates.amount <= 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    ['recipientName', 'contraType', 'bankLocation', 'remark'].forEach(field => {
      if (updates[field]) updates[field] = updates[field].trim();
    });

    const updatedVoucher = await ContraVoucher.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updatedVoucher) return res.status(404).json({ success: false, message: 'Contra voucher not found' });

    res.status(200).json({ success: true, data: updatedVoucher, message: 'Contra voucher updated successfully' });

  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, error: Object.values(error.errors).map(val => val.message) });
    res.status(500).json({ success: false, error: 'Server error while updating contra voucher' });
  }
};

// Delete Contra Voucher
exports.deleteContraVoucher = async (req, res) => {
  try {
    const deletedVoucher = await ContraVoucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) return res.status(404).json({ success: false, message: 'Contra voucher not found' });

    res.status(200).json({
      success: true,
      message: 'Contra voucher deleted successfully',
      data: { voucherId: deletedVoucher.voucherId, deletedAt: new Date() }
    });

  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    res.status(500).json({ success: false, error: 'Server error while deleting contra voucher' });
  }
};

// Get Contra Vouchers by Status
exports.getContraVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (must be pending, approved, or rejected)' });
    }

    const vouchers = await ContraVoucher.find({ status }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers, count: vouchers.length });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error while fetching contra vouchers by status' });
  }
};
