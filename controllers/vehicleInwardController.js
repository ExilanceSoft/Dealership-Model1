const VehicleInward = require('../models/vehicleInwardModel');
const Model = require('../models/ModelModel');
const Color = require('../models/Color');
const Branch = require('../models/Branch');
const logger = require('../config/logger');
const QRCode = require('qrcode');

exports.createVehicleInward = async (req, res) => {
  try {
    const {
      model,
      type,
      color,
      unloadLocation,
      batteryNumber,
      keyNumber,
      chassisNumber,
      motorNumber,
      chargerNumber,
      engineNumber,
      hasDamage,
      damages
    } = req.body;

    // Validate required fields
    if (!model || !type || !color || !unloadLocation || !chassisNumber) {
      return res.status(400).json({
        success: false,
        message: 'Model, type, color, unload location and chassis number are required'
      });
    }

    // Validate type-specific fields
    if (type === 'EV' && (!batteryNumber || !motorNumber || !chargerNumber)) {
      return res.status(400).json({
        success: false,
        message: 'For EV type, battery number, motor number and charger number are required'
      });
    }

    if (type === 'ICE' && !engineNumber) {
      return res.status(400).json({
        success: false,
        message: 'For ICE type, engine number is required'
      });
    }

    // Validate damage data if hasDamage is true
    if (hasDamage && (!damages || damages.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Damage details are required when hasDamage is true'
      });
    }

    // Check if model exists
    const modelExists = await Model.findById(model);
    if (!modelExists) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Check if color exists
    const colorExists = await Color.findById(color);
    if (!colorExists) {
      return res.status(404).json({
        success: false,
        message: 'Color not found'
      });
    }

    // Check if unload location exists
    const locationExists = await Branch.findById(unloadLocation);
    if (!locationExists) {
      return res.status(404).json({
        success: false,
        message: 'Unload location not found'
      });
    }

    // Check if chassis number already exists
    const existingVehicle = await VehicleInward.findOne({ chassisNumber });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this chassis number already exists'
      });
    }

    // Create vehicle inward
    const vehicleInward = await VehicleInward.create({
      model,
      type,
      color,
      unloadLocation,
      batteryNumber,
      keyNumber,
      chassisNumber,
      motorNumber,
      chargerNumber,
      engineNumber,
      hasDamage,
      damages,
      createdBy: req.user.id,
      branch: req.user.branch
    });

    // Generate QR code data URL
    const qrCodeDataURL = await QRCode.toDataURL(vehicleInward.qrCode);

    res.status(201).json({
      success: true,
      data: {
        ...vehicleInward.toObject(),
        qrCodeDataURL
      }
    });

  } catch (err) {
    logger.error(`Failed to create vehicle inward: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create vehicle inward'
    });
  }
};

exports.getVehicleByQRCode = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const vehicle = await VehicleInward.findOne({ qrCode })
      .populate('modelDetails', 'model_name type')
      .populate('colorDetails', 'name hexCode')
      .populate('unloadLocationDetails', 'name')
      .populate('branchDetails', 'name')
      .populate('createdByDetails', 'name');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
    });

  } catch (err) {
    logger.error(`Failed to fetch vehicle by QR code: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle details'
    });
  }
};

exports.getVehicleByChassisNumber = async (req, res) => {
  try {
    const { chassisNumber } = req.params;

    const vehicle = await VehicleInward.findOne({ chassisNumber })
      .populate('modelDetails', 'model_name type')
      .populate('colorDetails', 'name hexCode')
      .populate('unloadLocationDetails', 'name')
      .populate('branchDetails', 'name')
      .populate('createdByDetails', 'name');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
    });

  } catch (err) {
    logger.error(`Failed to fetch vehicle by chassis number: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle details'
    });
  }
};

exports.updateVehicleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const vehicle = await VehicleInward.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
    });

  } catch (err) {
    logger.error(`Failed to update vehicle status: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle status'
    });
  }
};

exports.getVehiclesByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { status, type } = req.query;

    const query = { branch: branchId };
    if (status) query.status = status;
    if (type) query.type = type;

    const vehicles = await VehicleInward.find(query)
      .populate('modelDetails', 'model_name type')
      .populate('colorDetails', 'name hexCode')
      .populate('unloadLocationDetails', 'name')
      .populate('createdByDetails', 'name');

    res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });

  } catch (err) {
    logger.error(`Failed to fetch vehicles by branch: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles'
    });
  }
};

exports.addDamageToVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, images, severity } = req.body;

    if (!description || !images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Damage description and images are required'
      });
    }

    const vehicle = await VehicleInward.findByIdAndUpdate(
      id,
      {
        $push: {
          damages: {
            description,
            images,
            severity: severity || 'minor'
          }
        },
        hasDamage: true
      },
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
    });

  } catch (err) {
    logger.error(`Failed to add damage to vehicle: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to add damage'
    });
  }
};