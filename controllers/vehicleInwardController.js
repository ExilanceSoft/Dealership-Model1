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
      color, // expecting { id, name }
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
 
    if (!mongoose.Types.ObjectId.isValid(color?.id)) {
      return next(new AppError('Invalid color ID format', 400));
    }
 
    // Fetch referenced model
    const model = await Model.findById(modelId).select('model_name type');
    if (!model) return next(new AppError('Model not found', 404));
 
    // Fetch color to confirm and get its name (optional, but safer)
    const colorDoc = await Color.findById(color.id).select('name');
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
 
    // Create payload
    const vehiclePayload = {
      model: modelId,
      modelName: model.model_name,
      unloadLocation,
      type: model.type,
      colors: [color.id],
      chassisNumber: chassisNumber.toUpperCase(),
      batteryNumber: batteryNumber?.toUpperCase(),
      keyNumber: keyNumber?.toUpperCase(),
      motorNumber: motorNumber?.toUpperCase(),
      chargerNumber: chargerNumber?.toUpperCase(),
      engineNumber: engineNumber?.toUpperCase(),
      hasDamage,
      damages,
      addedBy: req.user.id
    };
 
    const newVehicle = await Vehicle.create(vehiclePayload);
 
    // Format response
    const response = {
      ...newVehicle.toObject(),
      color: {
        id: color.id,
        name: color.name || colorDoc.name
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

exports.exportCSVTemplate = async (req, res, next) => {
  try {
    const { type, branch_id } = req.query;
    
    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(branch_id)) {
      return next(new AppError('Invalid branch ID', 400));
    }

    const branch = await Branch.findById(branch_id);
    if (!branch) return next(new AppError('Branch not found', 404));

    // Get vehicles ONLY for this branch
    const vehicles = await Vehicle.find({ 
      type: type.toUpperCase(),
      unloadLocation: branch_id 
    });

    // Check for duplicates in database (optional)
    const dupes = await Vehicle.aggregate([
      { $group: { _id: "$chassisNumber", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    const csvData = [];
    
    // Add branch header
    csvData.push(['BRANCH:', branch.name]);
    csvData.push(['ADDRESS:', branch.address]);
    csvData.push(['EXPORT DATE:', new Date().toLocaleDateString()]);
    
    if (dupes.length > 0) {
      csvData.push(['WARNING:', `${dupes.length} DUPLICATE CHASSIS NUMBERS IN DATABASE`]);
    }

    csvData.push([]); // Empty row

    // Add headers
    const headers = type === 'EV' 
      ? ['Model', 'Color', 'Chassis', 'Motor', 'Battery']
      : ['Model', 'Color', 'Chassis', 'Engine'];
    
    csvData.push(headers);

    // Add vehicle data
    vehicles.forEach(v => {
      const row = [
        v.model,
        v.color?.name || 'N/A',
        v.chassisNumber,
        v.type === 'EV' ? v.motorNumber : v.engineNumber,
        v.batteryNumber
      ];
      csvData.push(row);
    });

    // Generate CSV
    const stringifier = stringify({ header: false });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${branch.name.replace(/\s+/g, '_')}_${type}_${Date.now()}.csv`
    );

    stringifier.pipe(res);
    csvData.forEach(row => stringifier.write(row));
    stringifier.end();

  } catch (err) {
    next(new AppError('Export failed', 500));
  }
};
exports.importCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload a CSV file', 400));
    }

    const { type, branch_id } = req.query;

    if (!type || !['EV', 'ICE'].includes(type.toUpperCase())) {
      return next(new AppError('Type is required and must be EV or ICE', 400));
    }

    if (!branch_id || !mongoose.Types.ObjectId.isValid(branch_id)) {
      return next(new AppError('Valid branch ID is required', 400));
    }

    const branchExists = await Branch.exists({ _id: branch_id });
    if (!branchExists) return next(new AppError('Branch not found', 404));

    const csvString = req.file.buffer.toString('utf8').trim();
    const rows = csvString.split('\n').filter(row => row.trim() !== '');

    // Find the header row (first row that contains 'chassisnumber')
    let headerRowIndex = -1;
    const headerRow = rows.find((row, index) => {
      const normalizedRow = row.toLowerCase();
      if (normalizedRow.includes('chassisnumber')) {
        headerRowIndex = index;
        return true;
      }
      return false;
    });

    if (!headerRow) {
      return next(new AppError('CSV must contain a header row with chassisNumber', 400));
    }

    // Process only rows after the header
    const dataRows = rows.slice(headerRowIndex + 1);
    if (dataRows.length === 0) {
      return next(new AppError('CSV must contain data rows after the header', 400));
    }

    const headers = headerRow.split(',')
      .map(h => h.trim().toLowerCase().replace(/"/g, ''))
      .filter(h => h !== '');

    const errors = [];
    let importedCount = 0;
    let updatedCount = 0;

    for (const row of dataRows) {
      try {
        const vehicleData = {};
        const cells = row.split(',')
          .map(cell => cell.trim().replace(/^"|"$/g, ''))
          .filter(cell => cell !== '');

        if (cells.length < headers.length) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Not enough columns`);
          continue;
        }

        headers.forEach((header, index) => {
          const value = cells[index];
          if (value && value !== '') {
            switch (header) {
              case 'model':
                vehicleData.model = value;
                break;
              case 'color':
                vehicleData.colorName = value; // Store color name for later processing
                break;
              case 'batterynumber':
                vehicleData.batteryNumber = value;
                break;
              case 'keynumber':
                vehicleData.keyNumber = value;
                break;
              case 'chassisnumber':
                vehicleData.chassisNumber = value.toUpperCase();
                break;
              case 'motornumber':
                vehicleData.motorNumber = value;
                break;
              case 'chargernumber':
                vehicleData.chargerNumber = value;
                break;
              case 'enginenumber':
                vehicleData.engineNumber = value;
                break;
            }
          }
        });

        if (!vehicleData.model || !vehicleData.chassisNumber) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Missing required fields (model, chassisNumber)`);
          continue;
        }

        if (!vehicleData.colorName) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Color is required`);
          continue;
        }

        // Handle color - find or create
        let color = await Color.findOne({ name: vehicleData.colorName });
        if (!color) {
          color = await Color.create({
            name: vehicleData.colorName,
            status: 'active'
          });
        }

        vehicleData.color = {
          id: color._id,
          name: color.name
        };
        delete vehicleData.colorName;

        // Validate type-specific fields
        const normalizedType = type.toUpperCase();
        if (normalizedType === 'EV' && (!vehicleData.motorNumber || !vehicleData.chargerNumber)) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Missing required fields for EV (motorNumber, chargerNumber)`);
          continue;
        }

        if (normalizedType === 'ICE' && !vehicleData.engineNumber) {
          errors.push(`Row ${rows.indexOf(row) + 1}: Missing required field for ICE (engineNumber)`);
          continue;
        }

        vehicleData.type = normalizedType;
        vehicleData.unloadLocation = branch_id;

        const existingVehicle = await Vehicle.findOne({ chassisNumber: vehicleData.chassisNumber });

        if (existingVehicle) {
          // Update existing vehicle
          existingVehicle.set(vehicleData);
          await existingVehicle.save();
          updatedCount++;
        } else {
          // Create new vehicle
          vehicleData.addedBy = req.user.id;
          await Vehicle.create(vehicleData);
          importedCount++;
        }

      } catch (rowError) {
        errors.push(`Row ${rows.indexOf(row) + 1}: ${rowError.message}`);
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'CSV import completed',
      imported: importedCount,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
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
    const { page = 1, limit = 10 } = req.query;

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