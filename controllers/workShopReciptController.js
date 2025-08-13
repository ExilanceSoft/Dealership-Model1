const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const Branch = require("../models/Branch");

// Utility: send uniform response
const sendResponse = (res, status, success, message, data = null) => {
  res.status(status).json({ success, message, data });
};

// POST: Create a new voucher
exports.createWorkShopReciptVoucher = async (req, res) => {
  try {
    const {
      voucherType,
      recipientName,
      reciptType,
      amount,
      remark,
      status,
      bankLocation,
      branch,
      date
    } = req.body;

    // Validate branch existence
    const branchExists = await Branch.findById(branch);
    if (!branchExists) {
      return sendResponse(res, 400, false, "Invalid branch ID");
    }

    const voucher = new WorkShopReciptVoucher({
      voucherType,
      recipientName,
      reciptType,
      amount,
      remark,
      status: status || "pending",
      bankLocation,
      branch,
      date: date || new Date()
    });

    const savedVoucher = await voucher.save();

    sendResponse(res, 201, true, "Workshop receipt voucher created successfully", savedVoucher);
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(val => val.message);
      return sendResponse(res, 400, false, errors.length > 1 ? errors : errors[0]);
    }
    if (error.code === 11000) {
      return sendResponse(res, 400, false, "Voucher ID already exists");
    }
    console.error("Error creating workshop receipt voucher:", error);
    sendResponse(res, 500, false, "Server error while creating workshop receipt voucher");
  }
};

// GET: All vouchers
exports.getAllWorkShopReciptVouchers = async (req, res) => {
  try {
    const vouchers = await WorkShopReciptVoucher.find().sort({ createdAt: -1 }).populate("branch");
    sendResponse(res, 200, true, "Vouchers retrieved successfully", vouchers);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// GET: Voucher by ID
exports.getWorkShopReciptVoucherById = async (req, res) => {
  try {
    const voucher = await WorkShopReciptVoucher.findById(req.params.id).populate("branch");
    if (!voucher) {
      return sendResponse(res, 404, false, "Voucher not found");
    }
    sendResponse(res, 200, true, "Voucher retrieved successfully", voucher);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// GET: Vouchers by status
exports.getWorkShopReciptVouchersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const vouchers = await WorkShopReciptVoucher.find({ status }).populate("branch");
    sendResponse(res, 200, true, `Vouchers with status '${status}' retrieved successfully`, vouchers);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// PUT: Update voucher by ID
exports.updateWorkShopReciptVoucher = async (req, res) => {
  try {
    if (req.body.branch) {
      const branchExists = await Branch.findById(req.body.branch);
      if (!branchExists) {
        return sendResponse(res, 400, false, "Invalid branch ID");
      }
    }

    const voucher = await WorkShopReciptVoucher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("branch");

    if (!voucher) {
      return sendResponse(res, 404, false, "Voucher not found");
    }
    sendResponse(res, 200, true, "Voucher updated successfully", voucher);
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(val => val.message);
      return sendResponse(res, 400, false, errors.length > 1 ? errors : errors[0]);
    }
    sendResponse(res, 500, false, error.message);
  }
};

// DELETE: Remove voucher by ID
exports.deleteWorkShopReciptVoucher = async (req, res) => {
  try {
    const voucher = await WorkShopReciptVoucher.findByIdAndDelete(req.params.id);
    if (!voucher) {
      return sendResponse(res, 404, false, "Voucher not found");
    }
    sendResponse(res, 200, true, "Voucher deleted successfully", null);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};
