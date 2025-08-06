const Vehicle = require('../models/vehicleInwardModel');
const Model = require('../models/ModelModel');
const Color = require('../models/Color');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const User = require('../models/User');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify');

const populateOptions = [
  {
    path: 'model',
    model: 'Model',
    select: 'model_name type status prices colors createdAt',
    match: { _id: { $exists: true } }
  },
  {
    path: 'unloadLocation',
    model: 'Branch',
    select: 'name address city state pincode phone email gst_number is_active',
    match: { _id: { $exists: true } }
  },
  {
    path: 'colors',
    model: 'Color',
    select: 'name status models createdAt',
    match: { _id: { $exists: true } }
  },
  {
    path: 'addedBy',
    model: 'User',
    select: 'name email',
    match: { _id: { $exists: true } }
  }
];

exports.createVehicle = async (req, res, next) => {
  try {
    const { model, unloadLocation, type, colors, chassisNumber } = req.body;
    
    if (!model || !unloadLocation || !type || !colors || !chassisNumber) {
      return next(new AppError('Model, unload location, type, colors, and chassis number are required', 400));
    }
    
    if (!mongoose.Types.ObjectId.isValid(model) || 
        !mongoose.Types.ObjectId.isValid(unloadLocation) ||
        colors.some(color => !mongoose.Types.ObjectId.isValid(color))) {
      return next(new AppError('Invalid ID format', 400));
    }

    if (!['EV', 'ICE'].includes(type.toUpperCase())) {
      return next(new AppError('Type must be EV or ICE', 400));
    }

    const [modelExists, branchExists, colorsExist] = await Promise.all([
      Model.exists({ _id: model }),
      Branch.exists({ _id: unloadLocation }),
      Color.countDocuments({ _id: { $in: colors } })
    ]);

    if (!modelExists) return next(new AppError('Referenced model does not exist', 400));
    if (!branchExists) return next(new AppError('Referenced branch does not exist', 400));
    if (colorsExist !== colors.length) return next(new AppError('One or more referenced colors do not exist', 400));

    const existingVehicle = await Vehicle.findOne({ chassisNumber });
    if (existingVehicle) {
      return next(new AppError(`Vehicle with chassis number ${chassisNumber} already exists`, 409));
    }
    
    const newVehicle = await Vehicle.create({
      ...req.body,
      type: type.toUpperCase(),
      addedBy: req.user.id
    });
    
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
    if (err.code === 11000 && err.keyPattern?.chassisNumber) {
      const duplicateValue = err.keyValue?.chassisNumber;
      logger.error(`Duplicate chassis number error: ${duplicateValue}`);
      return next(new AppError(`Vehicle with chassis number ${duplicateValue} already exists`, 409));
    }
    
    logger.error(`Error creating vehicle: ${err.message}`);
    next(new AppError('Failed to create vehicle. Please try again.', 500));
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
    
    query = query.populate(populateOptions);
    
    const vehicles = await query;
    
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
          name: 'Unknown Color'
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

exports.getVehicleByQrCode = async (req, res, next) => {
  try {
    const { qrCode } = req.params;
    
    const vehicle = await Vehicle.findOne({ qrCode })
      .populate(populateOptions);
    
    if (!vehicle) {
      return next(new AppError('No vehicle found with that QR code', 404));
    }

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
    
    const qrCodeData = {
      model: vehicleObj.model.model_name,
      chassisNumber: vehicle.chassisNumber,
      colors: vehicleObj.colors.map(c => c.name),
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

exports.exportCSVTemplate = async (req, res, next) => {
  try {
    const { type, branch_id } = req.query;
    
    if (!type || !['EV', 'ICE'].includes(type.toUpperCase())) {
      return next(new AppError('Type is required and must be EV or ICE', 400));
    }
    
    if (!branch_id) {
      return next(new AppError('Branch ID is required', 400));
    }

    if (!mongoose.Types.ObjectId.isValid(branch_id)) {
      return next(new AppError('Invalid branch ID format', 400));
    }

    const normalizedType = type.toUpperCase();
    const branch = await Branch.findById(branch_id);
    if (!branch) return next(new AppError('Branch not found', 404));

    const vehicles = await Vehicle.find({ 
      type: normalizedType,
      unloadLocation: branch_id
    }).populate([
      { path: 'model', select: 'model_name type status' },
      { path: 'colors', select: 'name' }
    ]).sort({ createdAt: -1 });

    const csvData = [];
    const headerRow = [
      'model_name', 'branch_name', 'type', 'colors', 'batteryNumber',
      'keyNumber', 'chassisNumber', 'motorNumber', 'chargerNumber',
      'engineNumber', 'hasDamage', 'status'
    ];
    csvData.push(headerRow);

    vehicles.forEach(vehicle => {
      csvData.push([
        vehicle.model?.model_name || '',
        branch.name,
        vehicle.type || normalizedType,
        vehicle.colors?.map(c => c.name).join('|') || '',
        vehicle.batteryNumber || '',
        vehicle.keyNumber || '',
        vehicle.chassisNumber || '',
        vehicle.motorNumber || '',
        vehicle.chargerNumber || '',
        vehicle.engineNumber || '',
        vehicle.hasDamage ? 'true' : 'false',
        vehicle.status || 'in_stock'
      ]);
    });

    const stringifier = stringify({
      header: false,
      delimiter: ',',
      quoted: true,
      quoted_empty: true,
      quoted_string: true,
      escape: '"',
      bom: true
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=vehicle_inward_${normalizedType}_${branch.name.replace(/\s+/g, '_')}_${Date.now()}.csv`
    );

    stringifier.pipe(res);
    csvData.forEach(row => stringifier.write(row));
    stringifier.end();

  } catch (err) {
    logger.error(`Error exporting CSV template: ${err.message}`);
    next(new AppError('Error generating CSV template', 500));
  }
};

exports.importCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload a CSV file', 400));
    }

    const csvString = req.file.buffer.toString('utf8').trim();
    const csvData = csvString.split('\n')
      .filter(row => row.trim() !== '')
      .map(row => {
        const cells = row.split(',')
          .map(cell => {
            const trimmed = cell.trim();
            return trimmed.replace(/^"|"$/g, '');
          });
        return cells;
      });

    if (csvData.length < 2) {
      return next(new AppError('CSV must contain at least header and data rows', 400));
    }

    const headerRow = csvData[0];
    const dataRows = csvData.slice(1);
    const errors = [];
    let importedCount = 0;
    let updatedCount = 0;

    for (const row of dataRows) {
      try {
        const vehicleData = {};
        
        headerRow.forEach((header, index) => {
          const value = row[index];
          if (value !== undefined && value !== '') {
            switch (header.toLowerCase()) {
              case 'model_name':
                vehicleData.model_name = value;
                break;
              case 'branch_name':
                vehicleData.branch_name = value;
                break;
              case 'type':
                vehicleData.type = value.toUpperCase();
                break;
              case 'colors':
                vehicleData.colors = value.split('|').filter(c => c.trim() !== '');
                break;
              case 'batterynumber':
                vehicleData.batteryNumber = value;
                break;
              case 'keynumber':
                vehicleData.keyNumber = value;
                break;
              case 'chassisnumber':
                vehicleData.chassisNumber = value;
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
              case 'hasdamage':
                vehicleData.hasDamage = value.toLowerCase() === 'true';
                break;
              case 'status':
                vehicleData.status = value.toLowerCase();
                break;
            }
          }
        });

        if (!vehicleData.model_name || !vehicleData.branch_name || !vehicleData.type || !vehicleData.chassisNumber) {
          errors.push(`Row ${dataRows.indexOf(row) + 2}: Missing required fields`);
          continue;
        }

        if (!['EV', 'ICE'].includes(vehicleData.type)) {
          errors.push(`Row ${dataRows.indexOf(row) + 2}: Invalid type ${vehicleData.type} - must be EV or ICE`);
          continue;
        }

        const branch = await Branch.findOne({ name: vehicleData.branch_name });
        if (!branch) {
          errors.push(`Row ${dataRows.indexOf(row) + 2}: Branch '${vehicleData.branch_name}' does not exist`);
          continue;
        }
        vehicleData.unloadLocation = branch._id;
        
        if (req.query.branch_id && branch._id.toString() !== req.query.branch_id) {
          errors.push(`Row ${dataRows.indexOf(row) + 2}: Branch '${vehicleData.branch_name}' does not match the export branch`);
          continue;
        }

        let model = await Model.findOne({ model_name: vehicleData.model_name });
        if (!model) {
          model = await Model.create({
            model_name: vehicleData.model_name,
            type: vehicleData.type,
            status: 'active',
            createdBy: req.user.id
          });
        }
        vehicleData.model = model._id;

        const colorIds = [];
        for (const colorName of vehicleData.colors) {
          let color = await Color.findOne({ name: colorName });
          if (!color) {
            color = await Color.create({
              name: colorName,
              status: 'active'
            });
          }
          colorIds.push(color._id);
        }
        vehicleData.colors = colorIds;

        const existingVehicle = await Vehicle.findOne({ chassisNumber: vehicleData.chassisNumber });

        if (existingVehicle) {
          Object.assign(existingVehicle, vehicleData);
          await existingVehicle.save();
          updatedCount++;
        } else {
          vehicleData.addedBy = req.user.id;
          await Vehicle.create(vehicleData);
          importedCount++;
        }

      } catch (rowError) {
        errors.push(`Row ${dataRows.indexOf(row) + 2}: ${rowError.message}`);
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