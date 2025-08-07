const Offer = require('../models/OfferModel');
const Model = require('../models/ModelModel');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/offers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `offer-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
      cb(null, true);
    } else {
      cb(new AppError('Not an image! Please upload only images.', 400), false);
    }
  }
});

exports.uploadOfferImage = upload.single('image');

const validateObjectIds = (ids) => {
  return ids.every(id => mongoose.Types.ObjectId.isValid(id));
};

exports.createOffer = async (req, res, next) => {
  try {
    const isActive = req.body.isActive === 'true';
    const applyToAllModels = req.body.applyToAllModels === 'true';

    let applicableModels = [];
    if (req.body.applicableModels) {
      if (Array.isArray(req.body.applicableModels)) {
        applicableModels = req.body.applicableModels;
      } else if (typeof req.body.applicableModels === 'string' && 
                req.body.applicableModels.startsWith('[')) {
        try {
          applicableModels = JSON.parse(req.body.applicableModels);
        } catch (err) {
          return next(new AppError('Invalid format for applicableModels', 400));
        }
      } else {
        applicableModels = [req.body.applicableModels];
      }
    }

    if (!req.body.title || !req.body.description || !req.body.offerLanguage || !req.body.priority) {
      return next(new AppError('Title, description, language and priority are required', 400));
    }

    if (!['English', 'Marathi'].includes(req.body.offerLanguage)) {
      return next(new AppError('Language must be either English or Marathi', 400));
    }

    const priority = parseInt(req.body.priority);
    if (isNaN(priority) || priority < 1) {
      return next(new AppError('Priority must be a number and at least 1', 400));
    }

    if (!applyToAllModels) {
      if (!applicableModels || applicableModels.length === 0) {
        return next(new AppError('You must specify applicable models or select "apply to all"', 400));
      }

      if (!validateObjectIds(applicableModels)) {
        return next(new AppError('Invalid model IDs provided', 400));
      }

      const existingModels = await Model.countDocuments({ 
        _id: { $in: applicableModels } 
      });
      
      if (existingModels !== applicableModels.length) {
        return next(new AppError('One or more specified models do not exist', 404));
      }
    }

    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/offers/${req.file.filename}`;
    }

    const newOffer = await Offer.create({
      title: req.body.title,
      description: req.body.description,
      url: req.body.url,
      image: imagePath,
      isActive,
      applyToAllModels,
      applicableModels: applyToAllModels ? [] : applicableModels,
      offerLanguage: req.body.offerLanguage,
      priority: priority
    });

    res.status(201).json({
      status: 'success',
      data: {
        offer: newOffer
      }
    });
  } catch (err) {
    logger.error(`Error creating offer: ${err.message}`);
    next(err);
  }
};

exports.getAllOffers = async (req, res, next) => {
  try {
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(el => delete queryObj[el]);

    if (req.query.offerLanguage) {
      queryObj.offerLanguage = req.query.offerLanguage;
    }

    let query = Offer.find(queryObj);

    if (req.query.search) {
      query = query.find({
        $text: {
          $search: req.query.search
        }
      });
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-priority -createdAt');
    }

    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    }

    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    query = query.populate({
      path: 'applicableModels',
      select: 'model_name',
      model: 'Model'
    });

    const offers = await query;

    const formattedOffers = offers.map(offer => {
      const formattedOffer = {
        _id: offer._id,
        title: offer.title,
        description: offer.description,
        url: offer.url,
        image: offer.image,
        isActive: offer.isActive,
        applyToAllModels: offer.applyToAllModels,
        offerLanguage: offer.offerLanguage,
        priority: offer.priority,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        applicableModels: []
      };

      if (!offer.applyToAllModels && offer.applicableModels) {
        formattedOffer.applicableModels = offer.applicableModels.map(model => ({
          _id: model._id,
          model_name: model.model_name
        }));
      }

      return formattedOffer;
    });

    res.status(200).json({
      status: 'success',
      results: formattedOffers.length,
      data: {
        offers: formattedOffers
      }
    });
  } catch (err) {
    logger.error(`Error getting offers: ${err.message}`);
    next(err);
  }
};

exports.getOfferById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError('Invalid offer ID format', 400));
    }

    let query = Offer.findById(req.params.id);

    if (req.query.populate === 'true') {
      query = query.populate('applicableModels', 'model_name');
    }

    const offer = await query;

    if (!offer) {
      return next(new AppError('No offer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        offer
      }
    });
  } catch (err) {
    logger.error(`Error getting offer by ID: ${err.message}`);
    next(err);
  }
};

exports.updateOffer = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError('Invalid offer ID format', 400));
    }

    const existingOffer = await Offer.findById(req.params.id);
    if (!existingOffer) {
      return next(new AppError('No offer found with that ID', 404));
    }

    const isActive = req.body.isActive === 'true' || req.body.isActive === true;
    const applyToAllModels = req.body.applyToAllModels === 'true' || req.body.applyToAllModels === true;

    let applicableModels = existingOffer.applicableModels;
    if (req.body.applicableModels !== undefined) {
      if (Array.isArray(req.body.applicableModels)) {
        applicableModels = req.body.applicableModels;
      } else if (typeof req.body.applicableModels === 'string' && 
                req.body.applicableModels.startsWith('[')) {
        try {
          applicableModels = JSON.parse(req.body.applicableModels);
        } catch (err) {
          return next(new AppError('Invalid format for applicableModels', 400));
        }
      } else if (req.body.applicableModels) {
        applicableModels = [req.body.applicableModels];
      }
    }

    if (req.body.offerLanguage && !['English', 'Marathi'].includes(req.body.offerLanguage)) {
      return next(new AppError('Language must be either English or Marathi', 400));
    }

    let priority = existingOffer.priority;
    if (req.body.priority) {
      priority = parseInt(req.body.priority);
      if (isNaN(priority) || priority < 1) {
        return next(new AppError('Priority must be a number and at least 1', 400));
      }
    }

    if (!applyToAllModels) {
      if (!applicableModels || applicableModels.length === 0) {
        return next(new AppError('You must specify applicable models or select "apply to all"', 400));
      }

      if (!validateObjectIds(applicableModels)) {
        return next(new AppError('Invalid model IDs provided', 400));
      }

      const existingModels = await Model.countDocuments({ 
        _id: { $in: applicableModels } 
      });
      
      if (existingModels !== applicableModels.length) {
        return next(new AppError('One or more specified models do not exist', 404));
      }
    }

    let updateData = {
      title: req.body.title || existingOffer.title,
      description: req.body.description || existingOffer.description,
      url: req.body.url || existingOffer.url,
      isActive,
      applyToAllModels,
      applicableModels: applyToAllModels ? [] : applicableModels,
      offerLanguage: req.body.offerLanguage || existingOffer.offerLanguage,
      priority: priority,
      updatedAt: new Date()
    };

    if (req.file) {
      if (existingOffer.image) {
        const oldImagePath = path.join(__dirname, '../public', existingOffer.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = `/uploads/offers/${req.file.filename}`;
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('applicableModels', 'model_name');

    res.status(200).json({
      status: 'success',
      data: {
        offer: updatedOffer
      }
    });
  } catch (err) {
    logger.error(`Error updating offer: ${err.message}`);
    next(err);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError('Invalid offer ID format', 400));
    }

    const offer = await Offer.findById(req.params.id);
    
    if (!offer) {
      return next(new AppError('No offer found with that ID', 404));
    }

    if (offer.image) {
      const imagePath = path.join(__dirname, '../public', offer.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Offer.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting offer: ${err.message}`);
    next(err);
  }
};

exports.getOffersForModel = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }

    const modelExists = await Model.exists({ _id: req.params.modelId });
    if (!modelExists) {
      return next(new AppError('No model found with that ID', 404));
    }

    const offers = await Offer.find({
      isActive: true,
      $or: [
        { applyToAllModels: true },
        { applicableModels: req.params.modelId }
      ]
    }).select('title description createdAt language priority');

    res.status(200).json({
      status: 'success',
      results: offers.length,
      data: {
        offers
      }
    });
  } catch (err) {
    logger.error(`Error getting offers for model: ${err.message}`);
    next(err);
  }
};