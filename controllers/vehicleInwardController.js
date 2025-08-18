const Vehicle = require('../models/vehicleInwardModel');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const User = require('../models/User');
const Color = require('../models/Color');
const { stringify } = require('csv-stringify');
const Model = require('../models/ModelModel');
const _ = require('lodash');
const populateOptions = [
  {
    path: 'unloadLocation',
    model: 'Branch',
    select: 'name address city state pincode phone email gst_number is_active'
  },
  {
    path: 'addedBy',
    model: 'User',
    select: 'name email'
  }
];

exports.createVehicle = async (req, res, next) => {
  try {
    const {
      chassisNumber,
      unloadLocation,
      model: modelId,
      color: colorInput, // expecting { id, name }
      batteryNumber,
      keyNumber,
      motorNumber,
      chargerNumber,
      engineNumber,
      hasDamage = false,
      damages = []
    } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(unloadLocation)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    if (!mongoose.Types.ObjectId.isValid(modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }

    if (!mongoose.Types.ObjectId.isValid(colorInput?.id)) {
      return next(new AppError('Invalid color ID format', 400));
    }

    // Fetch referenced model
    const model = await Model.findById(modelId).select('model_name type');
    if (!model) return next(new AppError('Model not found', 404));

    // Fetch color to confirm and get its name
    const colorDoc = await Color.findById(colorInput.id).select('name');
    if (!colorDoc) return next(new AppError('Color not found', 404));

    // Check chassis duplication
    const existing = await Vehicle.findOne({ chassisNumber: chassisNumber.toUpperCase() });
    if (existing) {
      const branch = await Branch.findById(existing.unloadLocation).select('name');
      return next(new AppError(
        `Vehicle with chassis number "${chassisNumber}" already exists in ${branch?.name || 'unknown branch'}`,
        409
      ));
    }

    // Validate damages
    if (hasDamage && damages.length > 0) {
      for (let damage of damages) {
        if (
          typeof damage.description !== 'string' ||
          damage.description.trim().length === 0 ||
          !Array.isArray(damage.images) ||
          damage.images.length === 0
        ) {
          return next(new AppError('Each damage must include a description and at least one image', 400));
        }
      }
    }

    // Create payload with proper color structure
    const vehiclePayload = {
      model: modelId,
      modelName: model.model_name,
      unloadLocation,
      type: model.type,
      colors: [colorInput.id],
      color: {  // This will store both ID and name
        id: colorInput.id,
        name: colorDoc.name
      },
      chassisNumber: chassisNumber.toUpperCase(),
      batteryNumber: batteryNumber?.toUpperCase(),
      keyNumber: keyNumber?.toUpperCase(),
      motorNumber: motorNumber?.toUpperCase(),
      chargerNumber: chargerNumber?.toUpperCase(),
      engineNumber: engineNumber?.toUpperCase(),
      hasDamage,
      damages,
      addedBy: req.user.id,
      status: 'not_approved' // Default status
    };

    const newVehicle = await Vehicle.create(vehiclePayload);

    // Format response
    const response = {
      ...newVehicle.toObject(),
      color: {
        id: colorInput.id,
        name: colorDoc.name
      }
    };

    // Remove `colors` array from response to avoid duplication
    delete response.colors;

    res.status(201).json({
      status: 'success',
      data: { vehicle: response }
    });

  } catch (err) {
    console.error('Vehicle creation error:', err);
    next(new AppError(err.message || 'Internal server error', 500));
  }
};

exports.approveVehicles = async (req, res, next) => {
  try {
    const { vehicleIds } = req.body;

    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return next(new AppError('Please provide an array of vehicle IDs to approve', 400));
    }

    // Validate all IDs
    const invalidIds = vehicleIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return next(new AppError(`Invalid vehicle IDs: ${invalidIds.join(', ')}`, 400));
    }

    // Update all vehicles to in_stock status
    const result = await Vehicle.updateMany(
      { 
        _id: { $in: vehicleIds },
        status: 'not_approved' // Only approve vehicles that are not already approved
      },
      { 
        $set: { 
          status: 'in_stock',
          lastUpdatedBy: req.user.id 
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return next(new AppError('No vehicles were approved (either already approved or not found)', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        approvedCount: result.modifiedCount,
        message: `${result.modifiedCount} vehicle(s) approved successfully`
      }
    });

  } catch (err) {
    logger.error(`Error approving vehicles: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};



exports.getVehicleCounts = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('branch');
    
    if (await user.isSuperAdmin()) {
      const branches = await Branch.find({ is_active: true });
      
      const branchCounts = await Promise.all(
        branches.map(async (branch) => {
          const counts = await Vehicle.aggregate([
            { $match: { unloadLocation: branch._id } },
            { $group: { 
              _id: '$status', 
              count: { $sum: 1 } 
            }},
            { $project: { 
              status: '$_id', 
              count: 1, 
              _id: 0 
            }}
          ]);
          
          const statusCounts = counts.map(item => ({
            status: item.status,
            count: item.count
          }));
          
          const total = statusCounts.reduce((sum, item) => sum + item.count, 0);
          
          return {
            branchId: branch._id,
            branchName: branch.name,
            branchCity: branch.city,
            statusCounts,
            total
          };
        })
      );
      
      return res.status(200).json({
        status: 'success',
        data: {
          counts: branchCounts
        }
      });
    }
    
    if (!user.branch) {
      return next(new AppError('User is not assigned to any branch', 400));
    }
    
    const counts = await Vehicle.aggregate([
      { $match: { unloadLocation: user.branch._id } },
      { $group: { 
        _id: '$status', 
        count: { $sum: 1 } 
      }},
      { $project: { 
        status: '$_id', 
        count: 1, 
        _id: 0 
      }}
    ]);
    
    const statusCounts = counts.map(item => ({
      status: item.status,
      count: item.count
    }));
    
    const total = statusCounts.reduce((sum, item) => sum + item.count, 0);
    
    res.status(200).json({
      status: 'success',
      data: {
        branchId: user.branch._id,
        branchName: user.branch.name,
        branchCity: user.branch.city,
        statusCounts,
        total
      }
    });
    
  } catch (err) {
    logger.error(`Error getting vehicle counts: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

exports.getAllVehicles = async (req, res, next) => {
  try {
    const { type, status, model, location, color, hasDamage } = req.query;
    
    let query = Vehicle.find();
    
    if (type && ['EV', 'ICE'].includes(type.toUpperCase())) {
      query = query.where('type').equals(type.toUpperCase());
    }
    
    if (status) {
      query = query.where('status').equals(status.toLowerCase());
    }
    
    if (model) {
      query = query.where('model').equals(model);
    }
    
    if (location && mongoose.Types.ObjectId.isValid(location)) {
      query = query.where('unloadLocation').equals(location);
    }
    
    if (color) {
      query = query.where('color').equals(color);
    }
    
    if (hasDamage === 'true') {
      query = query.where('hasDamage').equals(true);
    } else if (hasDamage === 'false') {
      query = query.where('hasDamage').equals(false);
    }
    
    query = query.populate(populateOptions);
    
    const vehicles = await query;
    
    const transformedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      // Ensure modelName is included
      if (!vehicleObj.modelName && vehicle.model) {
        vehicleObj.modelName = vehicle.model.model_name || 'Unknown Model';
      }
      
      if (!vehicleObj.unloadLocation) {
        vehicleObj.unloadLocation = {
          _id: vehicle.unloadLocation,
          name: 'Unknown Location'
        };
      }
      
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
    logger.error(`Error getting vehicles: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};
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

    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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

exports.getVehicleByQrCode = async (req, res, next) => {
  try {
    const { qrCode } = req.params;
    
    const vehicle = await Vehicle.findOne({ qrCode })
      .populate(populateOptions);
    
    if (!vehicle) {
      return next(new AppError('No vehicle found with that QR code', 404));
    }

    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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

exports.updateVehicleStatus = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }
    
    if (!status || !['not_approved', 'in_stock', 'in_transit', 'sold', 'service', 'damaged'].includes(status)) {
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

    const vehicleObj = updatedVehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: updatedVehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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

    const vehicleObj = updatedVehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: updatedVehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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

    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
    if (!vehicleObj.addedBy) {
      vehicleObj.addedBy = {
        _id: vehicle.addedBy,
        name: 'Unknown User'
      };
    }
    
    const qrCodeData = {
      model: vehicleObj.model,
      chassisNumber: vehicle.chassisNumber,
      color: vehicleObj.color,
      location: vehicleObj.unloadLocation.name,
      status: vehicle.status,
      qrCode: vehicle.qrCode
    };
    
    const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrCodeData));
    
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

exports.getVehiclesByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    const vehicles = await Vehicle.find({ unloadLocation: branchId })
      .populate(populateOptions);

    const transformedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      if (!vehicleObj.unloadLocation) {
        vehicleObj.unloadLocation = {
          _id: vehicle.unloadLocation,
          name: 'Unknown Location'
        };
      }
      
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

    const vehicleObj = vehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: vehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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

exports.getModelDetails = async (req, res, next) => {
  try {
    const { model } = req.params;
    
    if (!model) {
      return next(new AppError('Model name is required', 400));
    }

    // Get all vehicles of this model
    const vehicles = await Vehicle.find({ model })
      .select('chassisNumber color')
      .sort({ chassisNumber: 1 });

    if (vehicles.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: {
          model,
          chassisNumbers: [],
          color: []
        }
      });
    }

    // Extract unique chassis numbers
    const chassisNumbers = [...new Set(vehicles.map(v => v.chassisNumber))];

    // Extract unique colors
    const colorMap = new Map();
    vehicles.forEach(vehicle => {
      if (vehicle.color && vehicle.color.id && vehicle.color.name) {
        colorMap.set(vehicle.color.id.toString(), {
          id: vehicle.color.id,
          name: vehicle.color.name
        });
      }
    });
    const colors = Array.from(colorMap.values());

    res.status(200).json({
      status: 'success',
      results: chassisNumbers.length,
      data: {
        model,
        chassisNumbers,
        colors
      }
    });
  } catch (err) {
    logger.error(`Error getting model details: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

/**
 * @route  GET /api/exports/vehicles-csv
 * @query  type=EV|ICE&branch_id=<ObjectId>
 * @desc   Stream a CSV export of vehicles for a given branch and vehicle type.
 */
exports.exportCSVTemplate = async (req, res, next) => {
  try {
    let { type, branch_id } = req.query;

    // ---- Validate inputs ----------------------------------------------------
    if (!branch_id || !mongoose.Types.ObjectId.isValid(branch_id)) {
      return next(new AppError("Invalid branch ID", 400));
    }

    if (!type) {
      return next(new AppError("Query param 'type' is required (EV or ICE)", 400));
    }

    type = String(type).trim().toUpperCase();
    const ALLOWED_TYPES = new Set(["EV", "ICE"]);
    if (!ALLOWED_TYPES.has(type)) {
      return next(new AppError("Invalid type. Allowed: EV or ICE", 400));
    }

    // ---- Fetch branch -------------------------------------------------------
    const branch = await Branch.findById(branch_id).lean();
    if (!branch) return next(new AppError("Branch not found", 404));

    // ---- Fetch vehicles for branch & type ----------------------------------
    const vehicles = await Vehicle.find({
      type,
      unloadLocation: branch._id
    })
      .populate('model', 'model_name') // Populate the model to get the name
      .select(
        "model modelName color batteryNumber keyNumber chassisNumber engineNumber motorNumber chargerNumber"
      )
      .sort({ model: 1, chassisNumber: 1 })
      .lean();

    // ---- Find duplicate chassis numbers (scoped to this branch & type) -----
    const dupes = await Vehicle.aggregate([
      {
        $match: {
          type,
          unloadLocation: new mongoose.Types.ObjectId(branch._id)
        }
      },
      {
        $group: {
          _id: "$chassisNumber",
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // ---- Build CSV rows -----------------------------------------------------
    const csvData = [];

    // Meta section
    csvData.push(["BRANCH:", branch.name || ""]);
    csvData.push(["ADDRESS:", branch.address || ""]);
    csvData.push(["VEHICLE TYPE:", type]);
    csvData.push(["EXPORT DATE:", new Date().toLocaleString("en-IN")]);

    if (dupes.length > 0) {
      csvData.push([]);
      csvData.push([
        "WARNING:",
        `${dupes.length} DUPLICATE CHASSIS NUMBERS IN THIS BRANCH (${type})`
      ]);
    }

    csvData.push([]);

    // Headers (as requested)
    const headers =
      type === "EV"
        ? [
            "Vehicle Model",
            "Color",
            "Battery No",
            "Key No",
            "Chassis No",
            "Engine No",
            "Motor No",
            "Charger No"
          ]
        : ["Vehicle Model", "Color", "Battery No", "Key No", "Chassis No", "Engine No"];

    csvData.push(headers);

    // Data rows
    for (const v of vehicles) {
      const color =
        (v.color && typeof v.color === "object" && v.color.name) ||
        (typeof v.color === "string" ? v.color : null) ||
        "N/A";

      // Use model.model_name if populated, otherwise fall back to modelName
      const modelName = v.model?.model_name || v.modelName || "N/A";

      if (type === "EV") {
        csvData.push([
          modelName,
          color,
          v.batteryNumber || "",
          v.keyNumber || "",
          v.chassisNumber || "",
          v.engineNumber || "",
          v.motorNumber || "",
          v.chargerNumber || ""
        ]);
      } else {
        csvData.push([
          modelName,
          color,
          v.batteryNumber || "",
          v.keyNumber || "",
          v.chassisNumber || "",
          v.engineNumber || ""
        ]);
      }
    }

    // If no vehicles, still provide just the headers so it's a "template"
    if (vehicles.length === 0) {
      csvData.push(
        ...(type === "EV"
          ? [["", "", "", "", "", "", "", ""]]
          : [["", "", "", "", "", ""]])
      );
    }

    // ---- Stream CSV to response --------------------------------------------
    const safeBranchName = (branch.name || "branch").replace(/[^\w\-]+/g, "_");
    const filename = `${safeBranchName}_${type}_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    const stringifier = stringify({ header: false });
    stringifier.on("error", (err) => {
      // If streaming fails, hand off to error middleware
      next(new AppError(`CSV stream error: ${err.message}`, 500));
    });

    stringifier.pipe(res);
    for (const row of csvData) {
      stringifier.write(row);
    }
    stringifier.end();
  } catch (err) {
    next(new AppError(err?.message || "Export failed", 500));
  }
};

// Define the importCSV function as an async function that handles CSV imports
exports.importCSV = async (req, res, next) => {
  try {
    // 1. Check if file was uploaded
    if (!req.file) {
      return next(new AppError('Please upload a CSV file', 400));
    }

    // 2. Extract query parameters
    const { type, branch_id } = req.query;

    // 3. Validate type parameter
    if (!type || !['EV', 'ICE'].includes(type.toUpperCase())) {
      return next(new AppError('Type is required and must be EV or ICE', 400));
    }

    // 4. Validate branch_id parameter
    if (!branch_id || !mongoose.Types.ObjectId.isValid(branch_id)) {
      return next(new AppError('Valid branch ID is required', 400));
    }

    // 5. Check if branch exists
    const branchExists = await Branch.exists({ _id: branch_id });
    if (!branchExists) return next(new AppError('Branch not found', 404));

    // 6. Convert CSV buffer to string and clean it
    const csvString = req.file.buffer.toString('utf8').trim();
    const rows = csvString.split('\n').filter(row => row.trim() !== '');

    // 7. Find the header row
    let headerRowIndex = -1;
    const headerRow = rows.find((row, index) => {
      const normalizedRow = row.toLowerCase();
      if (normalizedRow.includes('chassis no') || normalizedRow.includes('chassisnumber')) {
        headerRowIndex = index;
        return true;
      }
      return false;
    });

    // 8. Validate header row exists
    if (!headerRow) {
      return next(new AppError('CSV must contain a valid header row with "Chassis No" or "chassisNumber"', 400));
    }

    // 9. Extract data rows (skip meta rows)
    const dataRows = rows.slice(headerRowIndex + 1).filter(row => {
      return row.trim() !== '' && 
             !row.startsWith('BRANCH:') && 
             !row.startsWith('ADDRESS:') && 
             !row.startsWith('VEHICLE TYPE:') && 
             !row.startsWith('EXPORT DATE:') &&
             !row.startsWith('WARNING:');
    });

    // 10. Validate there are data rows
    if (dataRows.length === 0) {
      return next(new AppError('CSV must contain data rows after the header', 400));
    }

    // 11. Define header mapping for CSV columns
    const headerMapping = {
      'vehicle model': 'model',
      'model': 'model',
      'color': 'color',
      'battery no': 'batteryNumber',
      'batterynumber': 'batteryNumber',
      'key no': 'keyNumber',
      'keynumber': 'keyNumber',
      'chassis no': 'chassisNumber',
      'chassisnumber': 'chassisNumber',
      'engine no': 'engineNumber',
      'enginenumber': 'engineNumber',
      'motor no': 'motorNumber',
      'motornumber': 'motorNumber',
      'charger no': 'chargerNumber',
      'chargernumber': 'chargerNumber'
    };

    // 12. Process headers
    const headers = headerRow.split(',')
      .map(h => h.trim().toLowerCase().replace(/"/g, ''))
      .filter(h => h !== '')
      .map(h => headerMapping[h] || h);

    // 13. Initialize counters and error collection
    const errors = [];
    let importedCount = 0;
    let updatedCount = 0;

    // 14. Process each data row
    for (const row of dataRows) {
      try {
        const vehicleData = {};
        // 15. Split row into cells and clean them
        const cells = row.split(',')
          .map(cell => cell.trim().replace(/^"|"$/g, ''))
          .filter(cell => cell !== '');

        // 16. Validate column count matches headers
        if (cells.length < headers.length) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Not enough columns`);
          continue;
        }

        // 17. Map cells to vehicle data based on headers
        headers.forEach((header, index) => {
          const value = cells[index];
          if (value && value !== '') {
            switch (header) {
              case 'model':
                vehicleData.modelName = value;
                break;
              case 'color':
                vehicleData.colorName = value;
                break;
              case 'batteryNumber':
                vehicleData.batteryNumber = value.toUpperCase();
                break;
              case 'keyNumber':
                vehicleData.keyNumber = value.toUpperCase();
                break;
              case 'chassisNumber':
                vehicleData.chassisNumber = value.toUpperCase();
                break;
              case 'motorNumber':
                vehicleData.motorNumber = value.toUpperCase();
                break;
              case 'chargerNumber':
                vehicleData.chargerNumber = value.toUpperCase();
                break;
              case 'engineNumber':
                vehicleData.engineNumber = value.toUpperCase();
                break;
            }
          }
        });

        // 18. Validate required fields
        if (!vehicleData.modelName || !vehicleData.chassisNumber) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Missing required fields (model, chassisNumber)`);
          continue;
        }

        if (!vehicleData.colorName) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Color is required`);
          continue;
        }

        // 19. Handle model - try to find in Model collection
        const model = await Model.findOne({ 
          model_name: { $regex: new RegExp(`^${vehicleData.modelName}$`, 'i') } 
        });
        
        // 20. If model exists, use its ID and proper name
        if (model) {
          vehicleData.model = model._id;
          vehicleData.modelName = model.model_name;
        } else {
          // 21. If model doesn't exist, just use the name from CSV
          vehicleData.modelName = vehicleData.modelName;
          // Leave model reference undefined
        }

        // 22. Handle color - find or create
        let color = await Color.findOne({ 
          name: { $regex: new RegExp(`^${vehicleData.colorName}$`, 'i') } 
        });
        
        if (!color) {
          color = await Color.create({
            name: vehicleData.colorName,
            status: 'active',
            addedBy: req.user.id
          });
        }
        vehicleData.colors = [color._id];
        vehicleData.color = {
          id: color._id,
          name: color.name
        };
        delete vehicleData.colorName;

        // 23. Validate type-specific fields
        const normalizedType = type.toUpperCase();
        if (normalizedType === 'EV') {
          if (!vehicleData.motorNumber) {
            errors.push(`Row ${rows.indexOf(row) + 1}: Missing required field for EV (motorNumber)`);
            continue;
          }
          if (!vehicleData.chargerNumber) {
            errors.push(`Row ${rows.indexOf(row) + 1}: Missing required field for EV (chargerNumber)`);
            continue;
          }
        }

        if (normalizedType === 'ICE' && !vehicleData.engineNumber) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Missing required field for ICE (engineNumber)`);
          continue;
        }

        // 24. Set common vehicle data
        vehicleData.type = normalizedType;
        vehicleData.unloadLocation = branch_id;
        vehicleData.addedBy = req.user.id;
        vehicleData.status = 'not_approved';

        // 25. Check if vehicle already exists
        const existingVehicle = await Vehicle.findOne({ chassisNumber: vehicleData.chassisNumber });

        if (existingVehicle) {
          // 26. Update existing vehicle
          const update = {
            ...vehicleData,
            lastUpdatedBy: req.user.id
          };
          await Vehicle.findByIdAndUpdate(existingVehicle._id, update);
          updatedCount++;
        } else {
          // 27. Create new vehicle
          await Vehicle.create(vehicleData);
          importedCount++;
        }

      } catch (rowError) {
        // 28. Catch and record any row processing errors
        errors.push(`Row ${rows.indexOf(row) + 1}: ${rowError.message}`);
      }
    }

    // 29. Return import results
    res.status(200).json({
      status: 'success',
      message: 'CSV import completed',
      imported: importedCount,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    // 30. Handle any unexpected errors
    logger.error(`Error importing CSV: ${err.message}`);
    next(new AppError('Error processing CSV file', 500));
  }
};

exports.getChassisNumbersByModel = async (req, res, next) => {
  try {
    const { model } = req.params;
    
    if (!model) {
      return next(new AppError('Model name is required', 400));
    }

    const vehicles = await Vehicle.find({ model })
      .select('chassisNumber model')
      .sort({ chassisNumber: 1 });

    const chassisNumbers = vehicles.map(vehicle => ({
      chassisNumber: vehicle.chassisNumber,
      model: vehicle.model
    }));

    res.status(200).json({
      status: 'success',
      results: chassisNumbers.length,
      data: {
        chassisNumbers
      }
    });
  } catch (err) {
    logger.error(`Error getting chassis numbers by model: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

exports.getVehiclesByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 1000 } = req.query;

    // Validate status
    const validStatuses = ['not_approved', 'in_stock', 'in_transit', 'sold', 'service', 'damaged'];
    if (!validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    // Convert page and limit to numbers
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Create query with pagination
    const query = Vehicle.find({ status })
      .populate(populateOptions)
      .sort({ createdAt: -1 }) // Newest first
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    const vehicles = await query;

    // Get total count for pagination info
    const total = await Vehicle.countDocuments({ status });

    // Transform vehicles to include branch and user details
    const transformedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      if (!vehicleObj.unloadLocation) {
        vehicleObj.unloadLocation = {
          _id: vehicle.unloadLocation,
          name: 'Unknown Location'
        };
      }
      
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
      total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: {
        vehicles: transformedVehicles
      }
    });
  } catch (err) {
    logger.error(`Error getting vehicles by status: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

exports.updateVehicle = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const {
      model,
      unloadLocation,
      color,
      batteryNumber,
      keyNumber,
      motorNumber,
      chargerNumber,
      engineNumber,
      hasDamage
    } = req.body;

    // Validate vehicle ID
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }

    // Find the existing vehicle
    const existingVehicle = await Vehicle.findById(vehicleId);
    if (!existingVehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }

    // Prepare update payload
    const updatePayload = {
      lastUpdatedBy: req.user.id
    };

    // Validate and add model if provided
    if (model !== undefined) {
      // Allow string "modelName" updates without requiring model ID
      if (typeof model === 'string') {
        updatePayload.modelName = model;
        // Clear model reference if updating with just name
        updatePayload.model = null;
      } else if (mongoose.Types.ObjectId.isValid(model)) {
        const modelExists = await Model.exists({ _id: model });
        if (!modelExists) {
          return next(new AppError('Model not found', 404));
        }
        updatePayload.model = model;
        // Get model name from the model document
        const modelDoc = await Model.findById(model).select('model_name');
        if (modelDoc) {
          updatePayload.modelName = modelDoc.model_name;
        }
      } else {
        return next(new AppError('Invalid model format - must be ID or model name string', 400));
      }
    }

    // Validate and add unloadLocation if provided
    if (unloadLocation !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(unloadLocation)) {
        return next(new AppError('Invalid branch ID format', 400));
      }
      const branchExists = await Branch.exists({ _id: unloadLocation });
      if (!branchExists) {
        return next(new AppError('Branch not found', 404));
      }
      updatePayload.unloadLocation = unloadLocation;
    }

    // Validate and add color if provided
    if (color !== undefined) {
      if (!color || !color.id || !mongoose.Types.ObjectId.isValid(color.id)) {
        return next(new AppError('Valid color with ID is required', 400));
      }
      const colorDoc = await Color.findById(color.id);
      if (!colorDoc) {
        return next(new AppError('Color not found', 404));
      }
      
      updatePayload.color = {
        id: color.id,
        name: colorDoc.name
      };
      updatePayload.colors = [color.id];
    }

    // Add other fields if provided
    if (batteryNumber !== undefined) {
      updatePayload.batteryNumber = batteryNumber?.toUpperCase();
    }
    if (keyNumber !== undefined) {
      updatePayload.keyNumber = keyNumber?.toUpperCase();
    }
    if (motorNumber !== undefined) {
      updatePayload.motorNumber = motorNumber?.toUpperCase();
    }
    if (chargerNumber !== undefined) {
      updatePayload.chargerNumber = chargerNumber?.toUpperCase();
    }
    if (engineNumber !== undefined) {
      updatePayload.engineNumber = engineNumber?.toUpperCase();
    }
    if (hasDamage !== undefined) {
      updatePayload.hasDamage = hasDamage;
      if (hasDamage === false && existingVehicle.damages.length === 0) {
        updatePayload.status = 'in_stock';
      }
    }

    // Update the vehicle
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      updatePayload,
      { new: true, runValidators: true }
    ).populate(populateOptions);

    // Transform the response
    const vehicleObj = updatedVehicle.toObject();
    
    if (!vehicleObj.unloadLocation) {
      vehicleObj.unloadLocation = {
        _id: updatedVehicle.unloadLocation,
        name: 'Unknown Location'
      };
    }
    
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
    logger.error(`Error updating vehicle: ${err.message}`);
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return next(new AppError('Duplicate value for unique field', 409));
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      return next(new AppError(err.message, 400));
    }
    
    next(new AppError('Server Error', 500));
  }
};

exports.getChassisNumbersByModelAndColor = async (req, res, next) => {
  try {
    const { modelId, colorId } = req.params;
 
    // Validate ObjectIDs
    if (!mongoose.Types.ObjectId.isValid(modelId)) {
      return next(new AppError('Invalid model ID format', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(colorId)) {
      return next(new AppError('Invalid color ID format', 400));
    }
 
    // Ensure model and color exist
    const model = await Model.findById(modelId).select('model_name');
    const color = await Color.findById(colorId).select('name');
 
    if (!model) {
      return next(new AppError('No model found with that ID', 404));
    }
    if (!color) {
      return next(new AppError('No color found with that ID', 404));
    }
 
    // Fetch vehicles with matching model, color, and in_stock status
    const vehicles = await Vehicle.find({
      model: modelId,
      colors: colorId,
      status: 'in_stock'
    })
      .select('chassisNumber model colors status')
      .sort({ chassisNumber: 1 })
      .populate('model', 'model_name')
      .populate('colors', 'name');
 
    // Extract chassis numbers
    const chassisNumbers = vehicles.map(vehicle => vehicle.chassisNumber);
 
    res.status(200).json({
      status: 'success',
      results: chassisNumbers.length,
      data: {
        modelId,
        modelName: model.model_name,
        colorId,
        colorName: color.name,
        chassisNumbers
      }
    });
  } catch (err) {
    logger.error(`Error fetching chassis numbers: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};

exports.deleteVehicle = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return next(new AppError('Invalid vehicle ID format', 400));
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return next(new AppError('No vehicle found with that ID', 404));
    }

    // Prevent deletion of vehicles that are not in not_approved or in_stock status
    if (!['not_approved', 'in_stock'].includes(vehicle.status)) {
      return next(new AppError(
        `Cannot delete vehicle with status "${vehicle.status}". Only vehicles with "not_approved" or "in_stock" status can be deleted.`,
        400
      ));
    }

    await Vehicle.findByIdAndDelete(vehicleId);

    res.status(204).json({
      status: 'success',
      data: null
    });

  } catch (err) {
    logger.error(`Error deleting vehicle: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};