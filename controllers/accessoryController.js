const Accessory = require('../models/Accessory');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Helper function to validate model-part number mapping
const validateModelPartNumbers = (applicableModels, modelPartNumbers) => {
  if (!applicableModels || !modelPartNumbers) return false;
  
  // Check all applicable models have corresponding part numbers
  const modelIds = applicableModels.map(id => id.toString());
  const partNumberModelIds = modelPartNumbers.map(item => item.model_id.toString());
  
  // Check all models are covered
  if (modelIds.length !== partNumberModelIds.length) return false;
  
  // Check all models in part numbers exist in applicable models
  return partNumberModelIds.every(id => modelIds.includes(id));
};

exports.createAccessory = async (req, res, next) => {
  try {
    const { name, description, price, applicable_models, model_part_numbers, status } = req.body;

    // Validate required fields
    if (!name || !price || !applicable_models || !model_part_numbers) {
      return next(new AppError('Name, price, applicable models and model part numbers are required', 400));
    }

    // Validate model-part number mapping
    if (!validateModelPartNumbers(applicable_models, model_part_numbers)) {
      return next(new AppError('Each applicable model must have a corresponding part number', 400));
    }

    // Create accessory
    const accessory = await Accessory.create({
      name,
      description: description || '',
      price,
      applicable_models,
      model_part_numbers,
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
    
    // Filter by model if provided
    if (req.query.model_id) {
      filter.applicable_models = req.query.model_id;
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
      .populate('applicableModelsDetails', 'model_name type')
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
    const { name, description, price, applicable_models, model_part_numbers, status } = req.body;

    // Validate model-part number mapping if applicable_models or model_part_numbers are being updated
    if (applicable_models || model_part_numbers) {
      const accessory = await Accessory.findById(req.params.id);
      const currentModels = applicable_models || accessory.applicable_models;
      const currentPartNumbers = model_part_numbers || accessory.model_part_numbers;
      
      if (!validateModelPartNumbers(currentModels, currentPartNumbers)) {
        return next(new AppError('Each applicable model must have a corresponding part number', 400));
      }
    }

    const updatedAccessory = await Accessory.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        applicable_models,
        model_part_numbers,
        status
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('applicableModelsDetails', 'model_name type');

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
      status: 'active'
    }).populate('applicableModelsDetails', 'model_name type');

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