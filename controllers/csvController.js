const csv = require('csv-parser');
const { Readable } = require('stream');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Branch = require('../models/Branch');
const Subdealer = require('../models/Subdealer');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const { stringify } = require('csv-stringify');

// Helper function to clean and normalize values
const cleanValue = (value) => {
  if (value === null || value === undefined) return null;
  const strValue = value.toString().trim();
  if (strValue === '') return null;

  const numValue = parseFloat(strValue.replace(/,/g, ''));
  return isNaN(numValue) ? strValue : numValue;
};

// Helper to normalize header keys (case/space insensitive)
const normalizeHeaderKey = (header) => {
  return `${header.header_key.toLowerCase().replace(/\s+/g, '')}|${
    header.category_key.toLowerCase().replace(/\s+/g, '')
  }`;
};

exports.exportCSVTemplate = async (req, res, next) => {
  try {
    // Validate inputs
    const { type, branch_id, subdealer_id } = req.query;
    if (!type || !['EV', 'ICE', 'CSD'].includes(type.toUpperCase())) {
      return next(new AppError('Vehicle type (EV/ICE/CSD) is required', 400));
    }
    if (!branch_id && !subdealer_id) {
      return next(new AppError('Either branch_id or subdealer_id is required', 400));
    }
    if (branch_id && subdealer_id) {
      return next(new AppError('Cannot specify both branch_id and subdealer_id', 400));
    }

    const normalizedType = type.toUpperCase();
    let reference, referenceType, referenceName;

    // Get reference (branch or subdealer)
    if (branch_id) {
      reference = await Branch.findById(branch_id);
      referenceType = 'branch';
    } else {
      reference = await Subdealer.findById(subdealer_id);
      referenceType = 'subdealer';
    }

    if (!reference) {
      return next(new AppError(`${referenceType} not found`, 404));
    }
    referenceName = reference.name;

    // Get all ACTIVE headers and remove duplicates
    const activeHeaders = await Header.find({ type: normalizedType })
      .sort({ priority: 1 })
      .lean();

    const uniqueHeaders = [];
    const headerKeys = new Set();

    activeHeaders.forEach(header => {
      const key = normalizeHeaderKey(header);
      if (!headerKeys.has(key)) {
        headerKeys.add(key);
        uniqueHeaders.push(header);
      }
    });

    // Get models with prices and remove duplicates
    const models = await Model.find({
      type: normalizedType,
      status: 'active'
    })
    .populate({
      path: 'prices.header_id',
      select: '_id header_key category_key'
    })
    .populate({
      path: referenceType === 'branch' ? 'prices.branch_id' : 'prices.subdealer_id',
      match: { _id: reference._id },
      select: '_id name'
    })
    .lean();

    models.forEach(model => {
      const priceMap = new Map();
      model.prices = model.prices.filter(price => {
        if (!price.header_id || !price[`${referenceType}_id`]) return false;
        
        const key = `${price.header_id._id}|${price[`${referenceType}_id`]._id}`;
        if (!priceMap.has(key)) {
          priceMap.set(key, true);
          return true;
        }
        return false;
      });
    });

    // Prepare CSV data
    const csvData = [
      [referenceType === 'branch' ? 'Branch' : 'Subdealer', referenceName, ...Array(uniqueHeaders.length - 1).fill('')],
      ['Type', normalizedType, ...Array(uniqueHeaders.length - 1).fill('')],
      [
        'model_name', 
        ...uniqueHeaders.map(h => `${h.header_key}|${h.category_key}`)
      ],
      ...models.map(model => [
        model.model_name,
        ...uniqueHeaders.map(header => {
          const price = model.prices.find(p => 
            p.header_id?._id.toString() === header._id.toString() && 
            p[`${referenceType}_id`]?._id?.toString() === reference._id.toString()
          );
          return price?.value ?? '0';
        })
      ])
    ];

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
      `attachment; filename=${referenceName.replace(/\s+/g, '_')}_${normalizedType}_${Date.now()}.csv`
    );

    stringifier.pipe(res);
    csvData.forEach(row => stringifier.write(row));
    stringifier.end();

  } catch (err) {
    logger.error(`CSV Export Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to generate CSV export. Please try again.', 500));
  }
};

exports.importCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No CSV file uploaded', 400));
    }

    // Validate inputs
    const { branch_id, subdealer_id, type } = req.body;
    if (!type || !['EV', 'ICE', 'CSD'].includes(type.toUpperCase())) {
      return next(new AppError('Valid vehicle type (EV/ICE/CSD) required', 400));
    }
    if (!branch_id && !subdealer_id) {
      return next(new AppError('Either branch_id or subdealer_id is required', 400));
    }
    if (branch_id && subdealer_id) {
      return next(new AppError('Cannot specify both branch_id and subdealer_id', 400));
    }

    const normalizedType = type.toUpperCase();
    let reference, referenceType, referenceName;

    // Get reference (branch or subdealer)
    if (branch_id) {
      reference = await Branch.findById(branch_id);
      referenceType = 'branch';
    } else {
      reference = await Subdealer.findById(subdealer_id);
      referenceType = 'subdealer';
    }

    if (!reference) {
      return next(new AppError(`${referenceType} not found`, 404));
    }
    referenceName = reference.name;

    // Get all current headers for reference
    const currentHeaders = await Header.find({ type: normalizedType });
    const headerMap = new Map(
      currentHeaders.map(h => [
        normalizeHeaderKey(h), 
        h._id
      ])
    );

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
    const headerRowIndex = csvData.findIndex(row => row[0]?.toLowerCase() === 'model_name');
    if (headerRowIndex === -1) {
      return next(new AppError('CSV is missing required header row', 400));
    }

    const headerRow = csvData[headerRowIndex];
    const dataRows = csvData.slice(headerRowIndex + 1);

    // Process each model
    for (const row of dataRows) {
      const modelName = row[0]?.trim();
      if (!modelName || modelName === 'SampleModel') continue;

      try {
        let model = await Model.findOne({ model_name: modelName }) || 
          new Model({
            model_name: modelName,
            type: normalizedType,
            status: 'active',
            prices: []
          });

        // Clear existing prices for this reference
        model.prices = model.prices.filter(p => 
          !p[`${referenceType}_id`]?.equals(reference._id)
        );

        // Process each column
        for (let i = 1; i < headerRow.length; i++) {
          const headerValue = headerRow[i]?.trim();
          if (!headerValue) continue;

          const value = cleanValue(row[i]);
          if (value === null) continue;

          // Find header ID using normalized key
          const headerParts = headerValue.split('|');
          if (headerParts.length !== 2) continue;
          
          const fakeHeader = {
            header_key: headerParts[0],
            category_key: headerParts[1]
          };
          const headerId = headerMap.get(normalizeHeaderKey(fakeHeader));
          
          if (headerId && !isNaN(value)) {
            model.prices.push({
              value: Number(value),
              header_id: headerId,
              [referenceType === 'branch' ? 'branch_id' : 'subdealer_id']: reference._id
            });
          }
        }

        await model.save({ validateBeforeSave: false });
      } catch (err) {
        errors.push(`Failed to process ${modelName}: ${err.message}`);
        logger.error(`Import Error for ${modelName}: ${err.message}`);
      }
    }

    res.status(200).json({
      status: 'success',
      message: `CSV import completed for ${referenceType}: ${referenceName}`,
      imported: dataRows.length - errors.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    logger.error(`CSV Import Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to process CSV import. Please check the file format.', 500));
  }
};