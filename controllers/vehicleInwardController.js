const Vehicle = require('../models/vehicleInwardModel');
const Model = require('../models/ModelModel');
const Color = require('../models/Color');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Helper function to validate vehicle type specific fields
const validateVehicleFields = (type, body) => {
  const errors = [];
  
  if (type === 'EV') {
    if (!body.batteryNumber) errors.push('Battery number is required for EV');
    if (!body.motorNumber) errors.push('Motor number is required for EV');
    if (!body.chargerNumber) errors.push('Charger number is required for EV');
  } else if (type === 'ICE') {
    if (!body.engineNumber) errors.push('Engine number is required for ICE');
  }
  
  return errors;
};

// Standard population options
const populateOptions = [
  {
    path: 'modelDetails',
    select: 'model_name type status prices colors createdAt'
  },
  {
    path: 'locationDetails',
    select: 'name address city state'
  },
  {
    path: 'colorDetails',
    select: 'name hex_code status models createdAt'
  },
  {
    path: 'addedByDetails',
    select: 'name email'
  }
];

// Create a new vehicle
exports.createVehicle = async (req, res, next) => {
  try {
    const { model, unloadLocation, type, colors, chassisNumber, hasDamage, damages } = req.body;
    
    // Basic validation
    if (!model || !unloadLocation || !type || !colors || !chassisNumber) {
      return next(new AppError('Model, unload location, type, colors, and chassis number are required', 400));
    }
    
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(model) || 
        !mongoose.Types.ObjectId.isValid(unloadLocation) ||
        colors.some(color => !mongoose.Types.ObjectId.isValid(color))) {
      return next(new AppError('Invalid ID format', 400));
    }
    
    // Validate vehicle type specific fields
    const fieldErrors = validateVehicleFields(type, req.body);
    if (fieldErrors.length > 0) {
      return next(new AppError(fieldErrors.join(', '), 400));
    }
    
    // Create the vehicle
    const newVehicle = await Vehicle.create({
      ...req.body,
      addedBy: req.user.id
    });
    
    // Generate QR code data URL
    const qrCodeData = {
      model: newVehicle.modelDetails?.model_name || 'Unknown Model',
      chassisNumber: newVehicle.chassisNumber,
      colors: newVehicle.colors,
      location: newVehicle.locationDetails?.name || 'Unknown Location',
      status: newVehicle.status,
      qrCode: newVehicle.qrCode
    };
    
    const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrCodeData));
    
    // Update vehicle with QR code URL
    const vehicleWithQr = await Vehicle.findByIdAndUpdate(
      newVehicle._id,
      { qrCodeImage: qrCodeUrl },
      { new: true }
    ).populate(populateOptions);
    
    res.status(201).json({
      status: 'success',
      data: {
        vehicle: vehicleWithQr
      }
    });
  } catch (err) {
    logger.error(`Error creating vehicle: ${err.message}`);
    next(err);
  }
};

// Get all vehicles with filtering options
exports.getAllVehicles = async (req, res, next) => {
  try {
    const { type, status, model, location, color, hasDamage } = req.query;
    
    let query = Vehicle.find();
    
    // Apply filters if provided
    if (type && ['EV', 'ICE'].includes(type.toUpperCase())) {
      query = query.where('type').equals(type.toUpperCase());
    }
    
    if (status) {
      query = query.where('status').equals(status.toLowerCase());
    }
    
    if (model && mongoose.Types.ObjectId.isValid(model)) {
      query = query.where('model').equals(model);
    }
    
    if (location && mongoose.Types.ObjectId.isValid(location)) {
      query = query.where('unloadLocation').equals(location);
    }
    
    if (color && mongoose.Types.ObjectId.isValid(color)) {
      query = query.where('colors').equals(color);
    }
    
    if (hasDamage === 'true') {
      query = query.where('hasDamage').equals(true);
    } else if (hasDamage === 'false') {
      query = query.where('hasDamage').equals(false);
    }
    
    // Apply consistent population
    query = query.populate(populateOptions);
    
    const vehicles = await query;
    
    res.status(200).json({
      status: 'success',
      results: vehicles.length,
      data: {
        vehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicles: ${err.message}`);
    next(err);
  }
};

// Get a single vehicle by ID
exports.getVehicleById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }
    
    const vehicle = await Vehicle.findById(req.params.vehicleId)
      .populate(populateOptions);
    
    if (!vehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicle by ID: ${err.message}`);
    next(err);
  }
};

// Get vehicle by QR code
exports.getVehicleByQrCode = async (req, res, next) => {
  try {
    const { qrCode } = req.params;
    
    const vehicle = await Vehicle.findOne({ qrCode })
      .populate(populateOptions);
    
    if (!vehicle) {
      return next(new AppError('No vehicle found with that QR code', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicle by QR code: ${err.message}`);
    next(err);
  }
};

// Update vehicle status
exports.updateVehicleStatus = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }
    
    if (!status || !['in_stock', 'in_transit', 'sold', 'service', 'damaged'].includes(status)) {
      return next(new AppError('Valid status is required', 400));
    }
    
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { status },
      { new: true, runValidators: true }
    ).populate(populateOptions);
    
    if (!updatedVehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: updatedVehicle
      }
    });
  } catch (err) {
    logger.error(`Error updating vehicle status: ${err.message}`);
    next(err);
  }
};

// Add damage to vehicle
exports.addDamage = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { description, images } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }
    
    if (!description || !images || images.length === 0) {
      return next(new AppError('Damage description and at least one image are required', 400));
    }
    
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { 
        $push: { damages: { description, images } },
        $set: { hasDamage: true, status: 'damaged' }
      },
      { new: true, runValidators: true }
    ).populate(populateOptions);
    
    if (!updatedVehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: updatedVehicle
      }
    });
  } catch (err) {
    logger.error(`Error adding damage to vehicle: ${err.message}`);
    next(err);
  }
};

// Generate QR code for existing vehicle
exports.generateQrCode = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }
    
    const vehicle = await Vehicle.findById(vehicleId)
      .populate(populateOptions);
    
    if (!vehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }
    
    // Generate QR code data URL
    const qrCodeData = {
      model: vehicle.modelDetails?.model_name || 'Unknown Model',
      chassisNumber: vehicle.chassisNumber,
      colors: vehicle.colors,
      location: vehicle.locationDetails?.name || 'Unknown Location',
      status: vehicle.status,
      qrCode: vehicle.qrCode
    };
    
    const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrCodeData));
    
    // Update vehicle with QR code URL
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { qrCodeImage: qrCodeUrl },
      { new: true }
    ).populate(populateOptions);
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: updatedVehicle,
        qrCodeUrl
      }
    });
  } catch (err) {
    logger.error(`Error generating QR code: ${err.message}`);
    next(err);
  }
};

// Get vehicles by branch
exports.getVehiclesByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    // Find vehicles by unloadLocation (branch)
    const vehicles = await Vehicle.find({ unloadLocation: branchId })
      .populate(populateOptions);

    res.status(200).json({
      status: 'success',
      results: vehicles.length,
      data: {
        vehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicles by branch: ${err.message}`);
    next(err);
  }
};