const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');

// modelController.js
exports.createModel = async (req, res, next) => {
  try {
    const { model_name, type, prices = [], model_discount = 0 } = req.body;
    
    // Validate inputs
    if (!model_name || typeof model_name !== 'string') {
      return next(new AppError('Model name is required and must be a string', 400));
    }
    if (!type || !['EV', 'ICE', 'CSD'].includes(type.toUpperCase())) {
      return next(new AppError('Type is required and must be EV, ICE, or CSD', 400));
    }
    if (model_discount < 0) {
      return next(new AppError('Model discount cannot be negative', 400));
    }
    
    // Validate prices if they exist
    if (prices && prices.length > 0) {
      if (prices.some(price => price.branch_id && price.subdealer_id)) {
        return next(new AppError('Price cannot have both branch_id and subdealer_id', 400));
      }
      if (prices.some(price => !price.branch_id && !price.subdealer_id)) {
        return next(new AppError('Price must have either branch_id or subdealer_id', 400));
      }
    }
    
    // Check for existing model
    const existingModel = await Model.findOne({ model_name });
    if (existingModel) {
      return next(new AppError('Model with this name already exists', 400));
    }
    
    // Create new model (prices can be empty)
    const newModel = await Model.create({
      model_name,
      type: type.toUpperCase(),
      prices,
      model_discount,
      created_by: req.user.id
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        model: newModel
      }
    });
  } catch (err) {
    logger.error(`Error creating model: ${err.message}`);
    next(err);
  }
};
exports.getModelById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }
    const model = await Model.findById(req.params.modelId)
      .populate({
        path: 'prices.header_id prices.branch_id',
        select: 'header_key category_key priority metadata name city is_mandatory is_discount' // Added is_mandatory and is_discount here
      });
    
    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }
    
    // Transform the data for better client-side consumption
    const transformedData = {
      _id: model._id,
      model_name: model.model_name,
      prices: model.prices.map(price => ({
        value: price.value,
        header_id: price.header_id?._id || null,
        header_key: price.header_id?.header_key || null,
        category_key: price.header_id?.category_key || null,
        priority: price.header_id?.priority || null,
        is_mandatory: price.header_id?.is_mandatory || false, // Added is_mandatory with default false
        is_discount: price.header_id?.is_discount || false,   // Added is_discount with default false
        metadata: price.header_id?.metadata || {},
        branch_id: price.branch_id?._id || null,
        branch_name: price.branch_id?.name || null,
        branch_city: price.branch_id?.city || null
      })),
      createdAt: model.createdAt
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        model: transformedData
      }
    });
  } catch (err) {
    logger.error(`Error getting model by ID: ${err.message}`);
    next(err);
  }
};
exports.getModelPrices = async (req, res, next) => {
  try {
    const model = await Model.findById(req.params.modelId)
      .populate('prices.header_id', 'header_key category_key priority metadata');

    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }
    res.status(200).json({
      status: 'success',
      data: {
        model
      }
    });
  } catch (err) {
    logger.error(`Error getting model prices: ${err.message}`);
    next(err);
  }
};
const validateObjectIds = (ids) => {
  return ids.every(id => mongoose.Types.ObjectId.isValid(id));
};
exports.updateModelPrices = async (req, res, next) => {
  try {
    const { prices = [], model_discount } = req.body;
    const { modelId } = req.params;

    // Validate inputs
    if (!Array.isArray(prices)) {
      return next(new AppError('Prices must be an array', 400));
    }
    if (model_discount !== undefined && model_discount < 0) {
      return next(new AppError('Discount cannot be negative', 400));
    }

    // Validate price references if prices exist
    if (prices.length > 0) {
      for (const price of prices) {
        if (price.branch_id && price.subdealer_id) {
          return next(new AppError('Price cannot have both branch_id and subdealer_id', 400));
        }
        if (!price.branch_id && !price.subdealer_id) {
          return next(new AppError('Price must have either branch_id or subdealer_id', 400));
        }
      }
    }

    // Verify model exists
    const model = await Model.findById(modelId);
    if (!model) {
      return next(new AppError('Model not found', 404));
    }

    // Update model (prices can be empty array)
    const updatedModel = await Model.findByIdAndUpdate(
      modelId,
      {
        prices,
        ...(model_discount !== undefined && { model_discount }),
        updated_by: req.user.id
      },
      { new: true, runValidators: true }
    )
    .populate({
      path: 'prices.header_id',
      select: 'header_key category_key'
    })
    .populate({
      path: 'prices.branch_id',
      select: 'name city'
    })
    .populate({
      path: 'prices.subdealer_id',
      select: 'name location'
    });

    // Format response
    const response = {
      status: 'success',
      data: {
        model: {
          id: updatedModel._id,
          model_name: updatedModel.model_name,
          type: updatedModel.type,
          status: updatedModel.status,
          model_discount: updatedModel.model_discount,
          prices: updatedModel.prices.map(p => ({
            value: p.value,
            header_id: p.header_id?._id || p.header_id,
            header_key: p.header_id?.header_key,
            branch_id: p.branch_id?._id || p.branch_id,
            branch_name: p.branch_id?.name,
            subdealer_id: p.subdealer_id?._id || p.subdealer_id,
            subdealer_name: p.subdealer_id?.name
          })),
          createdAt: updatedModel.createdAt
        }
      }
    };

    res.status(200).json(response);
  } catch (err) {
    logger.error(`Price update failed: ${err.message}`);
    next(err);
  }
};
exports.updateModel = async (req, res, next) => {
  try {
    // Validate discount if provided
    if (req.body.model_discount !== undefined && req.body.model_discount < 0) {
      return next(new AppError('Model discount cannot be negative', 400));
    }
    
    const model = await Model.findByIdAndUpdate(
      req.params.modelId,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        model
      }
    });
  } catch (err) {
    logger.error(`Error updating model: ${err.message}`);
    next(err);
  }
};


exports.deleteModel = async (req, res, next) => {
  try {
    const model = await Model.findByIdAndDelete(req.params.modelId);

    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting model: ${err.message}`);
    next(err);
  }
};
//get active models
exports.getAllModels = async (req, res, next) => {
  try {
    // Get customer type from query params (if provided)
    const { customerType } = req.query;
    
    // Build the base query for active models
    let query = Model.find({ status: 'active' });

    // Filter by customer type if provided
    if (customerType) {
      if (customerType === 'CSD') {
        query = query.where('type').equals('CSD');
      } else if (['B2B', 'B2C'].includes(customerType)) {
        query = query.where('type').in(['EV', 'ICE']);
      }
    }

    // For non-admin users, filter by their branch
    if (req.user) {
      const isAdmin = req.user.roles.some(role => 
        ['SUPERADMIN', 'ADMIN'].includes(role.name)
      );
      if (!isAdmin && req.user.branch) {
        query = query.where('prices.branch_id').equals(req.user.branch);
      }
    }

    // Execute the query with population
    const models = await query
      .populate({
        path: 'prices.header_id prices.branch_id',
        select: 'header_key category_key priority metadata name city'
      });

    // Transform the data
    const transformedModels = models.map(model => ({
      _id: model._id,
      model_name: model.model_name,
      prices: model.prices.map(price => ({
        value: price.value,
        header_id: price.header_id?._id || null,
        branch_id: price.branch_id?._id || null,
        header_key: price.header_id?.header_key || null,
        branch_name: price.branch_id?.name || null
      })),
      createdAt: model.createdAt,
      type: model.type,
      status: model.status
    }));

    res.status(200).json({
      status: 'success',
      results: transformedModels.length,
      data: {
        models: transformedModels
      }
    });
  } catch (err) {
    logger.error(`Error getting models: ${err.message}`);
    next(err);
  }
};
//get all model with any status
exports.getAllModelsStatus = async (req, res, next) => {
  try {
    let query = Model.find();
    let filter = {};

    // Validate that not both branch_id and subdealer_id are provided
    if (req.query.branch_id && req.query.subdealer_id) {
      return next(new AppError('Cannot filter by both branch_id and subdealer_id simultaneously', 400));
    }

    // Apply branch filter if provided in query
    if (req.query.branch_id) {
      if (!mongoose.Types.ObjectId.isValid(req.query.branch_id)) {
        return next(new AppError('Invalid branch ID provided', 400));
      }
      filter = { 'prices.branch_id': req.query.branch_id };
    }
    // Apply subdealer filter if provided in query
    else if (req.query.subdealer_id) {
      if (!mongoose.Types.ObjectId.isValid(req.query.subdealer_id)) {
        return next(new AppError('Invalid subdealer ID provided', 400));
      }
      filter = { 'prices.subdealer_id': req.query.subdealer_id };
    }
    // For non-super admin users, apply their default filter
    else if (req.user && req.user.role_id?.name !== 'super_admin') {
      if (req.user.branch_id) {
        if (!mongoose.Types.ObjectId.isValid(req.user.branch_id)) {
          return next(new AppError('Invalid branch ID in user profile', 400));
        }
        filter = { 'prices.branch_id': req.user.branch_id };
      } else if (req.user.subdealer_id) {
        if (!mongoose.Types.ObjectId.isValid(req.user.subdealer_id)) {
          return next(new AppError('Invalid subdealer ID in user profile', 400));
        }
        filter = { 'prices.subdealer_id': req.user.subdealer_id };
      }
    }

    query = query.where(filter);

    const models = await query
      .populate({
        path: 'prices.header_id prices.branch_id prices.subdealer_id',
        select: 'header_key category_key priority metadata name city name location'
      })
      .lean();

    const transformedModels = models.map(model => ({
      _id: model._id,
      model_name: model.model_name,
      type: model.type,
      status: model.status,
      prices: model.prices.map(price => ({
        value: price.value,
        header_id: price.header_id?._id || null,
        header_key: price.header_id?.header_key || null,
        category_key: price.header_id?.category_key || null,
        branch_id: price.branch_id?._id || null,
        branch_name: price.branch_id?.name || null,
        branch_city: price.branch_id?.city || null,
        subdealer_id: price.subdealer_id?._id || null,
        subdealer_name: price.subdealer_id?.name || null,
        subdealer_location: price.subdealer_id?.location || null
      })),
      createdAt: model.createdAt
    }));

    res.status(200).json({
      status: 'success',
      results: transformedModels.length,
      data: {
        models: transformedModels
      }
    });
  } catch (err) {
    logger.error(`Error getting all models: ${err.message}`, { error: err });
    next(new AppError('Failed to retrieve models', 500));
  }
};
// Update getAllModelsWithPrices
exports.getAllModelsWithPrices = async (req, res, next) => {
  try {
    let query = Model.find();

    // Filter by branch_id if provided
    if (req.query.branch_id) {
      query = query.where('prices.branch_id').equals(req.query.branch_id);
    }

    // Filter by subdealer_id if provided
    if (req.query.subdealer_id) {
      query = query.where('prices.subdealer_id').equals(req.query.subdealer_id);
    }

    // Ensure only one of branch_id or subdealer_id is provided
    if (req.query.branch_id && req.query.subdealer_id) {
      return next(new AppError('Cannot filter by both branch_id and subdealer_id simultaneously', 400));
    }

    // Filter by status if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      query = query.where('status').equals(req.query.status.toLowerCase());
    }

    // Populate header, branch, and subdealer information
    const models = await query.populate({
      path: 'prices.header_id',
      select: 'header_key category_key type priority is_mandatory is_discount metadata createdAt'
    }).populate({
      path: 'prices.branch_id',
      select: 'name city'
    }).populate({
      path: 'prices.subdealer_id',
      select: 'name location type discount'
    }).lean();

    // Transform the data for cleaner response
    const transformedModels = models.map(model => {
      // Filter prices based on query parameters
      const filteredPrices = model.prices.filter(price => {
        if (req.query.branch_id) {
          return (
            (price.branch_id && price.branch_id._id.toString() === req.query.branch_id) ||
            (req.query.branch_id === 'null' && !price.branch_id)
          );
        }
        if (req.query.subdealer_id) {
          return (
            (price.subdealer_id && price.subdealer_id._id.toString() === req.query.subdealer_id) ||
            (req.query.subdealer_id === 'null' && !price.subdealer_id)
          );
        }
        return true;
      });

      return {
        _id: model._id,
        model_name: model.model_name,
        type: model.type,
        status: model.status || 'active',
        model_discount: model.model_discount || 0,
        prices: filteredPrices.map(price => ({
          value: price.value,
          header: price.header_id ? {
            _id: price.header_id._id,
            header_key: price.header_id.header_key,
            category_key: price.header_id.category_key,
            type: price.header_id.type,
            priority: price.header_id.priority,
            is_mandatory: price.header_id.is_mandatory,
            is_discount: price.header_id.is_discount,
            metadata: price.header_id.metadata || {},
            createdAt: price.header_id.createdAt
          } : null,
          branch: price.branch_id ? {
            _id: price.branch_id._id,
            name: price.branch_id.name,
            city: price.branch_id.city
          } : null,
          subdealer: price.subdealer_id ? {
            _id: price.subdealer_id._id,
            name: price.subdealer_id.name,
            location: price.subdealer_id.location,
            type: price.subdealer_id.type,
            discount: price.subdealer_id.discount
          } : null,
          created_at: price.created_at,
          updated_at: price.updated_at
        })),
        colors: model.colors || [],
        created_at: model.created_at,
        updated_at: model.updated_at
      };
    });

    res.status(200).json({
      status: 'success',
      results: transformedModels.length,
      data: {
        models: transformedModels
      }
    });
  } catch (err) {
    logger.error(`Error getting all models with prices: ${err.message}`, {
      stack: err.stack,
      request: req.query
    });
    next(new AppError('Failed to retrieve models. Please try again later.', 500));
  }
};
// Update getModelWithPrices for specific model
exports.getModelWithPrices = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }

    if (req.query.branch_id && !mongoose.Types.ObjectId.isValid(req.query.branch_id) && req.query.branch_id !== 'null') {
      return next(new AppError('Invalid branch ID format', 400));
    }

    const model = await Model.findById(req.params.modelId)
      .populate({
        path: 'prices.header_id prices.branch_id',
        select: 'header_key category_key priority metadata name city'
      });

    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }

    // Filter prices by branch if specified
    const filteredPrices = req.query.branch_id
      ? model.prices.filter(price => {
          const priceBranchId = price.branch_id?._id?.toString();
          return (
            (priceBranchId === req.query.branch_id) ||
            (req.query.branch_id === 'null' && !priceBranchId)
          );
        })
      : model.prices;

    const transformedData = {
      _id: model._id,
      model_name: model.model_name,
      type: model.type,
      status: model.status,
      model_discount: model.model_discount,
      prices: filteredPrices.map(price => ({
        value: price.value,
        header_id: price.header_id?._id || null,
        header_key: price.header_id?.header_key || null,
        category_key: price.header_id?.category_key || null,
        priority: price.header_id?.priority || null,
        is_mandatory: price.header_id?.is_mandatory || null,
        is_discount: price.header_id?.is_discount || null,
        metadata: price.header_id?.metadata || {},
        branch_id: price.branch_id?._id || null,
        branch_name: price.branch_id?.name || null,
        branch_city: price.branch_id?.city || null
      })),
      createdAt: model.createdAt
    };

    res.status(200).json({
      status: 'success',
      data: {
        model: transformedData
      }
    });
  } catch (err) {
    logger.error(`Error getting model with prices: ${err.message}`);
    next(err);
  }
};

exports.getModelDetails = async (req, res, next) => {
  try {
    const model = await Model.findById(req.params.modelId);

    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        model
      }
    });
  } catch (err) {
    logger.error(`Error getting model details: ${err.message}`);
    next(err);
  }
};

exports.cleanupModels = async (req, res, next) => {
    try {
      // Delete models with empty prices array
      const result = await Model.deleteMany({
        $or: [
          { prices: { $size: 0 } },
          { model_name: { $regex: /model_name/i } },
          { model_name: { $regex: /,/ } }
        ]
      });

      res.status(200).json({
        status: 'success',
        message: `Cleaned up ${result.deletedCount} malformed models`
      });
    } catch (err) {
      logger.error(`Error cleaning up models: ${err.message}`);
      next(err);
    }
  };

  // Add to existing modelController.js
exports.identifyBaseModels = async (req, res, next) => {
  try {
    // First get all headers to find the Ex-Showroom header
    const headers = await Header.find();
    const exShowroomHeader = headers.find(h =>
      h.header_key.toLowerCase().includes('ex-showroom') ||
      h.category_key.toLowerCase().includes('ex-showroom')
    );

    if (!exShowroomHeader) {
      return next(new AppError('Ex-Showroom price header not found', 404));
    }

    // Get all models with their prices
    const models = await Model.find()
      .populate('prices.header_id', 'header_key category_key');

    // Group models by series
    const seriesMap = new Map();

    models.forEach(model => {
      // Extract series name (first part of model name)
      const seriesMatch = model.model_name.match(/^([A-Za-z0-9]+)/);
      if (!seriesMatch) return;

      const seriesName = seriesMatch[1];
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, []);
      }

      // Find the Ex-Showroom price for this model
      const exShowroomPrice = model.prices.find(p =>
        p.header_id._id.equals(exShowroomHeader._id)
      );

      if (exShowroomPrice) {
        seriesMap.get(seriesName).push({
          model_id: model._id,
          model_name: model.model_name,
          price: exShowroomPrice.value
        });
      }
    });

    // Identify base model for each series (lowest price)
    const baseModels = [];
    for (const [series, models] of seriesMap) {
      if (models.length === 0) continue;

      // Sort by price ascending
      models.sort((a, b) => a.price - b.price);
      const baseModel = models[0];

      baseModels.push({
        series,
        base_model_id: baseModel.model_id,
        base_model_name: baseModel.model_name,
        base_price: baseModel.price,
        other_models: models.slice(1).map(m => ({
          model_id: m.model_id,
          model_name: m.model_name,
          price: m.price
        }))
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        baseModels
      }
    });
  } catch (err) {
    logger.error(`Error identifying base models: ${err.message}`);
    next(err);
  }
};

exports.getBaseModelForSelectedModels = async (req, res, next) => {
  try {
    const { modelIds } = req.body;

    if (!modelIds || !Array.isArray(modelIds)) {
      return next(new AppError('Please provide an array of model IDs', 400));
    }

    // First get all headers to find the Ex-Showroom header
    const headers = await Header.find();
    const exShowroomHeader = headers.find(h =>
      h.header_key.toLowerCase().includes('ex-showroom') ||
      h.category_key.toLowerCase().includes('ex-showroom')
    );

    if (!exShowroomHeader) {
      return next(new AppError('Ex-Showroom price header not found', 404));
    }

    // Get the selected models
    const selectedModels = await Model.find({
      _id: { $in: modelIds }
    }).populate('prices.header_id', 'header_key category_key');

    if (selectedModels.length !== modelIds.length) {
      return next(new AppError('One or more model IDs are invalid', 400));
    }

    // Group models by series
    const seriesMap = new Map();
    selectedModels.forEach(model => {
      const seriesMatch = model.model_name.match(/^([A-Za-z0-9]+)/);
      if (!seriesMatch) return;

      const seriesName = seriesMatch[1];
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, []);
      }

      const exShowroomPrice = model.prices.find(p =>
        p.header_id._id.equals(exShowroomHeader._id)
      );

      if (exShowroomPrice) {
        seriesMap.get(seriesName).push({
          model_id: model._id,
          model_name: model.model_name,
          price: exShowroomPrice.value
        });
      }
    });

    // If all selected models are from the same series, find the base model
    if (seriesMap.size === 1) {
      const [series, models] = seriesMap.entries().next().value;
      models.sort((a, b) => a.price - b.price);
      const baseModel = models[0];

      return res.status(200).json({
        status: 'success',
        data: {
          base_model_id: baseModel.model_id,
          base_model_name: baseModel.model_name,
          base_price: baseModel.price,
          series,
          is_single_series: true
        }
      });
    }

    // If models from different series, return null (no base model)
    res.status(200).json({
      status: 'success',
      data: {
        base_model_id: null,
        base_model_name: null,
        base_price: null,
        is_single_series: false,
        message: 'Selected models are from different series'
      }
    });
  } catch (err) {
    logger.error(`Error getting base model for selected models: ${err.message}`);
    next(err);
  }
};

exports.updateModelStatus = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status is required and must be "active" or "inactive"', 400));
    }

    if (!mongoose.Types.ObjectId.isValid(modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }

    const updatedModel = await Model.findByIdAndUpdate(
      modelId,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true,
        select: '_id model_name status model_discount'
      }
    );

    if (!updatedModel) {
      return next(new AppError('No model found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        model: updatedModel
      }
    });
  } catch (err) {
    logger.error(`Error updating model status: ${err.message}`);
    next(err);
  }
};


// Add this to modelController.js
exports.getAllCSDModels = async (req, res, next) => {
  try {
    // Build the base query for CSD models
    let query = Model.find({ 
      type: 'CSD',
      status: 'active' // Optional: include if you want only active models
    });

    // For non-admin users, filter by their branch
    if (req.user) {
      const isAdmin = req.user.roles.some(role => 
        ['SUPERADMIN', 'ADMIN'].includes(role.name)
      );
      if (!isAdmin && req.user.branch) {
        query = query.where('prices.branch_id').equals(req.user.branch);
      }
    }

    // Execute the query with population
    const models = await query
      .populate({
        path: 'prices.header_id prices.branch_id',
        select: 'header_key category_key priority metadata name city'
      });

    // Transform the data
    const transformedModels = models.map(model => ({
      _id: model._id,
      model_name: model.model_name,
      prices: model.prices.map(price => ({
        value: price.value,
        header_id: price.header_id?._id || null,
        branch_id: price.branch_id?._id || null,
        header_key: price.header_id?.header_key || null,
        branch_name: price.branch_id?.name || null
      })),
      createdAt: model.createdAt,
      type: model.type,
      status: model.status
    }));

    res.status(200).json({
      status: 'success',
      results: transformedModels.length,
      data: {
        models: transformedModels
      }
    });
  } catch (err) {
    logger.error(`Error getting CSD models: ${err.message}`);
    next(err);
  }
};