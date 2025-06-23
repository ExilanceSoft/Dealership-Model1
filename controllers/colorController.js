const Color = require('../models/Color');
const Model = require('../models/Model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Create a new color
// @route   POST /api/v1/colors
// @access  Private/Admin
exports.createColor = asyncHandler(async (req, res, next) => {
  const { name, hexCode, models = [] } = req.body;

  // Validate models if provided
  if (models.length > 0) {
    const existingModels = await Model.find({ 
      _id: { $in: models } 
    }).select('_id');
    
    if (existingModels.length !== models.length) {
      const existingModelIds = existingModels.map(m => m._id.toString());
      const missingModels = models.filter(
        modelId => !existingModelIds.includes(modelId.toString())
      );
      return next(new ErrorResponse(
        `The following model IDs were not found: ${missingModels.join(', ')}`, 
        404
      ));
    }
  }

  const color = await Color.create({
    name,
    hexCode,
    models,
    createdBy: req.user.id
  });

  const populatedColor = await Color.findById(color._id)
    .populate('modelDetails')
    .populate('createdByDetails');

  res.status(201).json({
    success: true,
    data: populatedColor
  });
});

// @desc    Get all colors
// @route   GET /api/v1/colors
// @access  Private
exports.getColors = asyncHandler(async (req, res, next) => {
  const { active = 'true' } = req.query;
  const query = {};

  if (active === 'true') query.isActive = true;
  if (active === 'false') query.isActive = false;

  const colors = await Color.find(query)
    .populate('modelDetails')
    .populate('createdByDetails');

  res.status(200).json({
    success: true,
    count: colors.length,
    data: colors
  });
});

// @desc    Get single color
// @route   GET /api/v1/colors/:id
// @access  Private
exports.getColor = asyncHandler(async (req, res, next) => {
  const color = await Color.findById(req.params.id)
    .populate('modelDetails')
    .populate('createdByDetails');

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: color
  });
});

// @desc    Update color
// @route   PUT /api/v1/colors/:id
// @access  Private/Admin
exports.updateColor = asyncHandler(async (req, res, next) => {
  const { models = [] } = req.body;

  // Validate models if provided
  if (models.length > 0) {
    const existingModels = await Model.find({ 
      _id: { $in: models } 
    }).select('_id');
    
    if (existingModels.length !== models.length) {
      const existingModelIds = existingModels.map(m => m._id.toString());
      const missingModels = models.filter(
        modelId => !existingModelIds.includes(modelId.toString())
      );
      return next(new ErrorResponse(
        `The following model IDs were not found: ${missingModels.join(', ')}`, 
        404
      ));
    }
  }

  const color = await Color.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    {
      new: true,
      runValidators: true
    }
  )
    .populate('modelDetails')
    .populate('createdByDetails');

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: color
  });
});

// @desc    Delete color (soft delete)
// @route   DELETE /api/v1/colors/:id
// @access  Private/Admin
exports.deleteColor = asyncHandler(async (req, res, next) => {
  const color = await Color.findById(req.params.id);

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  color.isActive = false;
  await color.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Assign color to models
// @route   POST /api/v1/colors/:id/assign
// @access  Private/Admin
exports.assignColorToModels = asyncHandler(async (req, res, next) => {
  const { modelIds = [] } = req.body;

  if (!Array.isArray(modelIds)) {
    return next(new ErrorResponse('Please provide an array of model IDs', 400));
  }

  if (modelIds.length === 0) {
    return next(new ErrorResponse('Please provide at least one model ID', 400));
  }

  const existingModels = await Model.find({ 
    _id: { $in: modelIds } 
  }).select('_id');
  
  if (existingModels.length !== modelIds.length) {
    const existingModelIds = existingModels.map(m => m._id.toString());
    const missingModels = modelIds.filter(
      modelId => !existingModelIds.includes(modelId.toString())
    );
    return next(new ErrorResponse(
      `The following model IDs were not found: ${missingModels.join(', ')}`, 
      404
    ));
  }

  const color = await Color.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { models: { $each: modelIds } } },
    { new: true, runValidators: true }
  )
    .populate('modelDetails')
    .populate('createdByDetails');

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: color
  });
});

// @desc    Remove color from models
// @route   POST /api/v1/colors/:id/remove
// @access  Private/Admin
exports.removeColorFromModels = asyncHandler(async (req, res, next) => {
  const { modelIds = [] } = req.body;

  if (!Array.isArray(modelIds)) {
    return next(new ErrorResponse('Please provide an array of model IDs', 400));
  }

  if (modelIds.length === 0) {
    return next(new ErrorResponse('Please provide at least one model ID', 400));
  }

  const color = await Color.findByIdAndUpdate(
    req.params.id,
    { $pull: { models: { $in: modelIds } } },
    { new: true, runValidators: true }
  )
    .populate('modelDetails')
    .populate('createdByDetails');

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: color
  });
});

// @desc    Get colors by model
// @route   GET /api/v1/colors/model/:modelId
// @access  Private
exports.getColorsByModel = asyncHandler(async (req, res, next) => {
  const model = await Model.findById(req.params.modelId).select('_id');

  if (!model) {
    return next(
      new ErrorResponse(`Model not found with id of ${req.params.modelId}`, 404)
    );
  }

  const colors = await Color.find({ 
    models: req.params.modelId, 
    isActive: true 
  });

  res.status(200).json({
    success: true,
    count: colors.length,
    data: colors
  });
});

// @desc    Toggle color status
// @route   PATCH /api/v1/colors/:id/status
// @access  Private/Admin
exports.toggleColorStatus = asyncHandler(async (req, res, next) => {
  const color = await Color.findById(req.params.id);

  if (!color) {
    return next(
      new ErrorResponse(`Color not found with id of ${req.params.id}`, 404)
    );
  }

  color.isActive = !color.isActive;
  await color.save();

  const populatedColor = await Color.findById(color._id)
    .populate('modelDetails')
    .populate('createdByDetails');

  res.status(200).json({
    success: true,
    data: populatedColor
  });
});