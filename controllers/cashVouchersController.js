const CashVoucher = require('../models/CashVoucher');
const Branch = require('../models/Branch');

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
    if (!voucherType || !['credit', 'debit'].includes(voucherType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing voucherType (must be credit or debit)' });
    }
    if (!recipientName?.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required' });
    }
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount (greater than 0) is required' });
    }
    if (!cashLocation?.trim()) {
      return res.status(400).json({ success: false, message: 'Cash location is required' });
    }
    if (!expenseType?.trim()) {
      return res.status(400).json({ success: false, message: 'Expense type is required' });
    }
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (!branch) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    // === Check branch existence ===
    const branchExists = await Branch.findById(branch);
    if (!branchExists) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // === Create voucher ===
    const voucher = new CashVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      amount: parseFloat(amount),
      cashLocation: cashLocation.trim(),
      expenseType: expenseType.trim(),
      remark: remark?.trim() || '',
      status: status || 'pending',
      branch,
      date: date || new Date()
    });

    const savedVoucher = await voucher.save();
    const populatedVoucher = await savedVoucher.populate('branch'); // Populate branch details

    res.status(201).json({
      success: true,
      data: populatedVoucher,
      message: 'Cash voucher created successfully'
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(error.errors).map(val => val.message)
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Voucher ID already exists' });
    }
    console.error('Error creating cash voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while creating cash voucher' });
  }
};


// Get all Cash Vouchers with advanced filtering
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
    if (branch) query.branch = branch;

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
      .populate({
        path: 'branch',
        select: 'name address city state'
      })
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
    res.status(500).json({
      success: false,
      message: 'Server error while fetching cash vouchers'
    });
  }
};

// Get Cash Voucher by ID
exports.getCashVoucherById = async (req, res) => {
  try {
    const voucher = await CashVoucher.findById(req.params.id)
      .populate({
        path: 'branch',
        select: 'name address city state'
      });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Cash voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: voucher
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid voucher ID format'
      });
    }
    console.error('Error fetching cash voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching cash voucher'
    });
  }
};

// Update Cash Voucher
exports.updateCashVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent modification of immutable fields
    ['voucherId', 'paymentMode', 'date'].forEach(field => {
      if (updates[field]) {
        delete updates[field];
      }
    });

    // Trim string fields
    ['recipientName', 'cashLocation', 'expenseType', 'remark'].forEach(field => {
      if (updates[field]) updates[field] = updates[field].trim();
    });

    const updatedVoucher = await CashVoucher.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate({
      path: 'branch',
      select: 'name address city state'
    });

    if (!updatedVoucher) {
      return res.status(404).json({
        success: false,
        message: 'Cash voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedVoucher,
      message: 'Cash voucher updated successfully'
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: errors.length > 1 ? errors : errors[0]
      });
    }
    console.error('Error updating cash voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating cash voucher'
    });
  }
};

// Delete Cash Voucher
exports.deleteCashVoucher = async (req, res) => {
  try {
    const deletedVoucher = await CashVoucher.findByIdAndDelete(req.params.id);

    if (!deletedVoucher) {
      return res.status(404).json({
        success: false,
        message: 'Cash voucher not found'
      });
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
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid voucher ID format'
      });
    }
    console.error('Error deleting cash voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting cash voucher'
    });
  }
};

// Get Cash Voucher by voucherId
exports.getCashVoucherByVoucherId = async (req, res) => {
  try {
    const voucher = await CashVoucher.findOne({ voucherId: req.params.voucherId })
      .populate({
        path: 'branch',
        select: 'name address city state'
      });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Cash voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: voucher
    });

  } catch (error) {
    console.error('Error fetching cash voucher by voucherId:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching cash voucher'
    });
  }
};


exports.getCashVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    // Validate status against allowed values
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    const vouchers = await CashVoucher.find({ status })
      .populate('branch', 'name') // Example: only get branch name
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers
    });
  } catch (err) {
    console.error('Error fetching vouchers by status:', err);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};