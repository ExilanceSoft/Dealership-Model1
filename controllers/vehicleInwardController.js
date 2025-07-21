const Vehicle = require('../models/vehicleInwardModel');
const Model = require('../models/ModelModel');
const Color = require('../models/Color');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Enhanced population options with error handling
const populateOptions = [
  {
    path: 'model',
    model: 'Model',
    select: 'model_name type status prices colors createdAt',
    match: { _id: { $exists: true } } // Only populate if model exists
  },
  {
    path: 'unloadLocation',
    model: 'Branch',
    select: 'name address city state pincode phone email gst_number is_active',
    match: { _id: { $exists: true } } // Only populate if branch exists
  },
  {
    path: 'colors',
    model: 'Color',
    select: 'name hex_code status models createdAt',
    match: { _id: { $exists: true } } // Only populate if color exists
  },
  {
    path: 'addedBy',
    model: 'User',
    select: 'name email',
    match: { _id: { $exists: true } } // Only populate if user exists
  }
];

// Create a new vehicle
// Create a new vehicle
exports.createVehicle = async (req, res, next) => {
  try {
    const { model, unloadLocation, type, colors, chassisNumber } = req.body;
    
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

    // Validate referenced documents exist
    const [modelExists, branchExists, colorsExist] = await Promise.all([
      Model.exists({ _id: model }),
      Branch.exists({ _id: unloadLocation }),
      Color.countDocuments({ _id: { $in: colors } })
    ]);

    if (!modelExists) {
      return next(new AppError('Referenced model does not exist', 400));
    }

    if (!branchExists) {
      return next(new AppError('Referenced branch does not exist', 400));
    }

    if (colorsExist !== colors.length) {
      return next(new AppError('One or more referenced colors do not exist', 400));
    }

    // Check for existing vehicle with same chassis number
    const existingVehicle = await Vehicle.findOne({ chassisNumber });
    if (existingVehicle) {
      return next(new AppError(`Vehicle with chassis number ${chassisNumber} already exists`, 409));
    }
    
    // Create the vehicle
    const newVehicle = await Vehicle.create({
      ...req.body,
      addedBy: req.user.id
    });
    
    // Generate QR code data URL
    const vehicleWithRefs = await Vehicle.findById(newVehicle._id).populate(populateOptions);
    
    const qrCodeData = {
      model: vehicleWithRefs.model?.model_name || 'Unknown Model',
      chassisNumber: newVehicle.chassisNumber,
      colors: vehicleWithRefs.colors?.map(c => c.name) || [],
      location: vehicleWithRefs.unloadLocation?.name || 'Unknown Location',
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
    // Handle duplicate key error specifically
    if (err.code === 11000 && err.keyPattern?.chassisNumber) {
      const duplicateValue = err.keyValue?.chassisNumber;
      logger.error(`Duplicate chassis number error: ${duplicateValue}`);
      return next(new AppError(`Vehicle with chassis number ${duplicateValue} already exists`, 409));
    }
    
    logger.error(`Error creating vehicle: ${err.message}`);
    next(new AppError('Failed to create vehicle. Please try again.', 500));
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
    
    // Apply population with error handling
    query = query.populate(populateOptions);
    
    const vehicles = await query;
    
    // Transform the response to handle null references
    const transformedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      // Handle missing model
      if (!vehicleObj.model) {
        vehicleObj.model = {
          _id: vehicle.model, // Original ID
          model_name: 'Unknown Model',
          type: 'Unknown'
        };
      }
      
      // Handle missing location
      if (!vehicleObj.unloadLocation) {
        vehicleObj.unloadLocation = {
          _id: vehicle.unloadLocation, // Original ID
          name: 'Unknown Location'
        };
      }
      
      // Handle missing colors
      vehicleObj.colors = vehicleObj.colors.map(color => {
        return color || {
          _id: color, // Original ID
          name: 'Unknown Color',
          hex_code: '#CCCCCC'
        };
      });
      
      // Handle missing addedBy
      if (!vehicleObj.addedBy) {
        vehicleObj.addedBy = {
          _id: vehicle.addedBy, // Original ID
          name: 'Unknown User'
        };
      }
      
      return vehicleObj;
    });
    
    res.status(200).json({
      status: 'success',
      results: transformedVehicles.length,
      data: {
        vehicles: transformedVehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicles: ${err.message}`);
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: vehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: vehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: vehicleObj
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicle by ID: ${err.message}`);
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: vehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: vehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: vehicleObj
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicle by QR code: ${err.message}`);
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const vehicleObj = updatedVehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: updatedVehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: updatedVehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: updatedVehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: vehicleObj
      }
    });
  } catch (err) {
    logger.error(`Error updating vehicle status: ${err.message}`);
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const vehicleObj = updatedVehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: updatedVehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: updatedVehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: updatedVehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        vehicle: vehicleObj
      }
    });
  } catch (err) {
    logger.error(`Error adding damage to vehicle: ${err.message}`);
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: vehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: vehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    // Generate QR code data URL
    const qrCodeData = {
      model: vehicleObj.model.model_name,
      chassisNumber: vehicle.chassisNumber,
      colors: vehicleObj.colors.map(c => c.name),
      location: vehicleObj.unloadLocation.name,
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
    next(new AppError('Server Error', 500));
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

    // Transform the response to handle null references
    const transformedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      if (!vehicleObj.model) {
        vehicleObj.model = {
          _id: vehicle.model,
          model_name: 'Unknown Model',
          type: 'Unknown'
        };
      }
      
      if (!vehicleObj.unloadLocation) {
        vehicleObj.unloadLocation = {
          _id: vehicle.unloadLocation,
          name: 'Unknown Location'
        };
      }
      
      vehicleObj.colors = vehicleObj.colors.map(color => {
        return color || {
          _id: color,
          name: 'Unknown Color',
          hex_code: '#CCCCCC'
        };
      });
      
      if (!vehicleObj.addedBy) {
        vehicleObj.addedBy = {
          _id: vehicle.addedBy,
          name: 'Unknown User'
        };
      }
      
      return vehicleObj;
    });

    res.status(200).json({
      status: 'success',
      results: transformedVehicles.length,
      data: {
        vehicles: transformedVehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicles by branch: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

// Get vehicle by chassis number
exports.getVehicleByChassisNumber = async (req, res, next) => {
  try {
    const { chassisNumber } = req.params;

    if (!chassisNumber) {
      return next(new AppError('Chassis number is required', 400));
    }

    const vehicle = await Vehicle.findOne({ chassisNumber: chassisNumber.toUpperCase() })
      .populate(populateOptions);

    if (!vehicle) {
      return next(new AppError('No vehicle found with that chassis number', 404));
    }

    // Transform the response to handle null references
    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.model) {
      vehicleObj.model = {
        _id: vehicle.model,
        model_name: 'Unknown Model',
        type: 'Unknown'
      };
    }
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    vehicleObj.colors = vehicleObj.colors.map(color => {
      return color || {
        _id: color,
        name: 'Unknown Color',
        hex_code: '#CCCCCC'
      };
    });
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: vehicle.addedBy,
        name: 'Unknown User'
      };
    }

    res.status(200).json({
      status: 'success',
      data: {
        vehicle: vehicleObj
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicle by chassis number: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};