const ExcelJS = require('exceljs');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Branch = require('../models/Branch');
const Subdealer = require('../models/Subdealer');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

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

// Generate Excel workbook
const generateExcelWorkbook = async (worksheetData, referenceName, normalizedType) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Your App Name';
  workbook.lastModifiedBy = 'Your App Name';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  const worksheet = workbook.addWorksheet('Price Template');
  
  // Add metadata rows
  worksheet.addRow([referenceName.type === 'branch' ? 'Branch' : 'Subdealer', referenceName.name, ...Array(worksheetData.headers.length - 1).fill('')]);
  worksheet.addRow(['Type', normalizedType, ...Array(worksheetData.headers.length - 1).fill('')]);
  
  // Add header row
  worksheet.addRow(['model_name', ...worksheetData.headers.map(h => `${h.header_key}|${h.category_key}`)]);
  
  // Add data rows
  worksheetData.models.forEach(model => {
    worksheet.addRow([
      model.model_name,
      ...worksheetData.headers.map(header => {
        const price = model.prices.find(p => 
          p.header_id?._id.toString() === header._id.toString() && 
          p[`${referenceName.type}_id`]?._id?.toString() === referenceName.id.toString()
        );
        return price?.value ?? 0;
      })
    ]);
  });
  
  // Style the header row (row 3)
  const headerRow = worksheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Set column widths
  worksheet.columns = [
    { width: 30 }, // model_name column
    ...worksheetData.headers.map(() => ({ width: 20 })) // price columns
  ];
  
  return workbook;
};

exports.exportExcelTemplate = async (req, res, next) => {
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
    let reference, referenceType;

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

    // Prepare Excel data
    const excelData = {
      headers: uniqueHeaders,
      models: models,
      reference: {
        type: referenceType,
        id: reference._id,
        name: reference.name
      }
    };

    // Generate Excel workbook
    const workbook = await generateExcelWorkbook(excelData, {
      type: referenceType,
      name: reference.name,
      id: reference._id
    }, normalizedType);
    
    // Create safe filename without special characters
    const safeFilename = `${reference.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${normalizedType}_${Date.now()}.xlsx`;
    
    // Set headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the Excel file
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    logger.error(`Excel Export Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to generate Excel export. Please try again.', 500));
  }
};

exports.importExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No Excel file uploaded', 400));
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
    let reference, referenceType;

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

    // Get all current headers for reference
    const currentHeaders = await Header.find({ type: normalizedType });
    const headerMap = new Map(
      currentHeaders.map(h => [
        normalizeHeaderKey(h), 
        h._id
      ])
    );

    // Parse Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return next(new AppError('Excel file does not contain any worksheets', 400));
    }

    const errors = [];
    const dataRows = [];
    
    // Extract data from Excel (skip first two metadata rows)
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 2) { // Skip metadata rows
        const rowData = row.values.slice(1); // ExcelJS includes empty first element
        dataRows.push(rowData);
      }
    });

    // Find header row (should be row 3)
    const headerRow = dataRows[0] || [];
    if (!headerRow[0] || headerRow[0].toString().toLowerCase().trim() !== 'model_name') {
      return next(new AppError('Excel file is missing required "model_name" header', 400));
    }

    // Process each model (skip header row)
    for (let i = 1; i < dataRows.length; i++) {
      const row = dataRows[i];
      const modelName = row[0]?.toString().trim();
      if (!modelName || modelName === 'SampleModel') continue;

      try {
        let model = await Model.findOne({ 
          model_name: modelName,
          type: normalizedType 
        }) || new Model({
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
        for (let j = 1; j < headerRow.length; j++) {
          const headerValue = headerRow[j]?.toString().trim();
          if (!headerValue) continue;

          const value = cleanValue(row[j]);
          if (value === null) continue;

          // Find header ID using normalized key
          const headerParts = headerValue.split('|');
          if (headerParts.length !== 2) {
            errors.push(`Invalid header format: ${headerValue}`);
            continue;
          }
          
          const fakeHeader = {
            header_key: headerParts[0],
            category_key: headerParts[1]
          };
          const headerId = headerMap.get(normalizeHeaderKey(fakeHeader));
          
          if (!headerId) {
            errors.push(`Header not found: ${headerValue}`);
            continue;
          }
          
          if (!isNaN(value)) {
            model.prices.push({
              value: Number(value),
              header_id: headerId,
              [referenceType === 'branch' ? 'branch_id' : 'subdealer_id']: reference._id
            });
          } else {
            errors.push(`Invalid numeric value for ${modelName}: ${headerValue} = ${value}`);
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
      message: `Excel import completed for ${referenceType}: ${reference.name}`,
      imported: dataRows.length - 1 - errors.length, // Subtract header row
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    logger.error(`Excel Import Error: ${err.message}`, { stack: err.stack });
    next(new AppError('Failed to process Excel import. Please check the file format.', 500));
  }
};