const CashVoucher = require('../models/CashVoucher');

// Create a new Cash Voucher
exports.createCashVoucher = async (req, res) => {
  try {
    const { voucherType, recipientName, amount, cashLocation, expenseType, remark, status } = req.body;

    // Validation
    if (!voucherType || !['credit', 'debit'].includes(voucherType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing voucherType (must be credit or debit)' });
    }
    if (!recipientName || !recipientName.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount (greater than 0) is required' });
    }
    if (!cashLocation || !cashLocation.trim()) {
      return res.status(400).json({ success: false, message: 'Cash location is required' });
    }
    if (!expenseType || !expenseType.trim()) {
      return res.status(400).json({ success: false, message: 'Expense type is required' });
    }
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (must be pending, approved, or rejected)' });
    }

    const voucher = new CashVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      amount: parseFloat(amount),
      cashLocation: cashLocation.trim(),
      expenseType: expenseType.trim(),
      remark: remark ? remark.trim() : undefined,
      status: status || 'pending',
      paymentMode: 'cash' // Default
    });

    const savedVoucher = await voucher.save();

    res.status(201).json({
      success: true,
      data: savedVoucher,
      message: 'Cash voucher created successfully'
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: Object.values(error.errors).map(val => val.message) });
    }
    res.status(500).json({ success: false, error: 'Server error while creating cash voucher' });
  }
};

// Get all Cash Vouchers
exports.getAllCashVouchers = async (req, res) => {
  try {
    const { status, voucherType, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (voucherType) query.voucherType = voucherType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const vouchers = await CashVoucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await CashVoucher.countDocuments(query);

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
    res.status(500).json({ success: false, error: 'Server error while fetching cash vouchers' });
  }
};

// Get Cash Voucher by ID
exports.getCashVoucherById = async (req, res) => {
  try {
    const voucher = await CashVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Cash voucher not found' });

    res.status(200).json({ success: true, data: voucher });

  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    res.status(500).json({ success: false, error: 'Server error while fetching cash voucher' });
  }
};

// Update Cash Voucher
exports.updateCashVoucher = async (req, res) => {
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

    ['recipientName', 'cashLocation', 'expenseType', 'remark'].forEach(field => {
      if (updates[field]) updates[field] = updates[field].trim();
    });

    const updatedVoucher = await CashVoucher.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updatedVoucher) return res.status(404).json({ success: false, message: 'Cash voucher not found' });

    res.status(200).json({ success: true, data: updatedVoucher, message: 'Cash voucher updated successfully' });

  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, error: Object.values(error.errors).map(val => val.message) });
    res.status(500).json({ success: false, error: 'Server error while updating cash voucher' });
  }
};

// Get cash vouchers by status
exports.getCashVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    // Validate status
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    // Fetch vouchers with matching status
    const vouchers = await CashVoucher.find({ status }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers
    });

  } catch (error) {
    console.error('Error fetching cash vouchers by status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching cash vouchers by status'
    });
  }
};


// Delete Cash Voucher
exports.deleteCashVoucher = async (req, res) => {
  try {
    const deletedVoucher = await CashVoucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) return res.status(404).json({ success: false, message: 'Cash voucher not found' });

    res.status(200).json({
      success: true,
      message: 'Cash voucher deleted successfully',
      data: { voucherId: deletedVoucher.voucherId, deletedAt: new Date() }
    });

  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid voucher ID format' });
    res.status(500).json({ success: false, error: 'Server error while deleting cash voucher' });
  }
};

// Get by Status
exports.getCashVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status (must be pending, approved, or rejected)' });
    }

    const vouchers = await CashVoucher.find({ status }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers, count: vouchers.length });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error while fetching cash vouchers by status' });
  }
};
