const Accessory = require('../models/Accessory');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

exports.createAccessory = async (req, res, next) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, 
      applicable_models, 
      part_number, 
      part_number_status, 
      status 
    } = req.body;

    // Validate required fields
    if (!name || !price || !applicable_models || !part_number || !category) {
      return next(new AppError('Name, price, applicable models, part number and category are required', 400));
    }

    // Validate applicable_models is an array with at least one item
    if (!Array.isArray(applicable_models) || applicable_models.length === 0) {
      return next(new AppError('At least one applicable model is required', 400));
    }

    // Create accessory
    const accessory = await Accessory.create({
      name,
      description: description || '',
      price,
      category,
      applicable_models,
      part_number,
      part_number_status: part_number_status || 'active',
      status: status || 'active',
      createdBy: req.user.id
    });

    res.status(201).json({
      status: 'success',
      data: {
        accessory
      }
    });
  } catch (err) {
    logger.error(`Error creating accessory: ${err.message}`);
    next(err);
  }
};

exports.getAllAccessories = async (req, res, next) => {
  try {
    // Build query based on filters
    const filter = {};
    
    // Filter by status if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    
    // Filter by part number status if provided
    if (req.query.part_number_status && ['active', 'inactive'].includes(req.query.part_number_status.toLowerCase())) {
      filter.part_number_status = req.query.part_number_status.toLowerCase();
    }
    
    // Filter by model if provided
    if (req.query.model_id) {
      filter.applicable_models = req.query.model_id;
    }

    // Filter by category if provided
    if (req.query.category_id) {
      filter.category = req.query.category_id;
    }

    // Filter by price range if provided
    if (req.query.min_price) {
      filter.price = { $gte: Number(req.query.min_price) };
    }
    if (req.query.max_price) {
      filter.price = filter.price || {};
      filter.price.$lte = Number(req.query.max_price);
    }

    // Execute query with population
    const accessories = await Accessory.find(filter)
      .populate({
        path: 'applicableModelsDetails',
        select: 'model_name type status',
        match: { status: 'active' } // Only include active models
      })
      .populate('categoryDetails', 'name description status')
      .populate('createdByDetails', 'name email');

    res.status(200).json({
      status: 'success',
      results: accessories.length,
      data: {
        accessories
      }
    });
  } catch (err) {
    logger.error(`Error getting accessories: ${err.message}`);
    next(err);
  }
};

exports.getAccessoryById = async (req, res, next) => {
  try {
    const accessory = await Accessory.findById(req.params.id)
      .populate('applicableModelsDetails', 'model_name type')
      .populate('categoryDetails', 'name description')
      .populate('createdByDetails', 'name email');

    if (!accessory) {
      return next(new AppError('No accessory found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        accessory
      }
    });
  } catch (err) {
    logger.error(`Error getting accessory: ${err.message}`);
    next(err);
  }
};

exports.updateAccessory = async (req, res, next) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, 
      applicable_models, 
      part_number, 
      part_number_status, 
      status 
    } = req.body;

    const updatedAccessory = await Accessory.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        category,
        applicable_models,
        part_number,
        part_number_status,
        status
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('applicableModelsDetails', 'model_name type')
    .populate('categoryDetails', 'name description');

    if (!updatedAccessory) {
      return next(new AppError('No accessory found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        accessory: updatedAccessory
      }
    });
  } catch (err) {
    logger.error(`Error updating accessory: ${err.message}`);
    next(err);
  }
};

exports.updateAccessoryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    const updatedAccessory = await Accessory.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedAccessory) {
      return next(new AppError('No accessory found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        accessory: updatedAccessory
      }
    });
  } catch (err) {
    logger.error(`Error updating accessory status: ${err.message}`);
    next(err);
  }
};

exports.updatePartNumberStatus = async (req, res, next) => {
  try {
    const { part_number_status } = req.body;

    if (!part_number_status || !['active', 'inactive'].includes(part_number_status.toLowerCase())) {
      return next(new AppError('Part number status must be either "active" or "inactive"', 400));
    }

    const updatedAccessory = await Accessory.findByIdAndUpdate(
      req.params.id,
      { part_number_status: part_number_status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedAccessory) {
      return next(new AppError('No accessory found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        accessory: updatedAccessory
      }
    });
  } catch (err) {
    logger.error(`Error updating part number status: ${err.message}`);
    next(err);
  }
};

exports.deleteAccessory = async (req, res, next) => {
  try {
    const accessory = await Accessory.findByIdAndDelete(req.params.id);

    if (!accessory) {
      return next(new AppError('No accessory found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting accessory: ${err.message}`);
    next(err);
  }
};

exports.getAccessoriesByModel = async (req, res, next) => {
  try {
    if (!req.params.modelId) {
      return next(new AppError('Model ID is required', 400));
    }

    const accessories = await Accessory.find({
      applicable_models: req.params.modelId,
      status: 'active',
      part_number_status: 'active'
    })
    .populate('applicableModelsDetails', 'model_name type')
    .populate('categoryDetails', 'name description');

    res.status(200).json({
      status: 'success',
      results: accessories.length,
      data: {
        accessories
      }
    });
  } catch (err) {
    logger.error(`Error getting accessories by model: ${err.message}`);
    next(err);
  }
};