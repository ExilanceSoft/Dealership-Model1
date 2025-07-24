const CashLocation = require('../models/cashLocation');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Create a new cash location
exports.createCashLocation = async (req, res, next) => {
  try {
    const { name, branch, description } = req.body;

    // Validate input
    if (!name) {
      return next(new AppError('Cash location name is required', 400));
    }
    if (!branch) {
      return next(new AppError('Branch reference is required', 400));
    }

    // Check for duplicate name
    const existingLocation = await CashLocation.findOne({ name });
    if (existingLocation) {
      return next(new AppError('Cash location with this name already exists', 400));
    }

    // Create new cash location
    const cashLocation = await CashLocation.create({
      name,
      branch,
      description,
      createdBy: req.user.id // Set creator to current user
    });

    // Populate branch details in the response
    const populatedCashLocation = await CashLocation.findById(cashLocation._id)
      .populate('branchDetails', 'name');

    // Return success response
    res.status(201).json({
      status: 'success',
      data: {
        cashLocation: populatedCashLocation
      }
    });
  } catch (err) {
    logger.error(`Error creating cash location: ${err.message}`);
    next(err);
  }
};

// Get all cash locations (with optional filtering)
exports.getAllCashLocations = async (req, res, next) => {
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

    // Query cash locations with filters
    const cashLocations = await CashLocation.find(filter)
      .populate('createdByDetails', 'name email')
      .populate('branchDetails', 'name')
      .sort({ name: 1 }); // Sort by name ascending

    // Return success response
    res.status(200).json({
      status: 'success',
      results: cashLocations.length,
      data: {
        cashLocations
      }
    });
  } catch (err) {
    logger.error(`Error getting cash locations: ${err.message}`);
    next(err);
  }
};

// Get single cash location by ID
exports.getCashLocationById = async (req, res, next) => {
  try {
    const cashLocation = await CashLocation.findById(req.params.id)
      .populate('createdByDetails', 'name email')
      .populate('branchDetails', 'name');

    // Check if cash location exists
    if (!cashLocation) {
      return next(new AppError('No cash location found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        cashLocation
      }
    });
  } catch (err) {
    logger.error(`Error getting cash location: ${err.message}`);
    next(err);
  }
};

// Update a cash location
exports.updateCashLocation = async (req, res, next) => {
  try {
    const { name, branch, status, description } = req.body;

    // Check for duplicate name if name is being updated
    if (name) {
      const existingLocation = await CashLocation.findOne({ 
        name, 
        _id: { $ne: req.params.id } 
      });
      if (existingLocation) {
        return next(new AppError('Cash location with this name already exists', 400));
      }
    }

    // Update cash location details
    const updatedCashLocation = await CashLocation.findByIdAndUpdate(
      req.params.id,
      {
        name,
        branch,
        status,
        description
      },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    )
    .populate('createdByDetails', 'name email')
    .populate('branchDetails', 'name');

    // Check if cash location exists
    if (!updatedCashLocation) {
      return next(new AppError('No cash location found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        cashLocation: updatedCashLocation
      }
    });
  } catch (err) {
    logger.error(`Error updating cash location: ${err.message}`);
    next(err);
  }
};

// Update cash location status only
exports.updateCashLocationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    // Update status
    const updatedCashLocation = await CashLocation.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    )
    .populate('branchDetails', 'name');

    // Check if cash location exists
    if (!updatedCashLocation) {
      return next(new AppError('No cash location found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        cashLocation: updatedCashLocation
      }
    });
  } catch (err) {
    logger.error(`Error updating cash location status: ${err.message}`);
    next(err);
  }
};

// Delete a cash location
exports.deleteCashLocation = async (req, res, next) => {
  try {
    const cashLocation = await CashLocation.findByIdAndDelete(req.params.id);

    // Check if cash location exists
    if (!cashLocation) {
      return next(new AppError('No cash location found with that ID', 404));
    }

    // Return success response (no content)
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting cash location: ${err.message}`);
    next(err);
  }
};