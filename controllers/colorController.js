const Color = require('../models/Color');
const Model = require('../models/ModelModel');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');

// Create a new color
exports.createColor = async (req, res, next) => {
  try {
    const { name, hex_code } = req.body;

    // Validate input
    if (!name || typeof name !== 'string') {
      return next(new AppError('Color name is required and must be a string', 400));
    }
    if (!hex_code || typeof hex_code !== 'string') {
      return next(new AppError('Hex code is required and must be a string', 400));
    }

    // Check if color already exists
    const existingColor = await Color.findOne({ name });
    if (existingColor) {
      return next(new AppError('Color with this name already exists', 400));
    }

    const newColor = await Color.create({
      name,
      hex_code,
      models: req.body.models || []
    });

    // If models were provided, update them with this color
    if (req.body.models && req.body.models.length > 0) {
      await Model.updateMany(
        { _id: { $in: req.body.models } },
        { $addToSet: { colors: newColor._id } }
      );
    }

    res.status(201).json({
      status: 'success',
      data: {
        color: newColor
      }
    });
  } catch (err) {
    logger.error(`Error creating color: ${err.message}`);
    next(err);
  }
};

// Get all colors
exports.getAllColors = async (req, res, next) => {
  try {
    let query = Color.find();

    // Filter by status if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      query = query.where('status').equals(req.query.status.toLowerCase());
    }

    // Always populate model information with names
    query = query.populate({
      path: 'models',
      select: 'model_name type status',
      match: { status: 'active' } // Only include active models
    });

    const colors = await query;

    res.status(200).json({
      status: 'success',
      results: colors.length,
      data: {
        colors
      }
    });
  } catch (err) {
    logger.error(`Error getting colors: ${err.message}`);
    next(err);
  }
};

// Get a single color by ID
exports.getColorById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    const color = await Color.findById(req.params.colorId)
      .populate({
        path: 'models',
        select: 'model_name type status'
      });

    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        color
      }
    });
  } catch (err) {
    logger.error(`Error getting color by ID: ${err.message}`);
    next(err);
  }
};

// Update a color
// Update a color
exports.updateColor = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    const { name, hex_code, models } = req.body;
    const updateData = { name, hex_code };

    // If models are provided in the request
    if (models && Array.isArray(models)) {
      // Validate all model IDs
      if (!models.every(id => mongoose.Types.ObjectId.isValid(id))) {
        return next(new AppError('One or more model IDs are invalid', 400));
      }

      // Check if models exist
      const modelsCount = await Model.countDocuments({ _id: { $in: models } });
      if (modelsCount !== models.length) {
        return next(new AppError('One or more model IDs are invalid', 400));
      }

      // Get current models for the color
      const currentColor = await Color.findById(req.params.colorId);
      if (!currentColor) {
        return next(new AppError('No color found with that ID', 404));
      }

      const currentModels = currentColor.models.map(id => id.toString());
      const newModels = models.filter(id => !currentModels.includes(id));
      const removedModels = currentModels.filter(id => !models.includes(id));

      // Update models arrays
      if (newModels.length > 0) {
        await Model.updateMany(
          { _id: { $in: newModels } },
          { $addToSet: { colors: req.params.colorId } }
        );
      }

      if (removedModels.length > 0) {
        await Model.updateMany(
          { _id: { $in: removedModels } },
          { $pull: { colors: req.params.colorId } }
        );
      }

      updateData.models = models;
    }

    const updatedColor = await Color.findByIdAndUpdate(
      req.params.colorId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate({
      path: 'models',
      select: 'model_name type status'
    });

    if (!updatedColor) {
      return next(new AppError('No color found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        color: updatedColor
      }
    });
  } catch (err) {
    logger.error(`Error updating color: ${err.message}`);
    next(err);
  }
};

// Delete a color
exports.deleteColor = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    const color = await Color.findByIdAndDelete(req.params.colorId);

    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting color: ${err.message}`);
    next(err);
  }
};

// Assign color to models
exports.assignColorToModels = async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const { modelIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    if (!modelIds || !Array.isArray(modelIds)) {
      return next(new AppError('Please provide an array of model IDs', 400));
    }

    // Validate all model IDs
    if (!modelIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return next(new AppError('One or more model IDs are invalid', 400));
    }

    // Check if color exists
    const color = await Color.findById(colorId);
    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }

    // Check if models exist
    const modelsCount = await Model.countDocuments({ _id: { $in: modelIds } });
    if (modelsCount !== modelIds.length) {
      return next(new AppError('One or more model IDs are invalid', 400));
    }

    // Update color's models array
    const updatedColor = await Color.findByIdAndUpdate(
      colorId,
      { $addToSet: { models: { $each: modelIds } } },
      { new: true }
    );

    // Update models' colors array
    await Model.updateMany(
      { _id: { $in: modelIds } },
      { $addToSet: { colors: colorId } }
    );

    res.status(200).json({
      status: 'success',
      data: {
        color: updatedColor
      }
    });
  } catch (err) {
    logger.error(`Error assigning color to models: ${err.message}`);
    next(err);
  }
};

// Unassign color from models
exports.unassignColorFromModels = async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const { modelIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    if (!modelIds || !Array.isArray(modelIds)) {
      return next(new AppError('Please provide an array of model IDs', 400));
    }

    // Validate all model IDs
    if (!modelIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return next(new AppError('One or more model IDs are invalid', 400));
    }

    // Check if color exists
    const color = await Color.findById(colorId);
    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }

    // Update color's models array
    const updatedColor = await Color.findByIdAndUpdate(
      colorId,
      { $pull: { models: { $in: modelIds } } },
      { new: true }
    );

    // Update models' colors array
    await Model.updateMany(
      { _id: { $in: modelIds } },
      { $pull: { colors: colorId } }
    );

    res.status(200).json({
      status: 'success',
      data: {
        color: updatedColor
      }
    });
  } catch (err) {
    logger.error(`Error unassigning color from models: ${err.message}`);
    next(err);
  }
};

// Update color status
exports.updateColorStatus = async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status is required and must be either "active" or "inactive"', 400));
    }

    const updatedColor = await Color.findByIdAndUpdate(
      colorId,
      { status: status.toLowerCase() },
      { new: true }
    );

    if (!updatedColor) {
      return next(new AppError('No color found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        color: updatedColor
      }
    });
  } catch (err) {
    logger.error(`Error updating color status: ${err.message}`);
    next(err);
  }
};

// Get models for a specific color
exports.getColorModels = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    const color = await Color.findById(req.params.colorId)
      .populate({
        path: 'models',
        select: 'model_name type status prices'
      });

    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        models: color.models
      }
    });
  } catch (err) {
    logger.error(`Error getting color models: ${err.message}`);
    next(err);
  }
};

// Get colors by model ID
exports.getColorsByModelId = async (req, res, next) => {
  try {
    const { modelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }

    // Check if model exists
    const model = await Model.findById(modelId);
    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }

    // Get colors for this model
    const colors = await Color.find({ 
      _id: { $in: model.colors },
      status: 'active' // Only get active colors
    }).select('name hex_code');

    res.status(200).json({
      status: 'success',
      data: {
        colors
      }
    });
  } catch (err) {
    logger.error(`Error getting colors by model ID: ${err.message}`);
    next(err);
  }
};