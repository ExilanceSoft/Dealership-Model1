const Bank = require('../models/Bank');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Create a new bank
exports.createBank = async (req, res, next) => {
  try {
    const { name, branch } = req.body;

    // Validate input
    if (!name) {
      return next(new AppError('Bank name is required', 400));
    }
    if (!branch) {
      return next(new AppError('Branch reference is required', 400));
    }

    // Create new bank
    const bank = await Bank.create({
      name,
      branch,
      createdBy: req.user.id // Set creator to current user
    });

    // Populate branch details in the response
    const populatedBank = await Bank.findById(bank._id)
      .populate('branchDetails', 'name');

    // Return success response
    res.status(201).json({
      status: 'success',
      data: {
        bank: populatedBank
      }
    });
  } catch (err) {
    logger.error(`Error creating bank: ${err.message}`);
    next(err);
  }
};

// Get all banks (with optional filtering)
exports.getAllBanks = async (req, res, next) => {
  try {
    const filter = {};
    
    // Add branch filter if provided
    if (req.query.branch) {
      filter.branch = req.query.branch;
    }
    
    // Add status filter if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    
    // Add search filter if provided
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' }; // Case-insensitive search
    }

    // Query banks with filters
    const banks = await Bank.find(filter)
      .populate('createdByDetails', 'name email')
      .populate('branchDetails', 'name')
      .sort({ name: 1 }); // Sort by name ascending

    // Return success response
    res.status(200).json({
      status: 'success',
      results: banks.length,
      data: {
        banks
      }
    });
  } catch (err) {
    logger.error(`Error getting banks: ${err.message}`);
    next(err);
  }
};

// Get single bank by ID
exports.getBankById = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.params.id)
      .populate('createdByDetails', 'name email')
      .populate('branchDetails', 'name');

    // Check if bank exists
    if (!bank) {
      return next(new AppError('No bank found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        bank
      }
    });
  } catch (err) {
    logger.error(`Error getting bank: ${err.message}`);
    next(err);
  }
};

// Update a bank
exports.updateBank = async (req, res, next) => {
  try {
    const { name, branch, status } = req.body;

    // Update bank details
    const updatedBank = await Bank.findByIdAndUpdate(
      req.params.id,
      {
        name,
        branch,
        status
      },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    )
    .populate('createdByDetails', 'name email')
    .populate('branchDetails', 'name');

    // Check if bank exists
    if (!updatedBank) {
      return next(new AppError('No bank found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        bank: updatedBank
      }
    });
  } catch (err) {
    logger.error(`Error updating bank: ${err.message}`);
    next(err);
  }
};

// Update bank status only
exports.updateBankStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    // Update status
    const updatedBank = await Bank.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    )
    .populate('branchDetails', 'name');

    // Check if bank exists
    if (!updatedBank) {
      return next(new AppError('No bank found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        bank: updatedBank
      }
    });
  } catch (err) {
    logger.error(`Error updating bank status: ${err.message}`);
    next(err);
  }
};

// Delete a bank
exports.deleteBank = async (req, res, next) => {
  try {
    const bank = await Bank.findByIdAndDelete(req.params.id);

    // Check if bank exists
    if (!bank) {
      return next(new AppError('No bank found with that ID', 404));
    }

    // Return success response (no content)
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting bank: ${err.message}`);
    next(err);
  }
};