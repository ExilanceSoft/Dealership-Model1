const StockTransfer = require('../models/stockTransferModel');
const VehicleInward = require('../models/vehicleInwardModel');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path')
const mongoose = require('mongoose');
const { generateTrackingNumber } = require('../utils/trackingNumberGenerator');

// Helper function to validate transfer data (simplified)
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
    select: 'chassisNumber model modelName type colors color status unloadLocation',
    populate: [
      { path: 'model', select: 'model_name manufacturer variant fuel_type' }, // <-- Model details
      { path: 'colors', select: 'name' }, // <-- Array of color names
      { path: 'color.id', select: 'name' } // <-- Single color name (if you use color object)
    ]
  }
];

exports.createTransfer = async (req, res, next) => {
  // Remove transactions for standalone MongoDB
  try {
    const { fromBranch, toBranch, expectedDeliveryDate, items, notes } = req.body;

    // Validation (same as before)
    if (!fromBranch || !toBranch || !items?.length) {
      throw new AppError('Missing required fields', 400);
    }

    // Verify branches
    const branches = await Branch.find({ _id: { $in: [fromBranch, toBranch] } });
    if (branches.length !== 2) {
      throw new AppError('Branch not found', 404);
    }

    // Process vehicles
    const vehicleIds = [...new Set(items.map(i => i.vehicle))];
    if (vehicleIds.length !== items.length) {
      throw new AppError('Duplicate vehicles', 400);
    }

    // Update vehicles
    const updateResult = await VehicleInward.updateMany(
      { _id: { $in: vehicleIds }, unloadLocation: fromBranch, status: 'in_stock' },
      { 
        unloadLocation: toBranch,
        status: 'in_stock',
        lastUpdatedBy: req.user._id
      }
    );

    if (updateResult.modifiedCount !== vehicleIds.length) {
      throw new AppError('Some vehicles not available', 400);
    }

    // Create transfer record
    const transfer = await StockTransfer.create({
      fromBranch,
      toBranch,
      expectedDeliveryDate: expectedDeliveryDate || new Date(),
      items: items.map(item => ({
        vehicle: item.vehicle,
        status: 'completed',
        notes: item.notes || ''
      })),
      initiatedBy: req.user._id,
      notes,
      transferDate: new Date(),
      status: 'completed',
      challanStatus: 'pending'
    });

    res.status(201).json({
      status: 'success',
      data: {
        transferId: transfer._id,
        vehicles: vehicleIds,
        message: 'Transfer completed'
      }
    });

  } catch (error) {
    next(error);
  }
};
exports.getAllTransfers = async (req, res, next) => {
  try {
    const { fromBranch, toBranch, status, dateFrom, dateTo } = req.query;
    let query = StockTransfer.find();

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

exports.updateTransferStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
 
  try {
    const { transferId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(transferId)) {
      await session.abortTransaction();
      return next(new AppError('Invalid transfer ID format', 400));
    }

    if (!status || !['completed', 'cancelled'].includes(status)) {
      await session.abortTransaction();
      return next(new AppError('Only completed or cancelled status is allowed', 400));
    }

    const transfer = await StockTransfer.findById(transferId).session(session);
    if (!transfer) {
      await session.abortTransaction();
      return next(new AppError('No transfer found with that ID', 404));
    }

    // Only allow cancellation (completion happens automatically)
    if (status === 'cancelled') {
      transfer.status = 'cancelled';
      transfer.items.forEach(item => {
        item.status = 'cancelled';
      });

      await transfer.save({ session });

      // Revert vehicle locations to source branch
      const vehicleIds = transfer.items.map(item => item.vehicle);
      await Vehicle.updateMany(
        { _id: { $in: vehicleIds } },
        { unloadLocation: transfer.fromBranch },
        { session }
      );
    }

    await session.commitTransaction();
   
    const updatedTransfer = await StockTransfer.findById(transferId)
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      data: {
        transfer: updatedTransfer
      }
    });
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Error updating transfer status: ${err.message}`);
    next(new AppError('Failed to update transfer status', 500));
  } finally {
    session.endSession();
  }
};

exports.updateTransferItemStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
 
  try {
    const { transferId, itemId } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(transferId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      await session.abortTransaction();
      return next(new AppError('Invalid transfer or item ID format', 400));
    }

    if (!status || status !== 'cancelled') {
      await session.abortTransaction();
      return next(new AppError('Only cancellation is allowed for individual items', 400));
    }

    const transfer = await StockTransfer.findById(transferId).session(session);
    if (!transfer) {
      await session.abortTransaction();
      return next(new AppError('No transfer found with that ID', 404));
    }

    const item = transfer.items.id(itemId);
    if (!item) {
      await session.abortTransaction();
      return next(new AppError('No item found with that ID in this transfer', 404));
    }

    item.status = 'cancelled';
    if (notes) item.notes = notes;

    await transfer.save({ session });

    // Revert this specific vehicle's location to source branch
    await Vehicle.findByIdAndUpdate(
      item.vehicle,
      { unloadLocation: transfer.fromBranch },
      { session }
    );

    await session.commitTransaction();
   
    const updatedTransfer = await StockTransfer.findById(transferId)
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      data: {
        transfer: updatedTransfer
      }
    });
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Error updating transfer item status: ${err.message}`);
    next(new AppError('Failed to update transfer item status', 500));
  } finally {
    session.endSession();
  }
};

exports.getTransfersByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { direction = 'both' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    let query;
    switch (direction) {
      case 'incoming':
        query = StockTransfer.find({ toBranch: branchId });
        break;
      case 'outgoing':
        query = StockTransfer.find({ fromBranch: branchId });
        break;
      default:
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

// Get vehicles at a branch (removed availability check)
exports.getVehiclesAtBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { model } = req.query;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    // Build query for vehicles at branch
    let query = Vehicle.find({
      unloadLocation: branchId
    }).populate([
      { path: 'model', select: 'model_name type' },
      { path: 'colors', select: 'name' }
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
    logger.error(`Error getting vehicles at branch: ${err.message}`);
    next(new AppError('Failed to get vehicles', 500));
  }
};

exports.uploadTransferChallan = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(transferId)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return next(new AppError('Invalid transfer ID format', 400));
    }

    if (!req.file) {
      return next(new AppError('Please upload a document file', 400));
    }

    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      if (req.file) fs.unlinkSync(req.file.path);
      return next(new AppError('No transfer found with that ID', 404));
    }

    // Store only the filename (not full path)
    const filename = path.basename(req.file.path);
    const relativePath = `uploads/transfers/${filename}`;

    // Delete old file if exists
    if (transfer.challanDocument) {
      const oldPath = path.join(__dirname, '../..', transfer.challanDocument);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    transfer.challanDocument = relativePath;
    transfer.challanStatus = 'uploaded'; // Set status to uploaded
    await transfer.save();

    const updatedTransfer = await StockTransfer.findById(transferId)
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      data: {
        transfer: updatedTransfer
      }
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    logger.error(`Error uploading transfer challan: ${err.message}`);
    next(new AppError('Failed to upload transfer challan', 500));
  }
};

// exports.getTransferChallan = async (req, res, next) => {
//   try {
//     const { transferId } = req.params;
    
//     if (!mongoose.Types.ObjectId.isValid(transferId)) {
//       return next(new AppError('Invalid transfer ID format', 400));
//     }

//     const transfer = await StockTransfer.findById(transferId);
    
//     if (!transfer) {
//       return next(new AppError('No transfer found with that ID', 404));
//     }

//     if (!transfer.challanDocument) {
//       return next(new AppError('No challan document uploaded for this transfer', 404));
//     }

//     // Construct the URL for the file
//     const fileUrl = `http://${req.get('host')}/api/v1/${transfer.challanDocument}`;

//     // Or if you want to serve the file directly:
//     const filePath = path.join(__dirname, '../..', transfer.challanDocument);
//     if (!fs.existsSync(filePath)) {
//       return next(new AppError('Challan document not found on server', 404));
//     }

//     const ext = path.extname(filePath).toLowerCase();
//     let contentType = 'application/octet-stream';
    
//     if (ext === '.pdf') contentType = 'application/pdf';
//     else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
//     else if (ext === '.png') contentType = 'image/png';

//     res.sendFile(filePath, {
//       headers: {
//         'Content-Type': contentType
//       }
//     });
//   } catch (err) {
//     logger.error(`Error getting transfer challan: ${err.message}`);
//     next(new AppError('Failed to get transfer challan', 500));
//   }
// };