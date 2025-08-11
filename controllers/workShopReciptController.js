const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const { v4: uuidv4 } = require("uuid");

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
      bankName,
      status,
      bankLocation,
    } = req.body;

    const voucher = await WorkShopReciptVoucher.create({
      voucherId: `WRV-${uuidv4()}`,
      voucherType,
      recipientName,
      reciptType,
      amount,
      remark,
      bankName,
      status,
      bankLocation,
    });

    sendResponse(res, 201, true, "Workshop receipt voucher created", voucher);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// GET: All vouchers
exports.getAllWorkShopReciptVouchers = async (req, res) => {
  try {
    const vouchers = await WorkShopReciptVoucher.find().sort({ createdAt: -1 });
    sendResponse(res, 200, true, "Vouchers retrieved successfully", vouchers);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// GET: Voucher by ID
exports.getWorkShopReciptVoucherById = async (req, res) => {
  try {
    const voucher = await WorkShopReciptVoucher.findById(req.params.id);
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
    const vouchers = await WorkShopReciptVoucher.find({ status });
    sendResponse(
      res,
      200,
      true,
      `Vouchers with status '${status}' retrieved successfully`,
      vouchers
    );
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// PUT: Update voucher by ID
exports.updateWorkShopReciptVoucher = async (req, res) => {
  try {
    const voucher = await WorkShopReciptVoucher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!voucher) {
      return sendResponse(res, 404, false, "Voucher not found");
    }
    sendResponse(res, 200, true, "Voucher updated successfully", voucher);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};

// DELETE: Remove voucher by ID
exports.deleteWorkShopReciptVoucher = async (req, res) => {
  try {
    const voucher = await WorkShopReciptVoucher.findByIdAndDelete(
      req.params.id
    );
    if (!voucher) {
      return sendResponse(res, 404, false, "Voucher not found");
    }
    sendResponse(res, 200, true, "Voucher deleted successfully", null);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
};
