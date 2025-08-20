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
    if (!contraType?.trim()) {
      return res.status(400).json({ success: false, message: 'Contra type is required' });
    }
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }
    if (!bankLocation?.trim()) {
      return res.status(400).json({ success: false, message: 'Bank location is required' });
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
      const uploadDir = path.join(__dirname, '../uploads/contra-vouchers');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      billUrl = `/uploads/contra-vouchers/${filename}`;

      await fs.promises.writeFile(filePath, req.file.buffer);
    }

    const voucher = new ContraVoucher({
      voucherType,
      recipientName: recipientName.trim(),
      contraType: contraType.trim(),
      amount: parseFloat(amount),
      bankLocation: bankLocation.trim(),
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
      message: 'Contra voucher created successfully'
    });

  } catch (error) {
    console.error('Error creating contra voucher:', error);
    res.status(500).json({ success: false, error: 'Server error while creating contra voucher' });
  }
};



// Get All Contra Vouchers (with filters & pagination)
exports.getAllContraVouchers = async (req, res) => {
  try {
    const { status, voucherType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};


    if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;
    if (voucherType && ['credit', 'debit'].includes(voucherType)) query.voucherType = voucherType;
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




exports.updateContraVoucher = async (req, res) => {
  try {
    const updateData = {};

    // Allow updating status if provided
    if (req.body.status) {
      updateData.status = req.body.status;
    }

    // If bill file uploaded, save file & update billUrl
    if (req.file) {
      const uploadDir = path.join(__dirname, "../uploads/contra-vouchers");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `bill-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      await fs.promises.writeFile(filePath, req.file.buffer);
      updateData.billUrl = `/uploads/contra-vouchers/${filename}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Only 'status' and 'billUrl' can be updated.",
      });
    }

    const updatedVoucher = await ContraVoucher.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("branch");

    if (!updatedVoucher) {
      return res.status(404).json({
        success: false,
        message: "Contra voucher not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedVoucher,
    });
  } catch (error) {
    console.error("Error updating contra voucher:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating contra voucher",
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



