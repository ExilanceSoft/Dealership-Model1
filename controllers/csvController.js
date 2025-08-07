const csv = require('csv-parser');
const { Readable } = require('stream');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Branch = require('../models/Branch');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const { stringify } = require('csv-stringify');

// Enhanced cleanValue function with better error handling
const cleanValue = (value) => {
  try {
    if (value === null || value === undefined) return null;
    
    // Ensure value is a string before processing
    const strValue = typeof value === 'string' ? value.trim() : String(value).trim();
    if (strValue === '') return null;
    
    // Try to parse as number
    const numValue = parseFloat(strValue.replace(/,/g, ''));
    if (!isNaN(numValue)) return numValue;
    
    return strValue;
  } catch (err) {
    logger.error(`Error cleaning value: ${value}`, { error: err });
    return null;
  }
};

exports.exportCSVTemplate = async (req, res, next) => {
  try {
    // Validate request query parameters
    const { type, branch_id } = req.query;
    if (!type || !['EV', 'ICE', 'CSD'].includes(type.toUpperCase())) {
      return next(new AppError('Type is required and must be either EV, ICE or CSD', 400));
    }
    if (!branch_id) {
      return next(new AppError('Branch ID is required', 400));
    }

    const normalizedType = type.toUpperCase();

    // Verify branch exists
    const branch = await Branch.findById(branch_id);
    if (!branch) {
      return next(new AppError('Branch not found', 404));
    }

    // Check if branch is active
    if (!branch.is_active) {
      return next(new AppError('Cannot export template for inactive branch', 400));
    }

    // Fetch required data from database
    const [headers, models] = await Promise.all([
      Header.find({ type: normalizedType })
        .sort({ priority: 1 })
        .lean(),
      Model.find({ 
        type: normalizedType,
        status: 'active'
      })
        .populate({
          path: 'prices.header_id',
          model: 'Header',
          select: '_id category_key header_key'
        })
        .populate({
          path: 'prices.branch_id',
          model: 'Branch',
          select: '_id name'
        })
        .lean()
    ]);

    // Prepare CSV data structure
    const csvData = [];

    // 1. Add branch information row
    const branchRow = ['Branch', branch.name];
    // Fill remaining columns with empty values
    for (let i = 2; i < headers.length + 1; i++) {
      branchRow.push('');
    }
    csvData.push(branchRow);

    // 2. Add type row
    const typeRow = ['Type', normalizedType];
    // Fill remaining columns with empty values
    for (let i = 2; i < headers.length + 1; i++) {
      typeRow.push('');
    }
    csvData.push(typeRow);

    // 3. Add headers row (header_key first)
    const headerRow = ['model_name'];
    headers.forEach(header => {
      if (header && header.header_key && header.category_key) {
        headerRow.push(`${header.header_key}|${header.category_key}`);
      }
    });
    csvData.push(headerRow);

    // 4. Add model data rows
    if (models.length > 0) {
      models.forEach(model => {
        if (!model || !model.model_name) return;
        
        const modelRow = [model.model_name];
        headers.forEach(header => {
          if (!header || !header._id) {
            modelRow.push('0');
            return;
          }

          const price = model.prices?.find(p =>
            p?.header_id?._id?.toString() === header._id.toString() &&
            p?.branch_id?._id?.toString() === branch_id.toString()
          );
          modelRow.push(price?.value !== undefined ? price.value : '0');
        });
        csvData.push(modelRow);
      });
    } else {
      // Add sample row if no models exist
      const sampleRow = ['SampleModel'];
      headers.forEach(() => {
        sampleRow.push('0');
      });
      csvData.push(sampleRow);
    }

    // Configure CSV stringifier
    const stringifier = stringify({
      header: false,
      delimiter: ',',
      quoted: true,
      quoted_empty: true,
      quoted_string: true,
      escape: '"',
      bom: true
    });

    // Set response headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${branch.name.replace(/\s+/g, '_')}_${normalizedType}_export_${Date.now()}.csv`
    );

    // Stream CSV to response
    stringifier.pipe(res);

    // Write data to stringifier
    csvData.forEach(row => stringifier.write(row));
    stringifier.end();

  } catch (err) {
    logger.error(`Error exporting CSV template: ${err.message}`, {
      stack: err.stack,
      request: req.body
    });
    next(new AppError('Failed to generate CSV template. Please try again later.', 500));
  }
};

exports.importCSV = async (req, res, next) => {
  try {
    // Enhanced file validation
    if (!req.file) {
      return next(new AppError('Please upload a CSV file', 400));
    }
    
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return next(new AppError('Uploaded file is empty', 400));
    }

    // Validate required fields
    if (!req.body.branch_id) {
      return next(new AppError('Branch ID is required', 400));
    }
    if (!req.body.type || !['EV', 'ICE', 'CSD'].includes(req.body.type.toUpperCase())) {
      return next(new AppError('Type is required and must be EV, ICE or CSD', 400));
    }

    const type = req.body.type.toUpperCase();

    // Verify branch exists
    const branch = await Branch.findById(req.body.branch_id);
    if (!branch) {
      return next(new AppError('Branch not found', 404));
    }

    if (!branch.is_active) {
      return next(new AppError('Cannot import to inactive branch', 400));
    }

    // Get headers for type
    const headers = await Header.find({ type });
    const headerKeyMap = new Map();
    const categoryKeyMap = new Map();
    
    headers.forEach(header => {
      if (header.header_key) headerKeyMap.set(header.header_key, header._id);
      if (header.category_key) categoryKeyMap.set(header.category_key, header._id);
    });

    // Parse CSV with better error handling
    let csvData;
    try {
      const csvString = req.file.buffer.toString('utf8').trim();
      csvData = csvString.split('\n')
        .filter(row => row.trim() !== '') // Remove empty lines
        .map(row => {
          // Handle quoted values and empty cells
          const cells = row.split(',')
            .map(cell => {
              const trimmed = cell.trim();
              return trimmed.replace(/^"|"$/g, '');
            });
          return cells;
        });
    } catch (parseError) {
      logger.error('CSV parsing failed', { error: parseError });
      return next(new AppError('Invalid CSV file format', 400));
    }

    // Validate CSV structure
    if (csvData.length < 3) {
      return next(new AppError('CSV must contain at least branch info, type, and header rows', 400));
    }

    // Find header row
    const headerRowIndex = csvData.findIndex(row => 
      row[0] && row[0].toLowerCase() === 'model_name'
    );
    if (headerRowIndex === -1) {
      return next(new AppError('CSV must contain a header row starting with model_name', 400));
    }

    const headerRow = csvData[headerRowIndex];
    const dataRows = csvData.slice(headerRowIndex + 1);
    const errors = [];
    let processedCount = 0;

    // Process each model row
    for (const row of dataRows) {
      const modelName = row[0] ? row[0].trim() : '';
      if (!modelName || modelName === 'SampleModel') continue;

      try {
        let model = await Model.findOne({ model_name: modelName }) || 
          new Model({ 
            model_name: modelName, 
            type, 
            status: 'active',
            prices: [] 
          });

        // Clear existing prices for this branch
        model.prices = model.prices.filter(p => 
          p && p.branch_id && p.branch_id.equals(branch._id)
        );

        // Process each price column
        for (let i = 1; i < headerRow.length && i < row.length; i++) {
          const cellValue = row[i];
          if (cellValue === undefined || cellValue === null || cellValue === '') continue;

          const headerCell = headerRow[i];
          if (!headerCell) continue;

          const headerParts = headerCell.split('|');
          const headerKey = headerParts[0] ? headerParts[0].trim() : null;
          const categoryKey = headerParts[1] ? headerParts[1].trim() : null;
          const value = cleanValue(cellValue);

          // Find header ID
          let headerId = headerKey ? headerKeyMap.get(headerKey) : null;
          if (!headerId && categoryKey) {
            headerId = categoryKeyMap.get(categoryKey);
          }

          if (headerId && value !== null) {
            model.prices.push({
              value: value,
              header_id: headerId,
              branch_id: branch._id
            });
          }
        }

        await model.save();
        processedCount++;
      } catch (modelError) {
        const errorMsg = `Error processing model ${modelName}: ${modelError.message}`;
        errors.push(errorMsg);
        logger.error(errorMsg, { error: modelError });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'CSV import completed',
      imported: processedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    logger.error('CSV import failed', { 
      error: err.message,
      stack: err.stack,
      request: {
        body: req.body,
        file: req.file ? {
          originalname: req.file.originalname,
          size: req.file.size
        } : null
      }
    });
    next(new AppError('Failed to process CSV file', 500));
  }
};