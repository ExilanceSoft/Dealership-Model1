const StockTransfer = require('../models/stockTransferModel');
const Vehicle = require('../models/vehicleInwardModel');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');

// Helper function to validate transfer data
const validateTransferData = (data) => {
  const errors = [];
  
  if (!data.fromBranch) errors.push('Source branch is required');
  if (!data.toBranch) errors.push('Destination branch is required');
  if (!data.items || data.items.length === 0) errors.push('At least one vehicle is required for transfer');
  
  return errors.length > 0 ? errors : null;
};

// Population options for stock transfers
const populateOptions = [
  { path: 'fromBranchDetails', select: 'name address city state' },
  { path: 'toBranchDetails', select: 'name address city state' },
  { path: 'initiatedByDetails', select: 'name email' },
  { path: 'receivedByDetails', select: 'name email' },
  { 
    path: 'items.vehicle', 
    select: 'chassisNumber model type colors status',
    populate: [
      { path: 'model', select: 'model_name' },
      { path: 'colors', select: 'name hex_code' }
    ]
  }
];

// Create a new stock transfer
exports.createTransfer = async (req, res, next) => {
  try {
    // Validate request body
    const validationErrors = validateTransferData(req.body);
    if (validationErrors) {
      return next(new AppError(validationErrors.join(', '), 400));
    }

    // Check if branches are different
    if (req.body.fromBranch === req.body.toBranch) {
      return next(new AppError('Source and destination branches cannot be the same', 400));
    }

    // Create the transfer
    const transfer = await StockTransfer.create({
      ...req.body,
      initiatedBy: req.user.id,
      expectedDeliveryDate: req.body.expectedDeliveryDate || new Date()
    });

    // Populate the transfer details
    const populatedTransfer = await StockTransfer.findById(transfer._id)
      .populate(populateOptions);

    res.status(201).json({
      status: 'success',
      data: {
        transfer: populatedTransfer
      }
    });
  } catch (err) {
    logger.error(`Error creating stock transfer: ${err.message}`);
    next(new AppError('Failed to create stock transfer', 500));
  }
};

// Get all stock transfers with filtering
exports.getAllTransfers = async (req, res, next) => {
  try {
    const { fromBranch, toBranch, status, dateFrom, dateTo } = req.query;
    let query = StockTransfer.find();

    // Apply filters
    if (fromBranch && mongoose.Types.ObjectId.isValid(fromBranch)) {
      query = query.where('fromBranch').equals(fromBranch);
    }

    if (toBranch && mongoose.Types.ObjectId.isValid(toBranch)) {
      query = query.where('toBranch').equals(toBranch);
    }

    if (status) {
      query = query.where('status').equals(status);
    }

    if (dateFrom) {
      query = query.where('transferDate').gte(new Date(dateFrom));
    }

    if (dateTo) {
      query = query.where('transferDate').lte(new Date(dateTo));
    }

    // Apply population and sorting
    query = query
      .populate(populateOptions)
      .sort({ transferDate: -1 });

    const transfers = await query;

    res.status(200).json({
      status: 'success',
      results: transfers.length,
      data: {
        transfers
      }
    });
  } catch (err) {
    logger.error(`Error getting stock transfers: ${err.message}`);
    next(new AppError('Failed to get stock transfers', 500));
  }
};

// Get a single transfer by ID
exports.getTransferById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.transferId)) {
      return next(new AppError('Invalid transfer ID format', 400));
    }

    const transfer = await StockTransfer.findById(req.params.transferId)
      .populate(populateOptions);

    if (!transfer) {
      return next(new AppError('No transfer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        transfer
      }
    });
  } catch (err) {
    logger.error(`Error getting transfer by ID: ${err.message}`);
    next(new AppError('Failed to get transfer', 500));
  }
};

// Update transfer status (e.g., mark as in transit or completed)
exports.updateTransferStatus = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(transferId)) {
      return next(new AppError('Invalid transfer ID format', 400));
    }

    if (!status || !['pending', 'in_transit', 'completed', 'cancelled'].includes(status)) {
      return next(new AppError('Valid status is required', 400));
    }

    // Get the current transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      return next(new AppError('No transfer found with that ID', 404));
    }

    // Prevent invalid status transitions
    if (transfer.status === 'completed' || transfer.status === 'cancelled') {
      return next(new AppError(`Cannot modify a ${transfer.status} transfer`, 400));
    }

    // Handle status-specific logic
    if (status === 'in_transit') {
      // Mark transfer as in transit
      transfer.status = 'in_transit';
      await transfer.save();
    } 
    else if (status === 'completed') {
      // Mark transfer as completed and update vehicle locations
      transfer.status = 'completed';
      transfer.receivedBy = req.user.id;
      transfer.receivedAt = new Date();

      // Update each item status
      transfer.items.forEach(item => {
        item.status = 'completed';
        item.receivedAt = new Date();
        item.receivedBy = req.user.id;
      });

      await transfer.save();

      // Update vehicle locations and statuses
      const vehicleIds = transfer.items.map(item => item.vehicle);
      await Vehicle.updateMany(
        { _id: { $in: vehicleIds } },
        { 
          unloadLocation: transfer.toBranch,
          status: 'in_stock'
        }
      );
    }
    else if (status === 'cancelled') {
      // Mark transfer as cancelled and revert vehicle statuses
      transfer.status = 'cancelled';
      
      // Update each item status
      transfer.items.forEach(item => {
        item.status = 'cancelled';
      });

      await transfer.save();

      // Revert vehicle statuses to 'in_stock'
      const vehicleIds = transfer.items.map(item => item.vehicle);
      await Vehicle.updateMany(
        { _id: { $in: vehicleIds } },
        { status: 'in_stock' }
      );
    }

    // Get the updated transfer with populated data
    const updatedTransfer = await StockTransfer.findById(transferId)
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      data: {
        transfer: updatedTransfer
      }
    });
  } catch (err) {
    logger.error(`Error updating transfer status: ${err.message}`);
    next(new AppError('Failed to update transfer status', 500));
  }
};

// Update individual transfer item status
exports.updateTransferItemStatus = async (req, res, next) => {
  try {
    const { transferId, itemId } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(transferId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return next(new AppError('Invalid transfer or item ID format', 400));
    }

    if (!status || !['pending', 'in_transit', 'completed', 'cancelled'].includes(status)) {
      return next(new AppError('Valid status is required', 400));
    }

    // Find the transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      return next(new AppError('No transfer found with that ID', 404));
    }

    // Find the item
    const item = transfer.items.id(itemId);
    if (!item) {
      return next(new AppError('No item found with that ID in this transfer', 404));
    }

    // Update item status
    item.status = status;
    if (notes) item.notes = notes;

    if (status === 'completed') {
      item.receivedAt = new Date();
      item.receivedBy = req.user.id;

      // Update vehicle location and status
      await Vehicle.findByIdAndUpdate(item.vehicle, {
        unloadLocation: transfer.toBranch,
        status: 'in_stock'
      });
    }

    await transfer.save();

    // Get the updated transfer with populated data
    const updatedTransfer = await StockTransfer.findById(transferId)
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      data: {
        transfer: updatedTransfer
      }
    });
  } catch (err) {
    logger.error(`Error updating transfer item status: ${err.message}`);
    next(new AppError('Failed to update transfer item status', 500));
  }
};

// Get transfers by branch (either as source or destination)
exports.getTransfersByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { direction = 'both' } = req.query; // 'incoming', 'outgoing', or 'both'

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    let query;
    if (direction === 'incoming') {
      query = StockTransfer.find({ toBranch: branchId });
    } else if (direction === 'outgoing') {
      query = StockTransfer.find({ fromBranch: branchId });
    } else {
      query = StockTransfer.find({
        $or: [
          { fromBranch: branchId },
          { toBranch: branchId }
        ]
      });
    }

    const transfers = await query
      .populate(populateOptions)
      .sort({ transferDate: -1 });

    res.status(200).json({
      status: 'success',
      results: transfers.length,
      data: {
        transfers
      }
    });
  } catch (err) {
    logger.error(`Error getting transfers by branch: ${err.message}`);
    next(new AppError('Failed to get transfers by branch', 500));
  }
};

// Get vehicles available for transfer from a branch
exports.getAvailableVehiclesForTransfer = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { model } = req.query;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    // Check if branch exists and is active
    const branchExists = await Branch.exists({ _id: branchId, is_active: true });
    if (!branchExists) {
      return next(new AppError('Branch not found or inactive', 404));
    }

    // Build query for available vehicles
    let query = Vehicle.find({
      unloadLocation: branchId,
      status: 'in_stock'
    }).populate([
      { path: 'model', select: 'model_name type' },
      { path: 'colors', select: 'name hex_code' }
    ]);

    // Filter by model if provided
    if (model && mongoose.Types.ObjectId.isValid(model)) {
      query = query.where('model').equals(model);
    }

    const vehicles = await query;

    res.status(200).json({
      status: 'success',
      results: vehicles.length,
      data: {
        vehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting available vehicles for transfer: ${err.message}`);
    next(new AppError('Failed to get available vehicles', 500));
  }
};