const Declaration = require('../models/Declaration');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Create a new declaration
exports.createDeclaration = async (req, res, next) => {
  try {
    const { title, content, formType, priority } = req.body;

    // Validate input
    if (!title) {
      return next(new AppError('Declaration title is required', 400));
    }
    if (!content) {
      return next(new AppError('Declaration content is required', 400));
    }
    if (!formType) {
      return next(new AppError('Form type is required', 400));
    }
    if (!priority || isNaN(priority) ){
      return next(new AppError('Valid priority number is required', 400));
    }

    // Create new declaration
    const declaration = await Declaration.create({
      title,
      content,
      formType,
      priority,
      createdBy: req.user.id
    });

    // Populate creator details in the response
    const populatedDeclaration = await Declaration.findById(declaration._id)
      .populate('createdByDetails', 'name email');

    // Return success response
    res.status(201).json({
      status: 'success',
      data: {
        declaration: populatedDeclaration
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return next(new AppError(err.message, 400));
    }
    logger.error(`Error creating declaration: ${err.message}`);
    next(err);
  }
};

// Get all declarations (with optional filtering)
exports.getAllDeclarations = async (req, res, next) => {
  try {
    const filter = {};
    
    // Add formType filter if provided
    if (req.query.formType) {
      filter.formType = req.query.formType;
    }
    
    // Add status filter if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    
    // Add search filter if provided
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Query declarations with filters
    const declarations = await Declaration.find(filter)
      .populate('createdByDetails', 'name email')
      .sort({ formType: 1, priority: 1 }); // Sort by formType then priority

    // Return success response
    res.status(200).json({
      status: 'success',
      results: declarations.length,
      data: {
        declarations
      }
    });
  } catch (err) {
    logger.error(`Error getting declarations: ${err.message}`);
    next(err);
  }
};

// Get single declaration by ID
exports.getDeclarationById = async (req, res, next) => {
  try {
    const declaration = await Declaration.findById(req.params.id)
      .populate('createdByDetails', 'name email');

    // Check if declaration exists
    if (!declaration) {
      return next(new AppError('No declaration found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        declaration
      }
    });
  } catch (err) {
    logger.error(`Error getting declaration: ${err.message}`);
    next(err);
  }
};

// Update a declaration
exports.updateDeclaration = async (req, res, next) => {
  try {
    const { title, content, formType, status, priority } = req.body;

    // Update declaration details
    const updatedDeclaration = await Declaration.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        formType,
        priority,
        status
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('createdByDetails', 'name email');

    // Check if declaration exists
    if (!updatedDeclaration) {
      return next(new AppError('No declaration found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        declaration: updatedDeclaration
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return next(new AppError(err.message, 400));
    }
    logger.error(`Error updating declaration: ${err.message}`);
    next(err);
  }
};

// Update declaration status only
exports.updateDeclarationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    // Update status
    const updatedDeclaration = await Declaration.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    // Check if declaration exists
    if (!updatedDeclaration) {
      return next(new AppError('No declaration found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        declaration: updatedDeclaration
      }
    });
  } catch (err) {
    logger.error(`Error updating declaration status: ${err.message}`);
    next(err);
  }
};

// Delete a declaration
exports.deleteDeclaration = async (req, res, next) => {
  try {
    const declaration = await Declaration.findByIdAndDelete(req.params.id);

    // Check if declaration exists
    if (!declaration) {
      return next(new AppError('No declaration found with that ID', 404));
    }

    // Return success response (no content)
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting declaration: ${err.message}`);
    next(err);
  }
};