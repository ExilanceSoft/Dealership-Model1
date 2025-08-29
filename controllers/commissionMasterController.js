// controllers/commissionMasterController.js
const CommissionMaster = require('../models/CommissionMaster');
const Header = require('../models/HeaderModel');
const Subdealer = require('../models/Subdealer');
const Model = require('../models/ModelModel');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const Booking = require('../models/Booking'); // Add this import
const mongoose = require('mongoose');
// Add these imports at the top
const csv = require('csv-parser');
const { Readable } = require('stream');
const { stringify } = require('csv-stringify');
const cleanValue = (value) => {
  if (value === null || value === undefined) return null;
  const strValue = value.toString().trim();
  if (strValue === '') return null;

  const numValue = parseFloat(strValue.replace(/,/g, ''));
  return isNaN(numValue) ? strValue : numValue;
};

// Create or update commission master with history tracking
// Update the createOrUpdateCommissionMaster method in commissionMasterController.js
exports.createOrUpdateCommissionMaster = async (req, res, next) => {
  try {
    const { subdealer_id, model_id, commission_rates } = req.body;

    // Validate required fields
    if (!subdealer_id) {
      return next(new AppError('Subdealer ID is required', 400));
    }
    if (!model_id) {
      return next(new AppError('Model ID is required', 400));
    }
    if (!commission_rates || !Array.isArray(commission_rates)) {
      return next(new AppError('Commission rates array is required', 400));
    }

    // Validate subdealer exists
    const subdealerExists = await Subdealer.exists({ _id: subdealer_id });
    if (!subdealerExists) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Validate model exists
    const modelExists = await Model.exists({ _id: model_id });
    if (!modelExists) {
      return next(new AppError('Model not found', 404));
    }

    // Get model type to validate headers
    const model = await Model.findById(model_id).select('type');
    const validHeaders = await Header.find({ type: model.type }).select('_id');
    const validHeaderIds = validHeaders.map(h => h._id.toString());

    // Validate commission rates
    const seenHeaderIds = new Set();
    
    for (const rate of commission_rates) {
      if (!rate.header_id) {
        return next(new AppError('Each commission rate must have a header_id', 400));
      }
      
      if (rate.commission_rate === undefined || rate.commission_rate === null) {
        return next(new AppError('Each commission rate must have a commission_rate', 400));
      }
      
      if (typeof rate.commission_rate !== 'number' || rate.commission_rate < 0 || rate.commission_rate > 100) {
        return next(new AppError('Commission rate must be a number between 0 and 100', 400));
      }
      
      if (!validHeaderIds.includes(rate.header_id.toString())) {
        return next(new AppError(`Header ${rate.header_id} is not valid for model type ${model.type}`, 400));
      }
      
      if (seenHeaderIds.has(rate.header_id.toString())) {
        return next(new AppError(`Duplicate header_id found: ${rate.header_id}`, 400));
      }
      
      // Validate applicable dates with proper null checks
      if (rate.applicable_from) {
        if (!(rate.applicable_from instanceof Date)) {
          return next(new AppError('applicable_from must be a valid date', 400));
        }
      } else {
        rate.applicable_from = new Date(); // Set default if not provided
      }
      
      if (rate.applicable_to) {
        if (!(rate.applicable_to instanceof Date)) {
          return next(new AppError('applicable_to must be a valid date', 400));
        }
        if (rate.applicable_to.getTime() <= rate.applicable_from.getTime()) {
          return next(new AppError('applicable_to must be after applicable_from', 400));
        }
      }
      
      seenHeaderIds.add(rate.header_id.toString());
    }

    // Check if commission master already exists
    let commissionMaster = await CommissionMaster.findOne({
      subdealer_id,
      model_id
    });

    const historyEntries = [];
    const currentDate = new Date();

    if (commissionMaster) {
      // Track changes for history
      const currentRates = commissionMaster.commission_rates || [];
      
      // Check for changes in each rate
      for (const newRate of commission_rates) {
        const existingRate = currentRates.find(r => 
          r.header_id.toString() === newRate.header_id.toString()
        );

        if (existingRate) {
          // Rate exists, check if it changed
          const isRateChanged = existingRate.commission_rate !== newRate.commission_rate;
          const existingFromTime = existingRate.applicable_from ? existingRate.applicable_from.getTime() : null;
          const newFromTime = newRate.applicable_from ? newRate.applicable_from.getTime() : null;
          const isFromDateChanged = existingFromTime !== newFromTime;
          
          const existingToTime = existingRate.applicable_to ? existingRate.applicable_to.getTime() : null;
          const newToTime = newRate.applicable_to ? newRate.applicable_to.getTime() : null;
          const isToDateChanged = existingToTime !== newToTime;
          
          if (isRateChanged || isFromDateChanged || isToDateChanged) {
            historyEntries.push({
              header_id: existingRate.header_id,
              commission_rate: newRate.commission_rate,
              is_active: newRate.is_active !== false,
              applicable_from: newRate.applicable_from,
              applicable_to: newRate.applicable_to,
              changed_by: req.user.id,
              change_type: 'UPDATED',
              previous_value: existingRate.commission_rate,
              previous_from: existingRate.applicable_from,
              previous_to: existingRate.applicable_to,
              changed_at: currentDate
            });
          }
        } else {
          // New rate
          historyEntries.push({
            header_id: newRate.header_id,
            commission_rate: newRate.commission_rate,
            is_active: newRate.is_active !== false,
            applicable_from: newRate.applicable_from,
            applicable_to: newRate.applicable_to,
            changed_by: req.user.id,
            change_type: 'CREATED',
            previous_value: null,
            previous_from: null,
            previous_to: null,
            changed_at: currentDate
          });
        }
      }

      // Check for removed rates
      for (const existingRate of currentRates) {
        const stillExists = commission_rates.some(newRate => 
          newRate.header_id.toString() === existingRate.header_id.toString()
        );

        if (!stillExists) {
          historyEntries.push({
            header_id: existingRate.header_id,
            commission_rate: 0,
            is_active: false,
            applicable_from: currentDate,
            applicable_to: null,
            changed_by: req.user.id,
            change_type: 'DEACTIVATED',
            previous_value: existingRate.commission_rate,
            previous_from: existingRate.applicable_from,
            previous_to: existingRate.applicable_to,
            changed_at: currentDate
          });
        }
      }

      // Update existing commission master with history
      commissionMaster.commission_rates = commission_rates;
      commissionMaster.updated_by = req.user.id;
      commissionMaster.updated_at = currentDate;
      
      // Add history entries
      if (historyEntries.length > 0) {
        if (!commissionMaster.rate_history) {
          commissionMaster.rate_history = [];
        }
        commissionMaster.rate_history.push(...historyEntries);
      }
    } else {
      // Create new commission master with initial history
      const historyEntries = commission_rates.map(rate => ({
        header_id: rate.header_id,
        commission_rate: rate.commission_rate,
        is_active: rate.is_active !== false,
        applicable_from: rate.applicable_from,
        applicable_to: rate.applicable_to,
        changed_by: req.user.id,
        change_type: 'CREATED',
        previous_value: null,
        previous_from: null,
        previous_to: null,
        changed_at: currentDate
      }));

      commissionMaster = new CommissionMaster({
        subdealer_id,
        model_id,
        commission_rates,
        created_by: req.user.id,
        rate_history: historyEntries,
        created_at: currentDate,
        updated_at: currentDate
      });
    }

    await commissionMaster.save();

    // Populate details for response
    await commissionMaster.populate([
      { path: 'subdealer_details', select: 'name location type' },
      { path: 'model_details', select: 'model_name type' },
      { path: 'created_by_details', select: 'name email' },
      { path: 'commission_rates.header_id', select: 'header_key category_key' },
      { path: 'rate_history.header_id', select: 'header_key category_key' },
      { path: 'rate_history.changed_by', select: 'name email' }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        commission_master: commissionMaster
      }
    });
  } catch (err) {
    logger.error(`Error creating/updating commission master: ${err.message}`);
    next(err);
  }
};
// Get commission master by subdealer and model
exports.getCommissionMaster = async (req, res, next) => {
  try {
    const { subdealer_id, model_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subdealer_id) || !mongoose.Types.ObjectId.isValid(model_id)) {
      return next(new AppError('Invalid subdealer or model ID', 400));
    }

    const commissionMaster = await CommissionMaster.findOne({
      subdealer_id,
      model_id,
      is_active: true
    }).populate([
      { path: 'subdealer_details', select: 'name location type status' },
      { path: 'model_details', select: 'model_name type status' },
      { path: 'commission_rates.header_id', select: 'header_key category_key priority' },
      { path: 'created_by_details', select: 'name email' }
    ]);

    if (!commissionMaster) {
      return next(new AppError('Commission master not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        commission_master: commissionMaster
      }
    });
  } catch (err) {
    logger.error(`Error getting commission master: ${err.message}`);
    next(err);
  }
};

// Get all commission masters for a subdealer
// Fix the getCommissionMastersBySubdealer method
// Fix the getCommissionMastersBySubdealer method
exports.getCommissionMastersBySubdealer = async (req, res, next) => {
  try {
    const { subdealer_id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(subdealer_id)) {
      return next(new AppError('Invalid subdealer ID', 400));
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Use parallel execution for better performance
    const [subdealerExists, commissionMasters, total] = await Promise.all([
      Subdealer.exists({ _id: subdealer_id }),
      CommissionMaster.find({
        subdealer_id,
        is_active: true
      })
        .populate([
          { 
            path: 'model_details', 
            select: 'model_name type status' 
          },
          { 
            path: 'commission_rates.header_id', 
            select: 'header_key category_key priority' 
          }
        ])
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for faster queries
      CommissionMaster.countDocuments({
        subdealer_id,
        is_active: true
      })
    ]);

    if (!subdealerExists) {
      return next(new AppError('Subdealer not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        commission_masters: commissionMasters,
        pagination: {
          total,
          pages: Math.ceil(total / limitNum),
          page: pageNum,
          limit: limitNum,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (err) {
    logger.error(`Error getting commission masters by subdealer: ${err.message}`);
    next(err);
  }
};

// Get all commission masters for a model
exports.getCommissionMastersByModel = async (req, res, next) => {
  try {
    const { model_id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(model_id)) {
      return next(new AppError('Invalid model ID', 400));
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Check if model exists
    const modelExists = await Model.exists({ _id: model_id });
    if (!modelExists) {
      return next(new AppError('Model not found', 404));
    }

    const commissionMasters = await CommissionMaster.find({
      model_id,
      is_active: true
    })
      .populate([
        { path: 'subdealer_details', select: 'name location type status' },
        { path: 'created_by_details', select: 'name email' }
      ])
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await CommissionMaster.countDocuments({
      model_id,
      is_active: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        commission_masters: commissionMasters,
        pagination: {
          total,
          pages: Math.ceil(total / limitNum),
          page: pageNum,
          limit: limitNum,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (err) {
    logger.error(`Error getting commission masters by model: ${err.message}`);
    next(err);
  }
};

// Get available headers for commission setup
exports.getAvailableHeaders = async (req, res, next) => {
  try {
    const { model_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(model_id)) {
      return next(new AppError('Invalid model ID', 400));
    }

    // Get model to determine type
    const model = await Model.findById(model_id).select('type');
    if (!model) {
      return next(new AppError('Model not found', 404));
    }

    // Get headers for this model type (exclude discount headers as they typically don't get commission)
    const headers = await Header.find({
      type: model.type,
      is_discount: false
    }).select('header_key category_key priority is_mandatory metadata')
      .sort({ category_key: 1, priority: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        headers,
        model_type: model.type
      }
    });
  } catch (err) {
    logger.error(`Error getting available headers: ${err.message}`);
    next(err);
  }
};

// Toggle commission master status
exports.toggleCommissionMasterStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid commission master ID', 400));
    }

    if (typeof is_active !== 'boolean') {
      return next(new AppError('is_active must be a boolean', 400));
    }

    const commissionMaster = await CommissionMaster.findByIdAndUpdate(
      id,
      {
        is_active,
        updated_by: req.user.id,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'subdealer_details', select: 'name location type' },
      { path: 'model_details', select: 'model_name type' }
    ]);

    if (!commissionMaster) {
      return next(new AppError('Commission master not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        commission_master: commissionMaster
      }
    });
  } catch (err) {
    logger.error(`Error toggling commission master status: ${err.message}`);
    next(err);
  }
};


// Delete commission master
exports.deleteCommissionMaster = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid commission master ID', 400));
    }

    const commissionMaster = await CommissionMaster.findByIdAndDelete(id);

    if (!commissionMaster) {
      return next(new AppError('Commission master not found', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting commission master: ${err.message}`);
    next(err);
  }
};

// Export CSV template
// Export CSV template (without prices)
exports.exportCommissionCSVTemplate = async (req, res, next) => {
  try {
    const { subdealer_id, model_type } = req.query;

    // Validate inputs
    if (!subdealer_id) {
      return next(new AppError('Subdealer ID is required', 400));
    }
    if (!model_type) {
      return next(new AppError('Model type is required', 400));
    }

    // Validate subdealer exists
    const subdealer = await Subdealer.findById(subdealer_id);
    if (!subdealer) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Get all models of the specified type
    const models = await Model.find({
      type: model_type.toUpperCase(),
      status: 'active'
    }).lean();

    if (models.length === 0) {
      return next(new AppError(`No ${model_type} models found`, 404));
    }

    // Get all headers for this model type (non-discount headers)
    const headers = await Header.find({
      type: model_type.toUpperCase(),
      is_discount: false
    }).select('header_key category_key').lean();

    if (headers.length === 0) {
      return next(new AppError(`No headers found for model type ${model_type}`, 404));
    }

    // Prepare CSV data - REMOVED PRICE COLUMNS
    const csvData = [
      ['Subdealer', subdealer.name, ...Array(headers.length - 1).fill('')],
      ['Type', model_type.toUpperCase(), ...Array(headers.length - 1).fill('')],
      [
        'Record Type', 
        'model_name',
        'model_type',
        ...headers.map(h => `${h.header_key}|${h.category_key}`)
      ]
    ];

    // Add model rows with commission template
    models.forEach(model => {
      // Commission row (template with 0 values)
      const commissionRow = ['COMMISSION', model.model_name, model.type];
      headers.forEach(() => {
        commissionRow.push('0'); // Default commission rate of 0
      });
      
      csvData.push(commissionRow);
      
      // Empty row for separation
      csvData.push(Array(headers.length + 3).fill(''));
    });

    // Generate CSV
    const stringifier = stringify({
      header: false,
      delimiter: ',',
      quoted: true,
      quoted_empty: true,
      bom: true
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${subdealer.name.replace(/\s+/g, '_')}_${model_type}_Commission_Template_${Date.now()}.csv`
    );

    stringifier.pipe(res);
    csvData.forEach(row => stringifier.write(row));
    stringifier.end();

  } catch (err) {
    logger.error(`Commission CSV Export Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to generate commission CSV template. Please try again.', 500));
  }
};


// Import CSV
// Import CSV with history tracking
// Import CSV (updated to work with the new export format without prices)
exports.importCommissionCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No CSV file uploaded', 400));
    }

    const { subdealer_id } = req.body;
    if (!subdealer_id) {
      return next(new AppError('Subdealer ID is required', 400));
    }

    // Validate subdealer exists
    const subdealer = await Subdealer.findById(subdealer_id);
    if (!subdealer) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Parse CSV
    const csvData = [];
    const errors = [];
    
    await new Promise((resolve, reject) => {
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null);

      bufferStream
        .pipe(csv({ headers: false }))
        .on('data', (row) => csvData.push(Object.values(row)))
        .on('end', resolve)
        .on('error', reject);
    });

    // Find header row
    const headerRowIndex = csvData.findIndex(row => row[0]?.toLowerCase() === 'record type');
    if (headerRowIndex === -1) {
      return next(new AppError('CSV is missing required header row with "Record Type"', 400));
    }

    const headerRow = csvData[headerRowIndex];
    const dataRows = csvData.slice(headerRowIndex + 1);

    // Extract headers (starting from column 3 as before, but now without price columns)
    const headers = [];
    for (let i = 3; i < headerRow.length; i++) {
      const headerCol = headerRow[i];
      if (!headerCol) continue;
      headers.push({
        index: i,
        header: headerCol
      });
    }

    // Get all headers for mapping
    const allHeaders = await Header.find().lean();
    const headerMap = new Map();
    
    allHeaders.forEach(header => {
      const key = `${header.header_key}|${header.category_key}`;
      headerMap.set(key, header._id.toString());
    });

    // Process commission rows
    const bulkOperations = [];
    const processedModels = new Set();
    const modelCommissionMap = new Map();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const recordType = row[0]?.trim();
      const modelName = row[1]?.trim();
      const modelType = row[2]?.trim();
      
      if (!recordType || !modelName || modelName === '') continue;
      
      if (recordType === 'COMMISSION') {
        const commissionRates = [];
        
        for (const header of headers) {
          const headerId = headerMap.get(header.header);
          if (!headerId) {
            errors.push(`Header '${header.header}' not found`);
            continue;
          }

          const commissionValue = cleanValue(row[header.index]);
          if (commissionValue === null || isNaN(commissionValue)) {
            errors.push(`Invalid commission value for ${modelName} at column ${header.index}`);
            continue;
          }
          
          const commissionRate = Number(commissionValue);
          if (commissionRate < 0 || commissionRate > 100) {
            errors.push(`Commission rate must be between 0-100 for ${modelName} at column ${header.index}`);
            continue;
          }
          
          commissionRates.push({
            header_id: new mongoose.Types.ObjectId(headerId),
            commission_rate: commissionRate,
            is_active: true,
            applicable_from: new Date(),
            applicable_to: null
          });
        }
        
        // Store commission rates for this model
        modelCommissionMap.set(`${modelName}|${modelType}`, commissionRates);
      }
    }

    // Process all models with commission data
    for (const [modelKey, commissionRates] of modelCommissionMap.entries()) {
      const [modelName, modelType] = modelKey.split('|');
      
      // Find model by name and type
      const model = await Model.findOne({
        model_name: modelName,
        type: modelType.toUpperCase()
      });
      
      if (!model) {
        errors.push(`Model '${modelName}' with type '${modelType}' not found`);
        continue;
      }

      // Create history entries for the import
      const historyEntries = commissionRates.map(rate => ({
        header_id: rate.header_id,
        commission_rate: rate.commission_rate,
        is_active: rate.is_active,
        applicable_from: rate.applicable_from,
        applicable_to: rate.applicable_to,
        changed_by: new mongoose.Types.ObjectId(req.user.id),
        change_type: 'CREATED',
        previous_value: null,
        changed_at: new Date()
      }));

      // Add to bulk operations with history
      bulkOperations.push({
        updateOne: {
          filter: {
            subdealer_id: new mongoose.Types.ObjectId(subdealer_id),
            model_id: model._id
          },
          update: {
            $set: {
              commission_rates: commissionRates,
              updated_by: new mongoose.Types.ObjectId(req.user.id),
              updated_at: new Date()
            },
            $push: {
              rate_history: {
                $each: historyEntries
              }
            },
            $setOnInsert: {
              created_by: new mongoose.Types.ObjectId(req.user.id),
              created_at: new Date(),
              is_active: true
            }
          },
          upsert: true
        }
      });

      processedModels.add(model._id.toString());
    }
    
    // Execute bulk operations
    if (bulkOperations.length > 0) {
      await CommissionMaster.bulkWrite(bulkOperations, { ordered: false });
    }

    res.status(200).json({
      status: 'success',
      message: `Commission CSV import completed for subdealer: ${subdealer.name}`,
      imported: processedModels.size,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    logger.error(`Commission CSV Import Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to process commission CSV import. Please check the file format.', 500));
  }
};

// Calculate commission for a subdealer based on bookings
// Calculate commission for a subdealer based on bookings
// exports.calculateSubdealerCommission = async (req, res, next) => {
//   try {
//     const { subdealer_id } = req.params;

//     // Fetch bookings for this subdealer
//     const bookings = await Booking.find({ subdealer: subdealer_id })
//       .populate([
//         { path: "model", select: "model_name" },
//         { path: "priceComponents.header", select: "header_key" }
//       ])
//       .lean();

//     const bookingCommissions = [];
//     let overallCommission = 0; // ✅ Track total for all bookings

//     for (const booking of bookings) {
//       const commissionMaster = await CommissionMaster.findOne({
//         subdealer_id,
//         model_id: booking.model?._id
//       }).populate("commission_rates.header_id");

//       let bookingCommissionTotal = 0;
//       const breakdown = [];

//       if (commissionMaster && booking.priceComponents?.length) {
//         for (const component of booking.priceComponents) {
//           const rateObj = commissionMaster.commission_rates.find(r => {
//             return (
//               r.header_id &&
//               component.header &&
//               r.header_id._id.toString() === component.header._id.toString()
//             );
//           });

//           const base =
//             component.discountedValue || component.originalValue || 0;
//           const rate = rateObj ? rateObj.commission_rate : 0;
//           const commission = +(base * rate / 100).toFixed(2);

//           bookingCommissionTotal += commission;

//           breakdown.push({
//             header_id: component.header?._id,
//             header_key: component.header?.header_key,
//             base,
//             rate,
//             commission
//           });
//         }
//       }

//       // Push booking-wise commission
//       bookingCommissions.push({
//         booking_id: booking._id,
//         booking_number: booking.bookingNumber,
//         model: booking.model?.model_name,
//         booking_date: booking.createdAt,
//         customer_name: booking.customerDetails?.name,
//         total_amount: booking.discountedAmount,
//         commission_breakdown: breakdown,
//         total_commission: +bookingCommissionTotal.toFixed(2)
//       });

//       overallCommission += bookingCommissionTotal;
//     }

//     // ✅ Response with overall commission
//     res.status(200).json({
//       status: "success",
//       data: {
//         subdealer: { _id: subdealer_id },
//         total_bookings: bookings.length,
//         overall_commission: +overallCommission.toFixed(2),
//         booking_commissions: bookingCommissions
//       }
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// Update the calculateSubdealerCommission method in commissionMasterController.js

// Calculate commission for a subdealer based on bookings with date range consideration
exports.calculateSubdealerCommission = async (req, res, next) => {
  try {
    const { subdealer_id } = req.params;
    const { start_date, end_date } = req.query;

    // Parse date filters if provided
    let dateFilter = {};
    if (start_date || end_date) {
      dateFilter.createdAt = {};
      if (start_date) dateFilter.createdAt.$gte = new Date(start_date);
      if (end_date) dateFilter.createdAt.$lte = new Date(end_date);
    }

    // Fetch bookings for this subdealer with date filter
    const bookings = await Booking.find({ 
      subdealer: subdealer_id,
      ...dateFilter
    })
      .populate([
        { path: "model", select: "model_name" },
        { path: "priceComponents.header", select: "header_key" }
      ])
      .lean();

    const bookingCommissions = [];
    let overallCommission = 0;

    for (const booking of bookings) {
      const commissionMaster = await CommissionMaster.findOne({
        subdealer_id,
        model_id: booking.model?._id
      }).populate("commission_rates.header_id");

      let bookingCommissionTotal = 0;
      const breakdown = [];

      if (commissionMaster && booking.priceComponents?.length) {
        for (const component of booking.priceComponents) {
          // Find the applicable commission rate for this header at the booking date
          const applicableRates = commissionMaster.commission_rates.filter(r => {
            if (!r.header_id || !component.header) return false;
            
            const headerMatch = r.header_id._id.toString() === component.header._id.toString();
            const dateMatch = booking.createdAt >= r.applicable_from && 
                            (!r.applicable_to || booking.createdAt <= r.applicable_to);
            
            return headerMatch && dateMatch && r.is_active;
          });

          // Use the most recent rate (highest applicable_from) if multiple rates found
          const rateObj = applicableRates.length > 0 
            ? applicableRates.sort((a, b) => b.applicable_from - a.applicable_from)[0]
            : null;

          const base = component.discountedValue || component.originalValue || 0;
          const rate = rateObj ? rateObj.commission_rate : 0;
          const commission = +(base * rate / 100).toFixed(2);

          bookingCommissionTotal += commission;

          breakdown.push({
            header_id: component.header?._id,
            header_key: component.header?.header_key,
            base,
            rate,
            commission,
            applicable_from: rateObj ? rateObj.applicable_from : null,
            applicable_to: rateObj ? rateObj.applicable_to : null
          });
        }
      }
   
      // Push booking-wise commission
      bookingCommissions.push({
        booking_id: booking._id,
        booking_number: booking.bookingNumber,
        model: booking.model?.model_name,
        booking_date: booking.createdAt,
        customer_name: booking.customerDetails?.name,
        total_amount: booking.discountedAmount,
        commission_breakdown: breakdown,
        total_commission: +bookingCommissionTotal.toFixed(2)
      });

      overallCommission += bookingCommissionTotal;
    }

    // Response with overall commission
    res.status(200).json({
      status: "success",
      data: {
        subdealer: { _id: subdealer_id },
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        },
        total_bookings: bookings.length,
        overall_commission: +overallCommission.toFixed(2),
        booking_commissions: bookingCommissions
      }
    });
  } catch (err) {
    next(err);
  }
};
// Add this method to commissionMasterController.js

// Set commission rates for a specific date range
// Update the setCommissionDateRange method
// Update the setCommissionDateRange method
exports.setCommissionDateRange = async (req, res, next) => {
  try {
    const { subdealer_id } = req.params;
    const { fromDate, toDate } = req.body;

    if (!fromDate) {
      return res.status(400).json({ status: 'error', message: 'fromDate is required' });
    }

    // Validate and parse dates
    const fromDateObj = new Date(fromDate);
    if (isNaN(fromDateObj.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid fromDate format' });
    }

    let toDateObj = null;
    if (toDate) {
      toDateObj = new Date(toDate);
      if (isNaN(toDateObj.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid toDate format' });
      }
    }

    const currentDate = new Date();

    // Get all commission masters for this subdealer
    const commissionMasters = await CommissionMaster.find({ subdealer_id });

    if (commissionMasters.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No commission master found for this subdealer' });
    }

    // Update each commission master with proper history tracking
    for (const commissionMaster of commissionMasters) {
      const historyEntries = [];
      
      for (const rate of commissionMaster.commission_rates) {
        // Check if dates are actually changing
        const isFromDateChanged = rate.applicable_from.getTime() !== fromDateObj.getTime();
        const currentToDate = rate.applicable_to ? rate.applicable_to.getTime() : null;
        const newToDate = toDateObj ? toDateObj.getTime() : null;
        const isToDateChanged = currentToDate !== newToDate;
        
        if (isFromDateChanged || isToDateChanged) {
          historyEntries.push({
            header_id: rate.header_id,
            commission_rate: rate.commission_rate,
            is_active: rate.is_active,
            applicable_from: fromDateObj,
            applicable_to: toDateObj,
            changed_by: req.user.id,
            change_type: 'UPDATED',
            previous_value: rate.commission_rate,
            previous_from: rate.applicable_from,
            previous_to: rate.applicable_to,
            changed_at: currentDate
          });
        }
        
        // Update the rate dates
        rate.applicable_from = fromDateObj;
        rate.applicable_to = toDateObj;
      }
      
      // Add history entries if any changes were made
      if (historyEntries.length > 0) {
        if (!commissionMaster.rate_history) {
          commissionMaster.rate_history = [];
        }
        commissionMaster.rate_history.push(...historyEntries);
        commissionMaster.updated_by = req.user.id;
        commissionMaster.updated_at = currentDate;
        
        await commissionMaster.save();
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Commission date range updated successfully',
      data: {
        updated_count: commissionMasters.length
      }
    });
  } catch (err) {
    next(err);
  }
};
// commissionMasterController.js
exports.getMonthlyCommissionReport = async (req, res, next) => {
  try {
    const { subdealer_id } = req.params;
    const { year, month } = req.query; // month = 1-12

    if (!year || !month) {
      return res.status(400).json({ status: 'fail', message: 'Year and month are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await Booking.find({
      subdealer: subdealer_id,
      createdAt: { $gte: startDate, $lte: endDate }
    })
      .populate([
        { path: 'model', select: 'model_name' },
        { path: 'priceComponents.header', select: 'header_key' }
      ])
      .lean();

    let totalCommission = 0;
    const bookingCommissions = [];

    for (const booking of bookings) {
      const commissionMaster = await CommissionMaster.findOne({
        subdealer_id,
        model_id: booking.model?._id
      }).populate('commission_rates.header_id');

      let bookingCommissionTotal = 0;
      const breakdown = [];

      if (commissionMaster && booking.priceComponents) {
        for (const component of booking.priceComponents) {
          // Find all applicable commission rates for this header at the booking date
          const applicableRates = commissionMaster.commission_rates.filter(r => {
            if (!r.header_id || !component.header) return false;
            
            const headerMatch = r.header_id._id.toString() === component.header._id.toString();
            if (!headerMatch || !r.is_active) return false;
            
            const bookingDate = new Date(booking.createdAt);
            const applicableFrom = new Date(r.applicable_from);
            const applicableTo = r.applicable_to ? new Date(r.applicable_to) : null;
            
            // Check if booking date falls within the rate's applicable period
            const dateMatch = bookingDate >= applicableFrom && 
                            (!applicableTo || bookingDate <= applicableTo);
            
            return dateMatch;
          });

          // Use the most recent rate (highest applicable_from) if multiple rates found
          const rateObj = applicableRates.length > 0 
            ? applicableRates.sort((a, b) => 
                new Date(b.applicable_from) - new Date(a.applicable_from)
              )[0]
            : null;

          if (rateObj) {
            const base = component.discountedValue || component.originalValue || 0;
            const commission = (base * rateObj.commission_rate) / 100;
            bookingCommissionTotal += commission;
            breakdown.push({
              header: component.header.header_key,
              base,
              rate: rateObj.commission_rate,
              commission
            });
          }
        }
      }

      totalCommission += bookingCommissionTotal;

      bookingCommissions.push({
        booking_id: booking._id,
        booking_number: booking.bookingNumber,
        model: booking.model?.model_name,
        booking_date: booking.createdAt,
        customer_name: booking.customerDetails?.name,
        total_amount: booking.discountedAmount,
        commission_breakdown: breakdown,
        total_commission: bookingCommissionTotal
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer: { _id: subdealer_id },
        month,
        year,
        total_bookings: bookings.length,
        total_commission: totalCommission,
        booking_commissions: bookingCommissions
      }
    });
  } catch (err) {
    next(err);
  }
};



