const AccessoryCategory = require('../models/AccessoryCategory');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

exports.createAccessoryCategory = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    if (!name) {
      return next(new AppError('Name is required', 400));
    }

    const category = await AccessoryCategory.create({
      name,
      description: description || '',
      status: status || 'active',
      createdBy: req.user.id
    });

    res.status(201).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (err) {
    logger.error(`Error creating accessory category: ${err.message}`);
    next(err);
  }
};

exports.getAllAccessoryCategories = async (req, res, next) => {
  try {
    const filter = {};
    
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }

    const categories = await AccessoryCategory.find(filter)
      .populate('createdByDetails', 'name email');

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories
      }
    });
  } catch (err) {
    logger.error(`Error getting accessory categories: ${err.message}`);
    next(err);
  }
};

exports.getAccessoryCategoryById = async (req, res, next) => {
  try {
    const category = await AccessoryCategory.findById(req.params.id)
      .populate('createdByDetails', 'name email');

    if (!category) {
      return next(new AppError('No category found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (err) {
    logger.error(`Error getting accessory category: ${err.message}`);
    next(err);
  }
};

exports.updateAccessoryCategory = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const updatedCategory = await AccessoryCategory.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        status
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedCategory) {
      return next(new AppError('No category found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        category: updatedCategory
      }
    });
  } catch (err) {
    logger.error(`Error updating accessory category: ${err.message}`);
    next(err);
  }
};

exports.updateAccessoryCategoryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    const updatedCategory = await AccessoryCategory.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedCategory) {
      return next(new AppError('No category found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        category: updatedCategory
      }
    });
  } catch (err) {
    logger.error(`Error updating accessory category status: ${err.message}`);
    next(err);
  }
};

exports.deleteAccessoryCategory = async (req, res, next) => {
  try {
    const category = await AccessoryCategory.findByIdAndDelete(req.params.id);

    if (!category) {
      return next(new AppError('No category found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting accessory category: ${err.message}`);
    next(err);
  }
};