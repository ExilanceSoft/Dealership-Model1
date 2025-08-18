const Subdealer = require('../models/Subdealer');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Create a new subdealer
exports.createSubdealer = async (req, res, next) => {
  try {
    const { name, location, rateOfInterest, type, discount } = req.body;

    // Validate input
    if (!name) return next(new AppError('Subdealer name is required', 400));
    if (!location) return next(new AppError('Location is required', 400));
    if (!rateOfInterest) return next(new AppError('Rate of interest is required', 400));
    if (!type) return next(new AppError('Type is required', 400));

    // Create new subdealer
    const subdealer = await Subdealer.create({
      name,
      location,
      rateOfInterest,
      type,
      discount: discount || 0,
      createdBy: req.user.id
    });

    // Populate creator details in the response
    const populatedSubdealer = await Subdealer.findById(subdealer._id)
      .populate('createdByDetails', 'name email');

    res.status(201).json({
      status: 'success',
      data: {
        subdealer: populatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error creating subdealer: ${err.message}`);
    next(err);
  }
};

// Get all subdealers (with optional filtering)
exports.getAllSubdealers = async (req, res, next) => {
  try {
    const filter = {};
    
    // Add type filter if provided
    if (req.query.type && ['B2B', 'B2C'].includes(req.query.type.toUpperCase())) {
      filter.type = req.query.type.toUpperCase();
    }
    
    // Add status filter if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    
    // Add search filter if provided
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Query subdealers with filters
    const subdealers = await Subdealer.find(filter)
      .populate('createdByDetails', 'name email')
      .sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: subdealers.length,
      data: {
        subdealers
      }
    });
  } catch (err) {
    logger.error(`Error getting subdealers: ${err.message}`);
    next(err);
  }
};

// Get single subdealer by ID
exports.getSubdealerById = async (req, res, next) => {
  try {
    const subdealer = await Subdealer.findById(req.params.id)
      .populate('createdByDetails', 'name email');

    if (!subdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer
      }
    });
  } catch (err) {
    logger.error(`Error getting subdealer: ${err.message}`);
    next(err);
  }
};

// Update a subdealer
exports.updateSubdealer = async (req, res, next) => {
  try {
    const { name, location, rateOfInterest, type, discount, status } = req.body;

    const updatedSubdealer = await Subdealer.findByIdAndUpdate(
      req.params.id,
      {
        name,
        location,
        rateOfInterest,
        type,
        discount,
        status
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('createdByDetails', 'name email');

    if (!updatedSubdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer: updatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error updating subdealer: ${err.message}`);
    next(err);
  }
};

// Update subdealer status only
exports.updateSubdealerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    const updatedSubdealer = await Subdealer.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedSubdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer: updatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error updating subdealer status: ${err.message}`);
    next(err);
  }
};

// Delete a subdealer
exports.deleteSubdealer = async (req, res, next) => {
  try {
    const subdealer = await Subdealer.findByIdAndDelete(req.params.id);

    if (!subdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting subdealer: ${err.message}`);
    next(err);
  }
};