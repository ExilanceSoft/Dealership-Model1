const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const moment = require('moment');
const Booking = require('../models/Booking');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Accessory = require('../models/Accessory');
const Broker = require('../models/Broker');
const FinanceProvider = require('../models/FinanceProvider');
const FinancerRate = require('../models/FinancerRate');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const multer = require('multer');
const Color = require('../models/Color');
const { generatePDFFromHtml } = require('../utils/pdfGenerator1');
const qrController = require('../controllers/qrController');
const Vehicle = require('../models/vehicleInwardModel');
const KYC = require('../models/KYC');
const FinanceLetter = require('../models/FinanceLetter');
const { generateOTP, sendOTPSMS } = require('../utils/otpService');
const Role = require('../models/Role')
// Add these imports at the top of the file
const BrokerLedger = require('../models/BrokerLedger');
// Configure Handlebars helpers

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, JPG, and PNG files are allowed'));
    }
  }
});
// Upload deal form
// Upload deal form
exports.uploadDealForm = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      // Delete the uploaded file if booking ID is invalid
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      // Delete the uploaded file if booking doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Delete old deal form if exists
    if (booking.dealForm && booking.dealForm.path) {
      try {
        fs.unlinkSync(path.join(__dirname, '../', booking.dealForm.path));
      } catch (err) {
        console.warn('Could not delete old deal form:', err.message);
      }
    }

    // Update booking with new deal form and set status to COMPLETED
    booking.dealForm = {
      path: `/uploads/documents/${req.file.filename}`,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user.id
    };
    
    // Update deal form status
    booking.dealFormStatus = 'COMPLETED';

    await booking.save();

    await AuditLog.create({
      action: 'UPLOAD_DEAL_FORM',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      status: 'SUCCESS',
      metadata: {
        filename: req.file.originalname,
        size: req.file.size
      }
    });

    res.status(200).json({
      success: true,
      message: 'Deal form uploaded successfully',
      data: {
        dealForm: booking.dealForm,
        dealFormStatus: booking.dealFormStatus
      }
    });

  } catch (err) {
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Error cleaning up file:', cleanupErr);
      }
    }

    console.error('Error uploading deal form:', err);
    
    await AuditLog.create({
      action: 'UPLOAD_DEAL_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error uploading deal form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Upload delivery challan
// Upload delivery challan
exports.uploadDeliveryChallan = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Delete old delivery challan if exists
    if (booking.deliveryChallan && booking.deliveryChallan.path) {
      try {
        fs.unlinkSync(path.join(__dirname, '../', booking.deliveryChallan.path));
      } catch (err) {
        console.warn('Could not delete old delivery challan:', err.message);
      }
    }

    // Update booking with new delivery challan and set status to COMPLETED
    booking.deliveryChallan = {
      path: `/uploads/documents/${req.file.filename}`,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user.id
    };
    
    // Update delivery challan status
    booking.deliveryChallanStatus = 'COMPLETED';

    await booking.save();

    await AuditLog.create({
      action: 'UPLOAD_DELIVERY_CHALLAN',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      status: 'SUCCESS',
      metadata: {
        filename: req.file.originalname,
        size: req.file.size
      }
    });

    res.status(200).json({
      success: true,
      message: 'Delivery challan uploaded successfully',
      data: {
        deliveryChallan: booking.deliveryChallan,
        deliveryChallanStatus: booking.deliveryChallanStatus
      }
    });

  } catch (err) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Error cleaning up file:', cleanupErr);
      }
    }

    console.error('Error uploading delivery challan:', err);
    
    await AuditLog.create({
      action: 'UPLOAD_DELIVERY_CHALLAN',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error uploading delivery challan',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
Handlebars.registerHelper('formatDate', function(date) {
    return moment(date).format('DD/MM/YYYY');
});
Handlebars.registerHelper('formatCurrency', function(amount) {
    if (amount === undefined || amount === null) return '0.00';
    return parseFloat(amount).toFixed(2);
});
Handlebars.registerHelper('calculateTax', function(amount, rate) {
    if (!amount || !rate) return '0.00';
    return (amount * rate / 100).toFixed(2);
});

Handlebars.registerHelper('add', function() {
    return Array.from(arguments).reduce((sum, num) => {
        if (typeof num === 'number') return sum + num;
        return sum;
    }, 0);
});

Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
});

Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

Handlebars.registerHelper('divide', function(a, b) {
    return a / b;
});
// Gracefully handle broker-ledger failures without breaking booking creation
const handleBrokerLedgerError = async (error, context, phase, extra = {}) => {
  try {
    console.error(`[BrokerLedger:${phase}] ${context}`, error);
    await AuditLog.create({
      action: 'BROKER_LEDGER_' + (phase || 'ERROR'),
      entity: 'BrokerLedger',
      entityId: extra.ledgerId,
      user: extra.userId,
      ip: extra.ip,
      status: 'FAILED',
      metadata: {
        context,
        bookingId: extra.bookingId,
        brokerId: extra.brokerId,
        payload: extra.payload || null,
      },
      error: error?.message || String(error),
    });
  } catch (logErr) {
    console.error('Failed to write audit log for broker ledger error:', logErr);
  }
};

// Add this helper function before the createBooking function
// Update the calculateBrokerCommission function
const calculateBrokerCommission = async (brokerId, exchangeAmount, branchId) => {
  try {
    if (!brokerId || !branchId) return 0;
    
    // Populate the broker with branch configurations
    const broker = await Broker.findById(brokerId)
      .populate({
        path: 'branches.branch',
        select: 'name'
      })
      .lean();
    
    if (!broker) return 0;

    // Find the branch configuration for this specific branch
    const branchCfg = (broker.branches || []).find(
      (b) => b.branch && String(b.branch._id) === String(branchId)
    );
    
    if (!branchCfg) return 0;

    // Check if we have commission configurations
    if (!branchCfg.commissionConfigurations || branchCfg.commissionConfigurations.length === 0) {
      return 0;
    }

    // Get the active commission configuration (assuming only one active at a time)
    const activeCommissionConfig = branchCfg.commissionConfigurations.find(
      config => config.isActive
    );

    if (!activeCommissionConfig) return 0;

    if (activeCommissionConfig.commissionType === 'FIXED') {
      return Number(activeCommissionConfig.fixedCommission || 0);
    }

    if (activeCommissionConfig.commissionType === 'VARIABLE' && 
        Array.isArray(activeCommissionConfig.commissionRanges)) {
      
      // First, populate the commission ranges with their master data if needed
      const populatedRanges = await Promise.all(
        activeCommissionConfig.commissionRanges.map(async (range) => {
          if (range.commissionRangeMaster) {
            const rangeMaster = await mongoose.model('CommissionRangeMaster')
              .findById(range.commissionRangeMaster)
              .lean();
            return {
              ...range,
              minAmount: rangeMaster?.minAmount || 0,
              maxAmount: rangeMaster?.maxAmount || null,
              amount: range.amount
            };
          }
          return range;
        })
      );

      // Sort ranges by minAmount for proper evaluation
      populatedRanges.sort((a, b) => a.minAmount - b.minAmount);

      for (const range of populatedRanges) {
        const min = Number(range.minAmount || 0);
        const max = range.maxAmount ? Number(range.maxAmount) : null;
        
        if (max === null) {
          // This is the "and above" range
          if (exchangeAmount >= min) return Number(range.amount || 0);
        } else if (exchangeAmount >= min && exchangeAmount <= max) {
          return Number(range.amount || 0);
        }
      }
    }
    return 0;
  } catch (err) {
    console.error('calculateBrokerCommission error:', err);
    return 0;
  }
};

// Load the booking form template
const templatePath = path.join(__dirname, '../templates/bookingFormTemplate.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');
const bookingFormTemplate = Handlebars.compile(templateHtml);

const generateBookingFormHTML = async (booking, saveToFile = true) => {
    try {
        // Prepare data for the template
        const formData = {
            ...booking.toObject(),
            branchDetails: booking.branchDetails,
            modelDetails: booking.modelDetails,
            colorDetails: booking.colorDetails,
            salesExecutiveDetails: booking.salesExecutiveDetails,
            createdAt: booking.createdAt,
            bookingNumber: booking.bookingNumber
        };

        // Generate HTML content
        const html = bookingFormTemplate(formData);

        if (!saveToFile) {
            return html;
        }

        // Define upload directory path
        const uploadDir = path.join(process.cwd(), 'uploads', 'booking-forms');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename with timestamp to avoid overwriting
        const fileName = `booking-form-${booking.bookingNumber}-${Date.now()}.html`;
        
        // Create full file path
        const filePath = path.join(uploadDir, fileName);

        // Write HTML file
        fs.writeFileSync(filePath, html);

        // Return file information
        return {
            path: filePath,
            fileName: fileName,
            url: `/uploads/booking-forms/${fileName}`
        };
    } catch (error) {
        console.error('Error generating booking form HTML:', error);
        throw error;
    }
};

// Helper function to calculate discounts
const calculateDiscounts = (priceComponents, discountAmount, discountType) => {
  const components = priceComponents.map((c) => ({ ...c }));
  const DISALLOW_KEY = 'HYPOTHECATION CHARGES (IF APPLICABLE)';

  const eligible = components.filter(
    (c) =>
      c.isDiscountable &&
      (!c.headerDetails?.header_key || c.headerDetails?.header_key !== DISALLOW_KEY)
  );

  if (eligible.length === 0 && discountAmount > 0) {
    throw new Error('No discountable components available');
  }

  // higher GST first
  eligible.sort((a, b) => {
    const gstA = a.headerDetails?.metadata?.gst_rate || a.metadata?.gstRate || 0;
    const gstB = b.headerDetails?.metadata?.gst_rate || b.metadata?.gstRate || 0;
    return gstB - gstA;
  });

  const totalEligible = eligible.reduce((s, c) => s + Number(c.originalValue || 0), 0);
  let remaining =
    discountType === 'PERCENTAGE' ? (totalEligible * Number(discountAmount || 0)) / 100 : Number(discountAmount || 0);

  for (const c of components) {
    if (!c.isDiscountable) continue;
    if (c.headerDetails?.header_key === DISALLOW_KEY) continue;
    if (remaining <= 0) break;

    const maxDiscount = Number(c.originalValue) * 0.95; // cannot reduce below 5%
    const currentDiscount = Number(c.originalValue) - Number(c.discountedValue || c.originalValue);
    const canStillDiscount = Math.max(0, maxDiscount - currentDiscount);
    const apply = Math.min(canStillDiscount, remaining);

    c.discountedValue = Number(c.originalValue) - (currentDiscount + apply);
    remaining -= apply;
  }

  return components;
};

const validateDiscountLimits = (priceComponents) => {
  const bad = priceComponents.filter((c) => {
    if (!c.isDiscountable) return false;
    if (c.headerDetails?.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') return false;
    return Number(c.discountedValue) < Number(c.originalValue) * 0.05;
  });
  if (bad.length) {
    const names = bad.map((b) => b.headerDetails?.header_key || 'UNKNOWN').join(', ');
    throw new Error(`Discount cannot exceed 95% for: ${names}`);
  }
};

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    // -------- Basic required fields
    const required = [
      { key: 'model_id', msg: 'Model selection is required' },
      { key: 'model_color', msg: 'Color selection is required' },
      { key: 'customer_type', msg: 'Customer type (B2B/B2C/CSD) is required' },
      { key: 'rto_type', msg: 'RTO state (MH/BH/CRTM) is required' },
      { key: 'customer_details', msg: 'Customer details are required' },
      { key: 'payment', msg: 'Payment details are required' },
    ];
    const missing = required.filter((r) => !req.body[r.key]).map((r) => r.msg);
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!['B2B', 'B2C', 'CSD'].includes(req.body.customer_type)) {
      return res.status(400).json({ success: false, message: 'Invalid customer type. Must be B2B, B2C, or CSD' });
    }

    // -------- Either branch or subdealer (not both)
    if (!req.body.branch && !req.body.subdealer) {
      return res.status(400).json({ success: false, message: 'Either branch or subdealer selection is required' });
    }
    if (req.body.branch && req.body.subdealer) {
      return res.status(400).json({ success: false, message: 'Cannot select both branch and subdealer' });
    }

    let entityId, entityType, bookingType;
    if (req.body.branch) {
      const ok = await mongoose.model('Branch').exists({ _id: req.body.branch });
      if (!ok) return res.status(400).json({ success: false, message: 'Invalid branch selected' });
      entityId = req.body.branch;
      entityType = 'branch';
      bookingType = 'BRANCH';
    } else {
      const ok = await mongoose.model('Subdealer').exists({ _id: req.body.subdealer });
      if (!ok) return res.status(400).json({ success: false, message: 'Invalid subdealer selected' });
      entityId = req.body.subdealer;
      entityType = 'subdealer';
      bookingType = 'SUBDEALER';
    }

    // -------- Assign user based on booking type
    const userAssignment = {};
    if (bookingType === 'SUBDEALER') {
      const subRole = await Role.findOne({ name: 'SUBDEALER' });
      if (!subRole) return res.status(400).json({ success: false, message: 'SUBDEALER role not found in system' });

      const subUser = await User.findOne({
        subdealer: entityId,
        roles: subRole._id,
        status: 'ACTIVE',
      }).populate('roles');
      if (!subUser) {
        return res.status(400).json({ success: false, message: 'No active subdealer user found for this subdealer' });
      }
      userAssignment.subdealerUser = subUser._id;
    } else {
      if (req.body.sales_executive) {
        if (!mongoose.Types.ObjectId.isValid(req.body.sales_executive)) {
          return res.status(400).json({ success: false, message: 'Invalid sales executive ID format' });
        }
        const se = await User.findById(req.body.sales_executive).populate('roles');
        if (!se || se.status !== 'ACTIVE') {
          return res.status(400).json({ success: false, message: 'Invalid or inactive sales executive selected' });
        }
        if (!se.branch || String(se.branch) !== String(entityId)) {
          return res.status(400).json({ success: false, message: 'Sales executive must belong to the selected branch' });
        }
        userAssignment.salesExecutive = req.body.sales_executive;
      } else {
        userAssignment.salesExecutive = req.user.id;
      }
    }

    // -------- Salutation & Model / Color validations
    const validSalutations = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'];
    if (!req.body.customer_details.salutation || !validSalutations.includes(req.body.customer_details.salutation)) {
      return res.status(400).json({ success: false, message: 'Valid salutation (Mr., Mrs., Miss, Dr., Prof.) is required' });
    }

    const model = await Model.findById(req.body.model_id).populate('colors');
    if (!model) return res.status(400).json({ success: false, message: 'Invalid model selected' });

    if (req.body.customer_type === 'CSD' && model.type !== 'CSD') {
      return res.status(400).json({ success: false, message: 'Selected model is not available for CSD customers' });
    }

    const color = await Color.findById(req.body.model_color);
    const colorOk = color && (model.colors || []).some((c) => String(c._id) === String(req.body.model_color));
    if (!colorOk) return res.status(400).json({ success: false, message: 'Invalid color selected' });

    if (req.body.customer_type === 'B2B' && !req.body.gstin) {
      return res.status(400).json({ success: false, message: 'GSTIN is required for B2B customers' });
    }

    // -------- Prevent exchange for SUBDEALER
    if (req.body.exchange?.is_exchange && bookingType === 'SUBDEALER') {
      return res.status(400).json({ success: false, message: 'Exchange is not allowed for subdealer bookings' });
    }

    // -------- Headers & price components
    const headers = await Header.find({ type: model.type }).sort({ priority: 1 }).lean();

    const priceComponentsRaw = await Promise.all(
      headers.map(async (header) => {
        const priceData = (model.prices || []).find((p) => {
          if (!p.header_id) return false;
          const matchHeader = String(p.header_id) === String(header._id);
          const matchEntity =
            entityType === 'branch'
              ? p.branch_id && String(p.branch_id) === String(entityId)
              : p.subdealer_id && String(p.subdealer_id) === String(entityId);
          return matchHeader && matchEntity;
        });

        if (!priceData) return null;

        if (header.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
          return {
            header: header._id,
            headerDetails: header,
            originalValue: Number(priceData.value || 0),
            discountedValue: req.body.hpa ? Number(priceData.value || 0) : 0,
            isDiscountable: false,
            isMandatory: false,
            metadata: priceData.metadata || {},
          };
        }

        if (header.is_mandatory) {
          return {
            header: header._id,
            headerDetails: header,
            originalValue: Number(priceData.value || 0),
            discountedValue: Number(priceData.value || 0),
            isDiscountable: !!header.is_discount,
            isMandatory: true,
            metadata: priceData.metadata || {},
          };
        }

        const selected = Array.isArray(req.body.optionalComponents)
          ? req.body.optionalComponents.map(String)
          : [];
        if (selected.includes(String(header._id))) {
          return {
            header: header._id,
            headerDetails: header,
            originalValue: Number(priceData.value || 0),
            discountedValue: Number(priceData.value || 0),
            isDiscountable: !!header.is_discount,
            isMandatory: false,
            metadata: priceData.metadata || {},
          };
        }

        return null;
      })
    );

    const priceComponents = priceComponentsRaw.filter(Boolean);
    if (!priceComponents.length) {
      return res.status(400).json({
        success: false,
        message: `No valid price components found for this model and ${entityType}`,
      });
    }

    // base amount from components (HPA included only if req.body.hpa true)
    const baseAmount = priceComponents.reduce((s, c) => s + Number(c.discountedValue || 0), 0);

    // Hypothecation (explicit)
    const hpaHeader = headers.find((h) => h.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)');
    const hypothecationCharges =
      req.body.hpa && hpaHeader
        ? Number(
            (model.prices || []).find((p) => {
              const matchHeader = String(p.header_id) === String(hpaHeader._id);
              const matchEntity =
                entityType === 'branch'
                  ? p.branch_id && String(p.branch_id) === String(entityId)
                  : p.subdealer_id && String(p.subdealer_id) === String(entityId);
              return matchHeader && matchEntity;
            })?.value || 0
          )
        : 0;

    // RTO amount (simple BH/CRTM flat if you use that rule)
    let rtoAmount = 0;
    if (req.body.rto_type === 'BH') rtoAmount = 5000;
    if (req.body.rto_type === 'CRTM') rtoAmount = 4500;

    // -------- Accessories
    let accessories = [];
    let accessoriesTotal = 0;

    if (req.body.accessories?.selected?.length) {
      const accessoryIds = req.body.accessories.selected.map((acc) => new mongoose.Types.ObjectId(acc.id));
      const validAccessories = await Accessory.find({
        _id: { $in: accessoryIds },
        status: 'active',
      }).lean();

      if (validAccessories.length !== req.body.accessories.selected.length) {
        const missing = req.body.accessories.selected
          .filter((a) => !validAccessories.some((v) => String(v._id) === String(a.id)))
          .map((a) => a.id);
        return res.status(400).json({
          success: false,
          message: `Invalid accessory IDs: ${missing.join(', ')}`,
        });
      }

      const incompatible = validAccessories.filter(
        (a) => !(a.applicable_models || []).some((m) => String(m) === String(req.body.model_id))
      );
      if (incompatible.length) {
        return res.status(400).json({
          success: false,
          message: `Incompatible accessories: ${incompatible.map((a) => a.name).join(', ')}`,
        });
      }

      const accessoriesTotalHeader = await Header.findOne({
        header_key: 'ACCESSORIES TOTAL',
        type: model.type,
      }).lean();
      if (!accessoriesTotalHeader) {
        return res.status(400).json({ success: false, message: 'ACCESSORIES TOTAL header not configured' });
      }

      const accessoriesTotalPrice =
        (model.prices || []).find((p) => {
          const matchHeader = String(p.header_id) === String(accessoriesTotalHeader._id);
          const matchEntity =
            entityType === 'branch'
              ? p.branch_id && String(p.branch_id) === String(entityId)
              : p.subdealer_id && String(p.subdealer_id) === String(entityId);
          return matchHeader && matchEntity;
        })?.value || 0;

      const selectedAccessoriesTotal = validAccessories.reduce((s, acc) => s + Number(acc.price || 0), 0);
      accessoriesTotal = Math.max(Number(selectedAccessoriesTotal), Number(accessoriesTotalPrice || 0));

      accessories = validAccessories.map((acc) => ({
        accessory: acc._id,
        price: Number(acc.price || 0),
        discount: 0,
        isAdjustment: false,
      }));

      if (selectedAccessoriesTotal < accessoriesTotalPrice) {
        const diff = Number(accessoriesTotalPrice) - Number(selectedAccessoriesTotal);
        accessories.push({
          accessory: null, // adjustment line
          price: diff,
          discount: 0,
          isAdjustment: true,
        });
      }
    }

    // -------- Exchange (BRANCH only)
    let exchangeDetails = null;
    if (bookingType === 'BRANCH' && req.body.exchange?.is_exchange) {
      if (!req.body.exchange.broker_id) {
        return res.status(400).json({ success: false, message: 'Broker selection is required for exchange' });
      }
      const broker = await Broker.findById(req.body.exchange.broker_id);
      if (!broker) return res.status(400).json({ success: false, message: 'Invalid broker selected' });

      if (broker.otp_required) {
        if (!req.body.exchange.otp) {
          return res.status(400).json({ success: false, message: 'OTP is required for this broker' });
        }
        const now = new Date();
        if (!broker.otp || broker.otp !== req.body.exchange.otp || !broker.otpExpiresAt || broker.otpExpiresAt < now) {
          return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
        broker.otp = null;
        broker.otpExpiresAt = null;
        await broker.save();
      }

      exchangeDetails = {
        broker: req.body.exchange.broker_id,
        price: Number(req.body.exchange.exchange_price || 0),
        vehicleNumber: req.body.exchange.vehicle_number,
        chassisNumber: req.body.exchange.chassis_number,
        otpVerified: !!broker.otp_required,
        status: 'PENDING',
      };
    }

    // -------- Payment
    let payment = {};
const pay = req.body?.payment || {};
const payType = String(pay.type || '').toUpperCase();

if (payType === 'FINANCE') {
  // financer is still required for FINANCE
  if (!pay.financer_id) {
    return res.status(400).json({ success: false, message: 'Financer selection is required' });
  }

  const financer = await FinanceProvider.findById(pay.financer_id);
  if (!financer) {
    return res.status(400).json({ success: false, message: 'Invalid financer selected' });
  }

  const gcApplicable = !!pay.gc_applicable;

  // gc_amount is OPTIONAL; if present must be >= 0
  let gcAmount;
  if (pay.gc_amount != null && pay.gc_amount !== '') {
    const n = Number(pay.gc_amount);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ success: false, message: 'GC amount must be a non-negative number when provided' });
    }
    gcAmount = n;
  }

  payment = {
    type: 'FINANCE',
    financer: pay.financer_id,
    scheme: pay.scheme || null,      // OPTIONAL everywhere
    emiPlan: pay.emi_plan || null,   // OPTIONAL everywhere
    gcApplicable,
    ...(gcAmount !== undefined ? { gcAmount } : {})
  };
} else {
  // default to CASH (or keep your existing logic)
  payment = { type: 'CASH' };
}

    // -------- Discounts (model-level + requested)
    const modelHasDiscount = Number(model.model_discount || 0) > 0;
    const isApplyingDiscount = req.body.discount && Number(req.body.discount.value || 0) > 0;

    const discounts = [];
    if (modelHasDiscount) {
      discounts.push({
        amount: Number(model.model_discount),
        type: 'FIXED',
        approvalStatus: 'PENDING',
        approvalNote: 'Model discount',
        isModelDiscount: true,
        appliedOn: new Date(),
      });
    }
    if (isApplyingDiscount) {
      const dtype = String(req.body.discount.type || '').toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
      discounts.push({
        amount: Number(req.body.discount.value),
        type: dtype,
        approvalStatus: 'PENDING',
        approvalNote: 'Discount applied',
        isModelDiscount: false,
        appliedOn: new Date(),
      });
    }

    // apply discounts to price components
    let finalComponents = priceComponents.map((c) => ({ ...c }));
    for (const d of discounts) {
      finalComponents = calculateDiscounts(finalComponents, d.amount, d.type);
      validateDiscountLimits(finalComponents);
    }

    // sync discounted values back
    finalComponents.forEach((u) => {
      const idx = priceComponents.findIndex((o) => String(o.header) === String(u.header));
      if (idx >= 0) priceComponents[idx].discountedValue = Number(u.discountedValue);
    });

    const totalDiscount = priceComponents.reduce(
      (s, c) => s + (Number(c.originalValue) - Number(c.discountedValue)),
      0
    );

    // -------- Totals
    const totalAmount = Number(baseAmount) + Number(accessoriesTotal) + Number(rtoAmount);
    const discountedAmount = totalAmount - Number(totalDiscount);

    // -------- Booking data
    const bookingData = {
      model: req.body.model_id,
      color: req.body.model_color,
      customerType: req.body.customer_type,
      isCSD: req.body.customer_type === 'CSD',
      gstin: req.body.gstin || '',
      rto: req.body.rto_type,
      rtoAmount: ['BH', 'CRTM'].includes(req.body.rto_type) ? Number(rtoAmount) : undefined,
      hpa: !!req.body.hpa,
      hypothecationCharges,
      insuranceStatus: 'AWAITING',
      note: req.body.note || '',

      customerDetails: {
        salutation: req.body.customer_details.salutation,
        name: req.body.customer_details.name,
        panNo: req.body.customer_details.pan_no || '',
        dob: req.body.customer_details.dob,
        occupation: req.body.customer_details.occupation,
        address: req.body.customer_details.address,
        taluka: req.body.customer_details.taluka,
        district: req.body.customer_details.district,
        pincode: req.body.customer_details.pincode,
        mobile1: req.body.customer_details.mobile1,
        mobile2: req.body.customer_details.mobile2 || '',
        aadharNumber: req.body.customer_details.aadhar_number || '',
        nomineeName: req.body.customer_details.nomineeName || undefined,
        nomineeRelation: req.body.customer_details.nomineeRelation || undefined,
        nomineeAge: req.body.customer_details.nomineeAge ? parseInt(req.body.customer_details.nomineeAge) : undefined,
      },
      
      exchange: !!req.body.exchange?.is_exchange,
      exchangeDetails,

      payment,
      accessories,
      priceComponents,
      discounts,
      accessoriesTotal: Number(accessoriesTotal),
      totalAmount: Number(totalAmount),
      discountedAmount: Number(discountedAmount),

      status: 'PENDING_APPROVAL',
      bookingType,
      [entityType]: entityId,
      createdBy: req.user.id,
      formGenerated: false,
      formPath: '',
      ...userAssignment,
    };

    // -------- Create + QR + populate
    const booking = await Booking.create(bookingData);

    try {
      const qrCode = await qrController.generateQRCode(booking._id);
      booking.qrCode = qrCode || '';
      await booking.save();
    } catch (e) {
      console.warn('QR generation failed (continuing):', e.message);
    }

    let populatedBooking = await Booking.findById(booking._id)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate(bookingType === 'BRANCH' ? 'branchDetails' : 'subdealerDetails')
      .populate('createdByDetails')
      .populate(bookingType === 'SUBDEALER' ? 'subdealerUserDetails' : 'salesExecutiveDetails')
      .populate({ path: 'priceComponents.header', model: 'Header' })
      .populate({ path: 'accessories.accessory', model: 'Accessory' })
      .populate({ path: 'exchangeDetails.broker', model: 'Broker' })
      .populate({ path: 'payment.financer', model: 'FinanceProvider' });

    try {
      const form = await generateBookingFormHTML(populatedBooking);
      if (form?.url) {
        populatedBooking.formPath = form.url;
        populatedBooking.formGenerated = true;
        await populatedBooking.save();
      }
    } catch (e) {
      console.warn('Booking form HTML generation failed (continuing):', e.message);
    }

    await AuditLog.create({
      action: 'CREATE',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: bookingData,
      status: 'SUCCESS',
    });

    // -------- Broker Ledger (AFTER creation) — atomic upsert
    // In the createBooking function, update the broker ledger section:
if (populatedBooking.exchange && populatedBooking.exchangeDetails?.broker) {
  try {
    const brokerId = populatedBooking.exchangeDetails.broker?._id || populatedBooking.exchangeDetails.broker;
    if (!brokerId) throw new Error('Missing broker id on exchangeDetails');

    // Get the branch ID - this was missing!
    const branchId = populatedBooking.branch || populatedBooking.branchDetails?._id;
    if (!branchId) {
      throw new Error('Branch ID is required for broker ledger');
    }

    const exchangePrice = Number(populatedBooking.exchangeDetails.price || 0);
    const commission = await calculateBrokerCommission(brokerId, exchangePrice, branchId);

    // Create transaction data
    const transactions = [
      {
        type: 'DEBIT',
        amount: exchangePrice,
        modeOfPayment: 'Exchange',
        remark: `Exchange vehicle: ${populatedBooking.exchangeDetails.vehicleNumber || 'N/A'}`,
        booking: populatedBooking._id,
        branch: branchId, // Add branch to transaction
        createdBy: req.user.id,
        date: new Date()
      }
    ];

    if (commission > 0) {
      transactions.push({
        type: 'DEBIT',
        amount: commission,
        modeOfPayment: 'Exchange',
        remark: `Commission for exchange booking ${populatedBooking.bookingNumber}`,
        booking: populatedBooking._id,
        branch: branchId, // Add branch to transaction
        createdBy: req.user.id,
        date: new Date()
      });
    }

    // Find or create ledger with upsert
    const ledger = await BrokerLedger.findOneAndUpdate(
      { broker: brokerId, branch: branchId },
      {
        $push: { transactions: { $each: transactions } },
        $inc: { 
          currentBalance: exchangePrice + commission,
          onAccount: 0 // Initialize if not exists
        },
        $setOnInsert: {
          createdBy: req.user.id,
          lastUpdatedBy: req.user.id
        }
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true 
      }
    );

    // Update booking with ledger reference
    await Booking.findByIdAndUpdate(
      populatedBooking._id,
      {
        $push: {
          brokerLedgerEntries: {
            ledger: ledger._id,
            amount: exchangePrice + commission,
            type: 'EXCHANGE_AND_COMMISSION',
            createdAt: new Date()
          }
        }
      }
    );

  } catch (err) {
    await handleBrokerLedgerError(err, 'NEW_BOOKING', 'creating', {
      bookingId: populatedBooking?._id,
      brokerId: populatedBooking?.exchangeDetails?.broker?._id,
      userId: req.user?.id,
      ip: req.ip,
    });
  }
}

    // -------- Shape response (SE vs Subdealer user)
    const out = populatedBooking.toObject();
    if (out.bookingType === 'SUBDEALER') {
      out.subdealerUser = out.subdealerUserDetails;
      delete out.salesExecutive;
      delete out.salesExecutiveDetails;
    } else {
      out.salesExecutive = out.salesExecutiveDetails;
      delete out.subdealerUser;
      delete out.subdealerUserDetails;
    }

    return res.status(201).json({ success: true, data: out });
  } catch (err) {
    console.error('Error creating booking:', err);

    let message = 'Error creating booking';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map((v) => v.message).join(', ');
    } else if (err.message) {
      message = err.message;
    }

    try {
      await AuditLog.create({
        action: 'CREATE',
        entity: 'Booking',
        user: req.user?.id,
        ip: req.ip,
        status: 'FAILED',
        metadata: req.body,
        error: message,
      });
    } catch (logErr) {
      console.error('Failed to create audit log:', logErr);
    }

    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

// Get booking statistics and document counts
exports.getBookingStats = async (req, res) => {
  try {
    // Base match conditions
    const matchConditions = {};
    
    // For non-superadmins, filter by branch or sales executive
    if (!req.user.isSuperAdmin) {
      if (req.user.isSalesExecutive) {
        matchConditions.$or = [
          { createdBy: req.user.id },
          { salesExecutive: req.user.id }
        ];
      } else if (req.user.branch) {
        matchConditions.branch = req.user.branch;
      }
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get booking counts for different time periods
    const [todayCount, weekCount, monthCount] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: weekStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: monthStart }
      })
    ]);

    // Get document status counts (all time)
    const [kycPending, financeLetterPending] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING'
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE'
      })
    ]);

    // Get today's document status counts
    const [kycPendingToday, financeLetterPendingToday] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: today }
      })
    ]);

    // Get weekly document status counts
    const [kycPendingThisWeek, financeLetterPendingThisWeek] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: weekStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: weekStart }
      })
    ]);

    // Get monthly document status counts
    const [kycPendingThisMonth, financeLetterPendingThisMonth] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: monthStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: monthStart }
      })
    ]);

    // For superadmin, get counts grouped by sales executive
    let salesExecutiveStats = [];
    if (req.user.isSuperAdmin) {
      salesExecutiveStats = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: '$salesExecutive',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        {
          $unwind: '$userDetails'
        },
        {
          $project: {
            salesExecutiveId: '$_id',
            salesExecutiveName: '$userDetails.name',
            salesExecutiveEmail: '$userDetails.email',
            count: 1,
            _id: 0
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        counts: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount
        },
        pendingDocuments: {
          kyc: {
            total: kycPending,
            today: kycPendingToday,
            thisWeek: kycPendingThisWeek,
            thisMonth: kycPendingThisMonth
          },
          financeLetter: {
            total: financeLetterPending,
            today: financeLetterPendingToday,
            thisWeek: financeLetterPendingThisWeek,
            thisMonth: financeLetterPendingThisMonth
          }
        },
        salesExecutiveStats: req.user.isSuperAdmin ? salesExecutiveStats : undefined
      }
    });

  } catch (err) {
    console.error('Error getting booking stats:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get booking form HTML by ID
exports.getBookingForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    // 1. Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // 2. Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('salesExecutiveDetails')
      .populate({ 
        path: 'priceComponents.header', 
        model: 'Header' 
      })
      .populate({ 
        path: 'accessories.accessory', 
        model: 'Accessory' 
      })
      .populate({ 
        path: 'exchangeDetails.broker', 
        model: 'Broker' 
      })
      .populate({ 
        path: 'payment.financer', 
        model: 'FinanceProvider' 
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // 3. Permission check is handled by route middleware

    // 4. Generate the HTML form
    const html = await generateBookingFormHTML(booking, false);

    // 5. Set response headers for HTML content
    res.set('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (err) {
    console.error('Error getting booking form:', err);
    
    await AuditLog.create({
      action: 'VIEW_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get booking by chassis number
exports.getBookingByChassisNumber = async (req, res) => {
  try {
    const { chassisNumber } = req.params;
    
    // Validate chassis number format
    if (!chassisNumber || !/^[A-Z0-9]{17}$/.test(chassisNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chassis number format - must be exactly 17 alphanumeric characters'
      });
    }

    // Find booking by chassis number (case insensitive)
    const booking = await Booking.findOne({ 
      chassisNumber: chassisNumber.toUpperCase() 
    })
      .populate('model')
      .populate('color')
      .populate('branch')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .populate({
        path: 'priceComponents.header',
        model: 'Header'
      })
      .populate({
        path: 'accessories.accessory',
        model: 'Accessory',
        populate: {
          path: 'category',
          model: 'AccessoryCategory'
        }
      })
      .populate({
        path: 'exchangeDetails.broker',
        model: 'Broker'
      })
      .populate({
        path: 'payment.financer',
        model: 'FinanceProvider'
      })
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found for this chassis number'
      });
    }

    // Transform the response to include accessory categories
    const transformedBooking = booking.toObject();
    
    // Process accessories to include category details
    if (transformedBooking.accessories && transformedBooking.accessories.length > 0) {
      transformedBooking.accessories = transformedBooking.accessories.map(accessory => {
        if (accessory.accessory && accessory.accessory.category) {
          return {
            ...accessory,
            categoryDetails: accessory.accessory.category
          };
        }
        return accessory;
      });
    }

    res.status(200).json({
      success: true,
      data: transformedBooking
    });

  } catch (err) {
    console.error('Error getting booking by chassis number:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


// Approve booking
exports.approveBooking = async (req, res) => {
  try {
    // 1. Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID format' 
      });
    }

    // 2. Find and update the booking (no status condition)
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: 'APPROVED',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          // Also approve any pending discounts if they exist
          "discounts.$[].approvedBy": req.user.id,
          "discounts.$[].approvalStatus": 'APPROVED',
          "discounts.$[].approvalNote": req.body.approvalNote || 'Approved'
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    )
      .populate("model", "model_name type")
      .populate("color", "name code")
      .populate("branch", "name address")
      .populate("approvedBy", "name email mobile");

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // 3. (Optional) Generate booking form if needed
    if (process.env.GENERATE_FORMS === 'true') {
      generateBookingFormHTML(booking)
        .then(formResult => {
          booking.formPath = formResult.url;
          booking.formGenerated = true;
          return booking.save();
        })
        .catch(err => {
          console.error("Error generating booking form:", err);
        });
    }

    // 4. Create audit log
    await AuditLog.create({
      action: "APPROVE",
      entity: "Booking",
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        approvalNote: req.body.approvalNote || 'No note provided'
      },
      status: "SUCCESS"
    });

    // 5. Return success response
    res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking approved successfully'
    });

  } catch (err) {
    console.error("Error approving booking:", err);
    
    await AuditLog.create({
      action: "APPROVE",
      entity: "Booking",
      entityId: req.params.id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        error: err.message
      },
      status: "FAILED"
    });

    res.status(500).json({
      success: false,
      message: "Error approving booking",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get booking by ID with all populated details
exports.getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('model', 'model_name type')
      .populate('color', 'name code')
      .populate('branch', 'name address contactPerson contactNumber')
      .populate('subdealer', 'name address contactPerson contactNumber gstin')
      .populate('createdBy', 'name email mobile')
      // Explicitly populate salesExecutive with all needed fields
      .populate({
        path: 'salesExecutive',
        select: 'name email mobile roles branch',
        populate: {
          path: 'branch',
          select: 'name code'
        }
      })
      .populate({
        path: 'subdealerUser',
        select: 'name email mobile roles subdealer',
        populate: {
          path: 'subdealer',
          select: 'name code'
        }
      })
      .populate({
        path: 'priceComponents.header',
        model: 'Header',
        select: 'header_name header_key'
      })
      .populate({
        path: 'accessories.accessory',
        model: 'Accessory',
        select: 'name code category'
      })
      .populate({
        path: 'exchangeDetails.broker',
        model: 'Broker',
        select: 'name contactNumber'
      })
      .populate({
        path: 'payment.financer',
        model: 'FinanceProvider',
        select: 'name code'
      })
      .populate('approvedBy', 'name email mobile')
      .populate({
        path: 'vehicle',
        select: 'batteryNumber keyNumber motorNumber chargerNumber engineNumber chassisNumber qrCode status'
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Convert to plain object
    const bookingObj = booking.toObject();
    
    // Ensure model name is included in the response
    if (bookingObj.model) {
      bookingObj.model.name = bookingObj.model.model_name;
    }

    // Format customer details if needed
    if (bookingObj.customerDetails) {
      // Format date of birth if it exists
      if (bookingObj.customerDetails.dob) {
        bookingObj.customerDetails.dob = bookingObj.customerDetails.dob.toISOString().split('T')[0];
      }
      
      // Add full customer name with salutation
      bookingObj.customerDetails.fullName = 
        `${bookingObj.customerDetails.salutation} ${bookingObj.customerDetails.name}`.trim();
    }

    // For branch bookings, ensure salesExecutive is included
    if (bookingObj.bookingType === 'BRANCH' && booking.salesExecutive) {
      bookingObj.salesExecutive = {
        _id: booking.salesExecutive._id,
        name: booking.salesExecutive.name,
        email: booking.salesExecutive.email,
        mobile: booking.salesExecutive.mobile,
        branch: booking.salesExecutive.branch
      };
    }
    
    // Add document status information
    bookingObj.documentStatus = {
      dealForm: {
        status: bookingObj.dealFormStatus || 'NOT_UPLOADED'
      },
      deliveryChallan: {
        status: bookingObj.deliveryChallanStatus || 'NOT_UPLOADED'
      }
    };

    res.status(200).json({
      success: true,
      data: bookingObj
    });

  } catch (err) {
    console.error('Error getting booking:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get all bookings with pagination and filters
exports.getAllBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      status, 
      branch, 
      fromDate, 
      toDate,
      customerType,
      model,
      kycStatus,
      financeLetterStatus,
      dealFormStatus, // Added dealFormStatus filter
      deliveryChallanStatus // Added deliveryChallanStatus filter
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Status filter
    if (status) {
      filter.status = status;
    }
    
    // Customer type filter
    if (customerType) {
      filter.customerType = customerType;
    }
    
    // Model filter
    if (model) {
      filter.model = model;
    }
    
    // Deal Form Status filter
    if (dealFormStatus) {
      filter.dealFormStatus = dealFormStatus;
    }
    
    // Delivery Challan Status filter
    if (deliveryChallanStatus) {
      filter.deliveryChallanStatus = deliveryChallanStatus;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Check if user is a sales executive
    const isSalesExecutive = req.user.roles && 
                            req.user.roles.some(role => role.name === 'SALES_EXECUTIVE');

    // Branch filter logic - FIXED: Sales executives should only see their own bookings
    if (!req.user.isSuperAdmin) {
      if (isSalesExecutive) {
        // Sales Executive can only see their own bookings
        filter.$or = [
          { createdBy: req.user._id },
          { salesExecutive: req.user._id }
        ];
      } else if (req.user.branch) {
        // Other users can see all bookings from their branch
        filter.branch = req.user.branch;
      }
    } else if (branch) {
      // SuperAdmin can filter by branch if specified
      filter.branch = branch;
    }

    // Add KYC and Finance Letter status filters to the main query
    if (kycStatus) {
      if (kycStatus === 'NOT_UPLOADED') {
        filter.kycStatus = { $in: ['NOT_SUBMITTED', 'NOT_UPLOADED'] };
      } else {
        filter.kycStatus = kycStatus;
      }
    }
    
    if (financeLetterStatus) {
      if (financeLetterStatus === 'NOT_UPLOADED') {
        filter.financeLetterStatus = { $in: ['NOT_SUBMITTED', 'NOT_UPLOADED'] };
      } else {
        filter.financeLetterStatus = financeLetterStatus;
      }
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }, // Newest first
      populate: [
        'model',
        { path: 'color', select: 'name code' },
        'branch',
        {
          path: 'createdBy',
          select: 'name email'
        },
        {
          path: 'salesExecutive',
          select: 'name email'
        },
        {
          path: 'exchangeDetails.broker',
          select: 'name mobile'
        },
        {
          path: 'payment.financer',
          select: 'name'
        }
      ],
      lean: true
    };
    
    // Get paginated bookings with all filters applied
    let bookings = await Booking.paginate(filter, options);
    
    // Get KYC and Finance Letter details for each booking (for display only)
    const bookingsWithDocDetails = await Promise.all(
      bookings.docs.map(async (booking) => {
        const [kyc, financeLetter] = await Promise.all([
          mongoose.model('KYC').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean(),
          mongoose.model('FinanceLetter').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean()
        ]);
        
        // Create simplified status objects for display
        const kycStatusObj = kyc ? {
          status: kyc.status,
          verifiedBy: kyc.verifiedBy?.name || null,
          verificationNote: kyc.verificationNote || null,
          updatedAt: kyc.updatedAt
        } : {
          status: booking.kycStatus || 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        const financeLetterStatusObj = financeLetter ? {
          status: financeLetter.status,
          verifiedBy: financeLetter.verifiedBy?.name || null,
          verificationNote: financeLetter.verificationNote || null,
          updatedAt: financeLetter.updatedAt
        } : {
          status: booking.financeLetterStatus || 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        return {
          ...booking,
          documentStatus: {
            kyc: kycStatusObj,
            financeLetter: financeLetterStatusObj,
            dealForm: {
              status: booking.dealFormStatus || 'NOT_UPLOADED'
            },
            deliveryChallan: {
              status: booking.deliveryChallanStatus || 'NOT_UPLOADED'
            }
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        bookings: bookingsWithDocDetails,
        total: bookings.totalDocs,
        pages: bookings.totalPages,
        currentPage: parseInt(page)
      }
    });
    
  } catch (err) {
    console.error('Error getting bookings:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        // Validate booking ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID format'
            });
        }

        // Find the existing booking with all necessary population
        const existingBooking = await Booking.findById(req.params.id)
            .populate('modelDetails')
            .populate('colorDetails')
            .populate('branchDetails')
            .populate('subdealerDetails')
            .populate({ path: 'priceComponents.header', model: 'Header' });

        if (!existingBooking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if booking can be modified
        if (['APPROVED', 'COMPLETED', 'CANCELLED'].includes(existingBooking.status)) {
            return res.status(400).json({
                success: false,
                message: 'Booking cannot be modified in its current status'
            });
        }

        // Initialize update object with existing values
        const updateData = {
            ...existingBooking.toObject(),
            updatedAt: new Date()
        };

        // Helper function to update nested objects
        const updateNestedObject = (target, source, fields) => {
            fields.forEach(field => {
                if (source[field] !== undefined) {
                    target[field] = source[field];
                }
            });
        };

        // Determine entity type (branch or subdealer)
        const entityType = existingBooking.branch ? 'branch' : 'subdealer';
        const entityId = existingBooking.branch || existingBooking.subdealer;
        const entityModel = entityType === 'branch' ? 'Branch' : 'Subdealer';
        const bookingType = existingBooking.bookingType;

        // Update basic fields if provided
        if (req.body.model_id) {
            const model = await Model.findById(req.body.model_id);
            if (!model) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid model selected'
                });
            }
            
            // Check if model type matches customer type for CSD
            if (updateData.customerType === 'CSD' && model.type !== 'CSD') {
                return res.status(400).json({
                    success: false,
                    message: 'Selected model is not available for CSD customers'
                });
            }
            
            updateData.model = req.body.model_id;
        }
        // Add this to the update logic in updateBooking function
if (req.body.note !== undefined) {
  updateData.note = req.body.note;
}
        if (req.body.model_color) {
            const color = await Color.findById(req.body.model_color);
            if (!color) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid color selected'
                });
            }
            
            // Validate color against model
            if (updateData.model) {
                const model = await Model.findById(updateData.model).populate('colors');
                if (!model.colors.some(c => c._id.toString() === req.body.model_color.toString())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Selected color not available for this model'
                    });
                }
            } else if (existingBooking.model) {
                const model = await Model.findById(existingBooking.model).populate('colors');
                if (!model.colors.some(c => c._id.toString() === req.body.model_color.toString())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Selected color not available for this model'
                    });
                }
            }
            
            updateData.color = req.body.model_color;
        }

        if (req.body.customer_type) {
            if (!['B2B', 'B2C', 'CSD'].includes(req.body.customer_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid customer type. Must be B2B, B2C, or CSD'
                });
            }
            updateData.customerType = req.body.customer_type;
            updateData.isCSD = req.body.customer_type === 'CSD';
        }

        if (req.body.rto_type) {
            if (!['MH', 'BH', 'CRTM'].includes(req.body.rto_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid RTO type. Must be MH, BH, or CRTM'
                });
            }
            updateData.rto = req.body.rto_type;
            
            // Set RTO amount based on type
            if (['BH', 'CRTM'].includes(req.body.rto_type)) {
                updateData.rtoAmount = req.body.rto_type === 'BH' ? 5000 : 4500;
            } else {
                updateData.rtoAmount = undefined;
            }
        }

        if (req.body.gstin !== undefined) {
            if (updateData.customerType === 'B2B' && !req.body.gstin) {
                return res.status(400).json({
                    success: false,
                    message: 'GSTIN is required for B2B customers'
                });
            }
            updateData.gstin = req.body.gstin || '';
        }

        if (req.body.hpa !== undefined) {
            updateData.hpa = req.body.hpa;
            
            if (req.body.hpa) {
                const hpaHeader = await Header.findOne({
                    header_key: 'HYPOTHECATION CHARGES (IF APPLICABLE)'
                });
                
                if (hpaHeader) {
                    const model = updateData.model || existingBooking.model;
                    const modelDoc = await Model.findById(model);
                    if (modelDoc) {
                        const hpaPrice = modelDoc.prices.find(
                            p => p.header_id.equals(hpaHeader._id) && 
                                 (entityType === 'branch' ? 
                                     p.branch_id?.equals(entityId) : 
                                     p.subdealer_id?.equals(entityId))
                        );
                        if (hpaPrice) {
                            updateData.hypothecationCharges = hpaPrice.value;
                        }
                    }
                }
            } else {
                updateData.hypothecationCharges = 0;
            }
        }

        // Update customer details if provided
        if (req.body.customer_details) {
            const customerDetails = { ...existingBooking.customerDetails };
            
            if (req.body.customer_details.salutation) {
                const validSalutations = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'];
                if (!validSalutations.includes(req.body.customer_details.salutation)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Valid salutation (Mr., Mrs., Miss, Dr., Prof.) is required'
                    });
                }
                customerDetails.salutation = req.body.customer_details.salutation;
            }
            
            updateNestedObject(customerDetails, req.body.customer_details, [
                'name', 'panNo', 'dob', 'occupation', 'address', 'taluka', 
                'district', 'pincode', 'mobile1', 'mobile2', 'aadharNumber',
                'nomineeName', 'nomineeRelation', 'nomineeAge'
            ]);
            
            if (req.body.customer_details.mobile1) {
                if (!/^[6-9]\d{9}$/.test(req.body.customer_details.mobile1)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid primary mobile number'
                    });
                }
            }
            
            if (req.body.customer_details.mobile2 && req.body.customer_details.mobile2 !== '') {
                if (!/^[6-9]\d{9}$/.test(req.body.customer_details.mobile2)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid secondary mobile number'
                    });
                }
            }
            
            if (req.body.customer_details.pincode) {
                if (!/^[1-9][0-9]{5}$/.test(req.body.customer_details.pincode)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid pincode'
                    });
                }
            }
            
            updateData.customerDetails = customerDetails;
        }

        // Update exchange details if provided (only for branch bookings)
        if (req.body.exchange && req.body.exchange.is_exchange !== undefined) {
            if (req.body.exchange.is_exchange) {
                if (bookingType === 'SUBDEALER') {
                    return res.status(400).json({
                        success: false,
                        message: 'Exchange is not allowed for subdealer bookings'
                    });
                }

                if (!req.body.exchange.broker_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Broker selection is required for exchange'
                    });
                }

                const broker = await Broker.findById(req.body.exchange.broker_id);
                if (!broker) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid broker selected'
                    });
                }

                // Check broker is assigned to this branch
                if (entityType === 'branch' && 
                    !broker.branches.some(b => b.branch.equals(entityId))) {
                    return res.status(400).json({
                        success: false,
                        message: 'Broker not available for this branch'
                    });
                }

                // Check OTP if required
                let otpVerified = false;
                if (broker.otp_required) {
                    if (!req.body.exchange.otp) {
                        return res.status(400).json({
                            success: false,
                            message: 'OTP is required for this broker'
                        });
                    }

                    // Verify OTP
                    const now = new Date();
                    if (!broker.otp || 
                        broker.otp !== req.body.exchange.otp || 
                        !broker.otpExpiresAt || 
                        broker.otpExpiresAt < now) {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid or expired OTP'
                        });
                    }

                    // Clear OTP after verification
                    broker.otp = null;
                    broker.otpExpiresAt = null;
                    await broker.save();
                    otpVerified = true;
                }

                updateData.exchange = true;
                updateData.exchangeDetails = {
                    broker: req.body.exchange.broker_id,
                    price: req.body.exchange.exchange_price,
                    vehicleNumber: req.body.exchange.vehicle_number,
                    chassisNumber: req.body.exchange.chassis_number,
                    otpVerified: otpVerified,
                    status: 'PENDING'
                };

                // ============ ADD BROKER LEDGER CODE HERE ============
                // After exchange validation, handle broker ledger updates
                try {
                    // Check if we need to update ledger (either new exchange or changed exchange details)
                    const exchangePriceChanged = existingBooking.exchangeDetails && 
                        existingBooking.exchangeDetails.price !== req.body.exchange.exchange_price;
                    
                    const brokerChanged = existingBooking.exchangeDetails && 
                        existingBooking.exchangeDetails.broker.toString() !== req.body.exchange.broker_id;
                    
                    if (!existingBooking.exchangeDetails || exchangePriceChanged || brokerChanged) {
                        // Remove old ledger entries if they exist
                        if (existingBooking.brokerLedgerEntries && existingBooking.brokerLedgerEntries.length > 0) {
                            for (const entry of existingBooking.brokerLedgerEntries) {
                                const ledger = await BrokerLedger.findById(entry.ledger);
                                if (ledger) {
                                    // Remove transactions related to this booking
                                    ledger.transactions = ledger.transactions.filter(
                                        t => t.booking && t.booking.toString() !== existingBooking._id.toString()
                                    );
                                    
                                    // Recalculate balance
                                    ledger.currentBalance = ledger.transactions.reduce((balance, txn) => {
                                        return txn.type === 'DEBIT' ? balance + txn.amount : balance - txn.amount;
                                    }, 0);
                                    
                                    await ledger.save();
                                }
                            }
                            updateData.brokerLedgerEntries = [];
                        }
                        
                        // Create new ledger entries
                        let brokerLedger = await BrokerLedger.findOne({ broker: req.body.exchange.broker_id });
                        
                        // Initialize ledger if it doesn't exist
                        if (!brokerLedger) {
                            brokerLedger = new BrokerLedger({
                                broker: req.body.exchange.broker_id,
                                currentBalance: 0,
                                transactions: []
                            });
                        }
                        
                        // Calculate commission
                        const commission = await calculateBrokerCommission(
                            req.body.exchange.broker_id, 
                            req.body.exchange.exchange_price,
                            entityId
                        );
                        
                        // Create debit for exchange amount
                        brokerLedger.transactions.push({
                            type: 'DEBIT',
                            amount: req.body.exchange.exchange_price,
                            modeOfPayment: 'Exchange',
                            remark: `Exchange vehicle: ${req.body.exchange.vehicle_number}`,
                            booking: existingBooking._id,
                            createdBy: req.user.id,
                            date: new Date()
                        });
                        
                        // Create debit for commission if commission is greater than 0
                        if (commission > 0) {
                            brokerLedger.transactions.push({
                                type: 'DEBIT',
                                amount: commission,
                                modeOfPayment: 'Exchange',
                                remark: `Commission for exchange booking ${existingBooking.bookingNumber}`,
                                booking: existingBooking._id,
                                createdBy: req.user.id,
                                date: new Date()
                            });
                        }
                        
                        // Update balance
                        const totalDebit = req.body.exchange.exchange_price + commission;
                        brokerLedger.currentBalance += totalDebit;
                        
                        await brokerLedger.save();
                        
                        // Add reference to ledger in booking update data
                        updateData.brokerLedgerEntries = [{
                            ledger: brokerLedger._id,
                            amount: totalDebit,
                            type: 'EXCHANGE_AND_COMMISSION',
                            createdAt: new Date()
                        }];
                    }
                } catch (error) {
                    console.error('Error updating broker ledger:', error);
                    // Handle broker ledger error appropriately
                }
            } else {
                // Exchange was removed - clean up ledger entries
                try {
                    if (existingBooking.brokerLedgerEntries && existingBooking.brokerLedgerEntries.length > 0) {
                        for (const entry of existingBooking.brokerLedgerEntries) {
                            const ledger = await BrokerLedger.findById(entry.ledger);
                            if (ledger) {
                                // Remove transactions related to this booking
                                ledger.transactions = ledger.transactions.filter(
                                    t => t.booking && t.booking.toString() !== existingBooking._id.toString()
                                );
                                
                                // Recalculate balance
                                ledger.currentBalance = ledger.transactions.reduce((balance, txn) => {
                                    return txn.type === 'DEBIT' ? balance + txn.amount : balance - txn.amount;
                                }, 0);
                                
                                await ledger.save();
                            }
                        }
                        updateData.brokerLedgerEntries = [];
                    }
                } catch (error) {
                    console.error('Error removing broker ledger entries:', error);
                    // Handle broker ledger error appropriately
                }
                
                updateData.exchange = false;
                updateData.exchangeDetails = undefined;
            }
        }

        // Update payment details if provided
        if (req.body.payment !== undefined) {
            if (req.body.payment.type && req.body.payment.type.toLowerCase() === 'finance') {
                if (!req.body.payment.financer_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Financer selection is required'
                    });
                }

                const financer = await FinanceProvider.findById(req.body.payment.financer_id);
                if (!financer) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid financer selected'
                    });
                }

                // Manual GC amount input
                let gcAmount = 0;
                if (req.body.payment.gc_applicable) {
                    if (!req.body.payment.gc_amount || req.body.payment.gc_amount <= 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'GC amount is required and must be greater than 0 when GC is applicable'
                        });
                    }
                    gcAmount = parseFloat(req.body.payment.gc_amount);
                }

                updateData.payment = {
                    type: 'FINANCE',
                    financer: req.body.payment.financer_id,
                    scheme: req.body.payment.scheme || null,
                    emiPlan: req.body.payment.emi_plan || null,
                    gcApplicable: req.body.payment.gc_applicable,
                    gcAmount: gcAmount
                };
            } else {
                updateData.payment = {
                    type: 'CASH'
                };
            }
        }

        // Update accessories if provided
        if (req.body.accessories !== undefined) {
            let accessoriesTotal = 0;
            let accessories = [];

            if (req.body.accessories.selected && req.body.accessories.selected.length > 0) {
                const accessoryIds = req.body.accessories.selected.map(acc => {
                    if (!mongoose.Types.ObjectId.isValid(acc.id)) {
                        throw new Error(`Invalid accessory ID: ${acc.id}`);
                    }
                    return new mongoose.Types.ObjectId(acc.id);
                });

                const validAccessories = await Accessory.find({
                    _id: { $in: accessoryIds },
                    status: 'active'
                });

                if (validAccessories.length !== req.body.accessories.selected.length) {
                    const missingIds = req.body.accessories.selected
                        .filter(a => !validAccessories.some(v => v._id.toString() === a.id))
                        .map(a => a.id);
                    return res.status(400).json({
                        success: false,
                        message: `Invalid accessory IDs: ${missingIds.join(', ')}`
                    });
                }

                const model = updateData.model || existingBooking.model;
                const incompatibleAccessories = validAccessories.filter(
                    a => !a.applicable_models.some(m => m.toString() === model.toString())
                );
                if (incompatibleAccessories.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Incompatible accessories: ${
                            incompatibleAccessories.map(a => a.name).join(', ')
                        }`
                    });
                }

                const accessoriesTotalHeader = await Header.findOne({
                    header_key: 'ACCESSORIES TOTAL',
                    type: existingBooking.modelDetails.type
                });
                
                if (!accessoriesTotalHeader) {
                    return res.status(400).json({
                        success: false,
                        message: 'ACCESSORIES TOTAL header not configured'
                    });
                }

                const modelDoc = await Model.findById(model);
                const accessoriesTotalPrice = modelDoc.prices.find(
                    p => p.header_id.equals(accessoriesTotalHeader._id) && 
                         (entityType === 'branch' ? 
                             p.branch_id?.equals(entityId) : 
                             p.subdealer_id?.equals(entityId))
                )?.value || 0;

                const selectedAccessoriesTotal = validAccessories.reduce(
                    (sum, acc) => sum + acc.price, 
                    0
                );

                accessoriesTotal = Math.max(selectedAccessoriesTotal, accessoriesTotalPrice);
                
                accessories = validAccessories.map(acc => ({
                    accessory: acc._id,
                    price: acc.price,
                    discount: 0
                }));

                if (selectedAccessoriesTotal < accessoriesTotalPrice) {
                    const difference = accessoriesTotalPrice - selectedAccessoriesTotal;
                    accessories.push({
                        accessory: null, 
                        price: difference,
                        discount: 0
                    });
                }
            }

            updateData.accessories = accessories;
            updateData.accessoriesTotal = accessoriesTotal;
        }

        // Update price components if provided
        if (req.body.price_components !== undefined) {
            const model = updateData.model || existingBooking.model;
            const modelDoc = await Model.findById(model);
            const headers = await Header.find({ type: modelDoc.type });

            const priceComponents = await Promise.all(headers.map(async (header) => {
                const priceData = modelDoc.prices.find(
                    p => p.header_id.equals(header._id) && 
                         (entityType === 'branch' ? 
                             p.branch_id?.equals(entityId) : 
                             p.subdealer_id?.equals(entityId))
                );

                if (!priceData) return null;

                const updatedComponent = req.body.price_components.find(
                    pc => pc.header_id && pc.header_id.toString() === header._id.toString()
                );

                if (!updatedComponent) {
                    const existingComponent = existingBooking.priceComponents.find(
                        pc => pc.header && pc.header.toString() === header._id.toString()
                    );
                    return existingComponent || null;
                }

                if (header.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
                    return {
                        header: header._id,
                        originalValue: priceData.value,
                        discountedValue: updateData.hpa ? priceData.value : 0,
                        isDiscountable: false,
                        isMandatory: false,
                        metadata: priceData.metadata || {}
                    };
                }

                if (header.is_mandatory) {
                    return {
                        header: header._id,
                        originalValue: priceData.value,
                        discountedValue: updatedComponent.discounted_value || priceData.value,
                        isDiscountable: header.is_discount,
                        isMandatory: true,
                        metadata: priceData.metadata || {}
                    };
                }

                return {
                    header: header._id,
                    originalValue: priceData.value,
                    discountedValue: updatedComponent.discounted_value || priceData.value,
                    isDiscountable: header.is_discount,
                    isMandatory: false,
                    metadata: priceData.metadata || {}
                };
            }));

            updateData.priceComponents = priceComponents.filter(c => c !== null);
        }

        // Update discounts if provided
        if (req.body.discounts !== undefined) {
            let discounts = [];
            let totalDiscount = 0;

            if (Array.isArray(req.body.discounts)) {
                for (const discount of req.body.discounts) {
                    if (!discount.amount || !discount.type) continue;

                    discounts.push({
                        amount: discount.amount,
                        type: discount.type.toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
                        approvedBy: discount.approved ? req.user._id : undefined,
                        approvalStatus: discount.approved ? 'APPROVED' : 'PENDING',
                        approvalNote: discount.note || '',
                        appliedOn: new Date()
                    });
                }
            }

            if (discounts.length > 0) {
                const priceComponents = updateData.priceComponents || existingBooking.priceComponents;
                let updatedComponents = [...priceComponents];
                
                for (const discount of discounts) {
                    updatedComponents = calculateDiscounts(updatedComponents, discount.amount, discount.type);
                    validateDiscountLimits(updatedComponents);
                }

                totalDiscount = priceComponents.reduce((sum, component) => {
                    const updated = updatedComponents.find(
                        uc => uc.header?.toString() === component.header?.toString()
                    );
                    return sum + (component.originalValue - (updated?.discountedValue || component.discountedValue));
                }, 0);

                updateData.priceComponents = updatedComponents;
            }

            updateData.discounts = discounts;
            
            const baseAmount = (updateData.priceComponents || existingBooking.priceComponents)
                .reduce((sum, c) => sum + c.originalValue, 0);
            
            updateData.totalAmount = baseAmount + (updateData.accessoriesTotal || existingBooking.accessoriesTotal) + 
                                  (updateData.rtoAmount || existingBooking.rtoAmount || 0);
            
            updateData.discountedAmount = updateData.totalAmount - totalDiscount;
        }

        // Update user assignment based on booking type
        if (bookingType === 'SUBDEALER') {
            // For subdealer booking, ensure subdealer user is active
            if (req.body.subdealer_user) {
                const subdealerRole = await Role.findOne({ name: 'SUBDEALER' });
                if (!subdealerRole) {
                    return res.status(400).json({
                        success: false,
                        message: 'SUBDEALER role not found in system'
                    });
                }

                const subdealerUser = await User.findOne({ 
                    _id: req.body.subdealer_user,
                    subdealer: entityId,
                    roles: subdealerRole._id,
                    status: 'ACTIVE'
                }).populate('roles');
                
                if (!subdealerUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'No active subdealer user found for this subdealer'
                    });
                }
                
                updateData.subdealerUser = subdealerUser._id;
            }
        } else {
            // For branch booking, handle sales executive
            if (req.body.sales_executive !== undefined) {
                if (req.body.sales_executive) {
                    const salesExecutive = await User.findById(req.body.sales_executive)
                        .populate('roles');
                    
                    if (!salesExecutive || salesExecutive.status !== 'ACTIVE') {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid or inactive sales executive selected'
                        });
                    }

                    const isSalesExecutive = salesExecutive.roles.some(r => 
                        r.name === 'SALES_EXECUTIVE'
                    );
                    
                    if (!isSalesExecutive) {
                        return res.status(400).json({
                            success: false,
                            message: 'Selected user must have SALES_EXECUTIVE role'
                        });
                    }

                    if (!salesExecutive.branch || 
                        salesExecutive.branch.toString() !== entityId.toString()) {
                        return res.status(400).json({
                            success: false,
                            message: 'Sales executive must belong to the booking branch'
                        });
                    }

                    updateData.salesExecutive = req.body.sales_executive;
                } else {
                    updateData.salesExecutive = existingBooking.createdBy;
                }
            }
        }

        // Update status if provided
        if (req.body.status !== undefined) {
            const validStatuses = [
                'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 
                'COMPLETED', 'CANCELLED', 'KYC_PENDING', 'KYC_VERIFIED',
                'PENDING_APPROVAL (Discount_Exceeded)'
            ];
            
            if (!validStatuses.includes(req.body.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status provided'
                });
            }

            const allowedStatusUpdates = {
                SALES_EXECUTIVE: ['PENDING_APPROVAL'],
                MANAGER: ['APPROVED', 'REJECTED', 'KYC_PENDING', 'KYC_VERIFIED'],
                ADMIN: ['COMPLETED', 'CANCELLED']
            };

            const userRoles = req.user.roles.map(r => r.name);
            let canUpdateStatus = false;

            for (const [role, statuses] of Object.entries(allowedStatusUpdates)) {
                if (userRoles.includes(role) && statuses.includes(req.body.status)) {
                    canUpdateStatus = true;
                    break;
                }
            }

            if (!canUpdateStatus && !req.user.isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update status to this value'
                });
            }

            updateData.status = req.body.status;
            
            if (req.body.status === 'APPROVED') {
                updateData.approvedBy = req.user._id;
            }
        }

        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        )
        .populate('modelDetails')
        .populate('colorDetails')
        .populate(entityType === 'branch' ? 'branchDetails' : 'subdealerDetails')
        .populate('createdByDetails')
        .populate(bookingType === 'SUBDEALER' ? 'subdealerUserDetails' : 'salesExecutiveDetails')
        .populate({ path: 'priceComponents.header', model: 'Header' })
        .populate({ path: 'accessories.accessory', model: 'Accessory' })
        .populate({ path: 'exchangeDetails.broker', model: 'Broker' })
        .populate({ path: 'payment.financer', model: 'FinanceProvider' });

        // Regenerate the booking form HTML after update
        try {
            const formResult = await generateBookingFormHTML(updatedBooking);
            updatedBooking.formPath = formResult.url;
            updatedBooking.formGenerated = true;
            await updatedBooking.save();
        } catch (pdfError) {
            console.error('Error regenerating booking form after update:', pdfError);
            // Continue even if HTML generation fails
        }

        await AuditLog.create({
            action: 'UPDATE',
            entity: 'Booking',
            entityId: updatedBooking._id,
            user: req.user._id,
            ip: req.ip,
            metadata: {
                oldData: existingBooking.toObject(),
                newData: updatedBooking.toObject(),
                updatedFields: Object.keys(req.body)
            },
            status: 'SUCCESS'
        });

        // Transform the response to show the correct user field based on booking type
        const responseData = updatedBooking.toObject();
        if (responseData.bookingType === 'SUBDEALER') {
            responseData.subdealerUser = responseData.subdealerUserDetails;
            delete responseData.salesExecutive;
            delete responseData.salesExecutiveDetails;
        } else {
            responseData.salesExecutive = responseData.salesExecutiveDetails;
        }

        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (err) {
        console.error('Error updating booking:', err);
        
        let message = 'Error updating booking';
        if (err.name === 'ValidationError') {
            message = Object.values(err.errors).map(val => val.message).join(', ');
        } else if (err.message) {
            message = err.message;
        }

        await AuditLog.create({
            action: 'UPDATE',
            entity: 'Booking',
            entityId: req.params.id,
            user: req.user?._id,
            ip: req.ip,
            status: 'FAILED',
            metadata: req.body,
            error: message
        }).catch(logErr => console.error('Failed to create audit log:', logErr));
        
        res.status(400).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// Reject booking
exports.rejectBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking needs approval
    if (booking.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Booking does not require approval'
      });
    }

    // Update booking status
    booking.status = 'REJECTED';
    booking.approvedBy = req.user.id;
    
    // Update discount approval status
    booking.discounts = booking.discounts.map(d => ({
      ...d.toObject(),
      approvedBy: req.user.id,
      approvalStatus: 'REJECTED',
      approvalNote: req.body.rejectionNote
    }));

    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'REJECT',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        rejectionNote: req.body.rejectionNote
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error rejecting booking:', err);
    
    await AuditLog.create({
      action: 'REJECT',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error rejecting booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Complete booking
exports.completeBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be completed
    if (booking.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only APPROVED bookings can be completed'
      });
    }

    // Update booking status
    booking.status = 'COMPLETED';
    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'COMPLETE',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error completing booking:', err);
    
    await AuditLog.create({
      action: 'COMPLETE',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error completing booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled in its current state'
      });
    }

    // Update booking status
    booking.status = 'CANCELLED';
    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'CANCEL',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        cancellationReason: req.body.cancellationReason
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    
    await AuditLog.create({
      action: 'CANCEL',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get booking with documents
exports.getBookingWithDocuments = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('model')
      .populate('color')
      .populate('branch')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Get KYC and Finance Letter status
    const [kyc, financeLetter] = await Promise.all([
      KYC.findOne({ booking: bookingId })
        .select('status verificationNote verifiedBy verificationDate')
        .populate('verifiedBy', 'name'),
      FinanceLetter.findOne({ booking: bookingId })
        .select('status verificationNote verifiedBy verificationDate')
        .populate('verifiedBy', 'name')
    ]);

    const response = {
      ...booking.toObject(),
      kycStatus: booking.kycStatus,
      kycDetails: kyc ? {
        status: kyc.status,
        verificationNote: kyc.verificationNote,
        verifiedBy: kyc.verifiedBy?.name,
        verificationDate: kyc.verificationDate
      } : null,
      financeLetterStatus: booking.financeLetterStatus,
      financeLetterDetails: financeLetter ? {
        status: financeLetter.status,
        verificationNote: financeLetter.verificationNote,
        verifiedBy: financeLetter.verifiedBy?.name,
        verificationDate: financeLetter.verificationDate
      } : null
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error getting booking with documents:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Check if booking is ready for delivery
exports.checkReadyForDelivery = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if all requirements are met
    const requirements = {
      bookingApproved: booking.status === 'APPROVED',
      kycApproved: booking.kycStatus === 'APPROVED',
      financeLetterApproved: booking.payment.type === 'FINANCE' ? 
        booking.financeLetterStatus === 'APPROVED' : true
    };

    const isReady = Object.values(requirements).every(val => val === true);
    const missingRequirements = Object.entries(requirements)
      .filter(([_, val]) => !val)
      .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());

    res.status(200).json({
      success: true,
      data: {
        isReady,
        requirements,
        missingRequirements: isReady ? [] : missingRequirements
      }
    });

  } catch (err) {
    console.error('Error checking delivery readiness:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while checking delivery readiness',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get update form
exports.getUpdateForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('salesExecutiveDetails');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Get the model with its colors populated
    const model = await Model.findById(booking.model)
      .populate('colors');

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Prepare data for the template with proper URLs
    const formData = {
      booking: {
        ...booking.toObject(),
        modelDetails: booking.modelDetails,
        colorDetails: booking.colorDetails,
        _id: booking._id,
        // Update any file paths to use the base URL
        formPath: booking.formPath ? `${process.env.BASE_URL}${booking.formPath}` : null
      },
      modelDetails: {
        ...model.toObject(),
        colors: model.colors
      },
      // Add base URL to template data
      baseUrl: process.env.BASE_URL
    };

    // Get the template path relative to this file
    const templatePath = path.join(__dirname, '..', 'templates', 'updateFormTemplate.html');
    
    // Verify template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }

    // Load the update form template
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const updateFormTemplate = Handlebars.compile(templateHtml);

    // Generate HTML content
    const html = updateFormTemplate(formData);

    // Set response headers for HTML content
    res.set('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (err) {
    console.error('Error getting update form:', err);
    
    await AuditLog.create({
      action: 'VIEW_UPDATE_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching update form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get fully paid pending RTO bookings
exports.getFullyPaidPendingRTOBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      balanceAmount: 0,
      rtoStatus: 'pending'
    }).lean().populate({
        path: "model",
        select: "model_name type",
      });

    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Error fetching fully paid & pending RTO bookings:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
// Allocate chassis number to booking with claim functionality
exports.allocateChassisNumber = async (req, res) => {
  // Define status constants for better maintainability
  const STATUS = {
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    ALLOCATED: 'ALLOCATED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  };

  try {
    // 1. Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID format' 
      });
    }

    // 2. Extract data from both form-data and query params
    const { chassisNumber, hasClaim, priceClaim, description } = req.body;
    const { reason } = req.query; // Get reason from query params

    // 3. Validate chassis number format
    if (!chassisNumber || !/^[A-Z0-9]{17}$/.test(chassisNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Chassis number must be exactly 17 alphanumeric characters'
      });
    }

    // 4. Find booking and validate existence
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    // 5. Determine allocation scenario
    const isInitialAllocation = !booking.chassisNumber;
    const isChangeAfterAllocation = booking.chassisNumber && booking.status === STATUS.ALLOCATED;
    const hasPendingClaim = hasClaim === 'true';

    // 6. Validate reason for post-allocation changes
    if (isChangeAfterAllocation) {
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for chassis number change after allocation'
        });
      }

      if (!booking.chassisNumberChangeAllowed) {
        return res.status(400).json({
          success: false,
          message: 'No more chassis number changes allowed for this booking'
        });
      }
    }

    // 7. Process claim if exists
    if (hasPendingClaim) {
      if (!priceClaim || !description) {
        return res.status(400).json({
          success: false,
          message: 'Both priceClaim and description are required when hasClaim is true'
        });
      }

      const files = req.files || [];
      if (files.length > 6) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 6 documents allowed for claims'
        });
      }

      const documents = files.map(file => ({
        path: `/claims/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));

      booking.claimDetails = {
        hasClaim: true,
        priceClaim,
        description,
        documents,
        createdAt: new Date(),
        createdBy: req.user.id
      };
    }

    // 8. Record history if changing existing number
    if (booking.chassisNumber) {
      booking.chassisNumberHistory.push({
        number: booking.chassisNumber,
        changedAt: new Date(),
        changedBy: req.user.id,
        reason: reason || 'Initial allocation',
        statusAtChange: booking.status
      });
    }

    // 9. Update chassis number (always uppercase)
    booking.chassisNumber = chassisNumber.toUpperCase();

    // 10. Update status based on business rules
    if (isInitialAllocation) {
      booking.status = hasPendingClaim ? STATUS.ALLOCATED : STATUS.ALLOCATED;
      booking.chassisNumberChangeAllowed = true;
    } 
    else if (isChangeAfterAllocation) {
      booking.chassisNumberChangeAllowed = false;
      
      // Only update status if not already in an allocated state
      if (![STATUS.ALLOCATED, STATUS.ALLOCATED].includes(booking.status)) {
        booking.status = hasPendingClaim ? STATUS.ALLOCATED : STATUS.ALLOCATED;
      }
    }
    else {
      // For other cases (like changing chassis number when status wasn't ALLOCATED)
      booking.status = hasPendingClaim ? STATUS.ALLOCATED : STATUS.ALLOCATED;
    }

    // 11. Save the updated booking
    await booking.save();

    // 12. Return appropriate response
    let message;
    if (isInitialAllocation) {
      message = hasPendingClaim 
        ? 'Chassis number allocated with claim successfully' 
        : 'Chassis number allocated successfully';
    } else {
      message = hasPendingClaim
        ? 'Chassis number updated with claim successfully'
        : 'Chassis number updated successfully';
    }

    res.status(200).json({
      success: true,
      data: booking,
      message
    });
      const vehicle = await Vehicle.findOne({ chassisNumber: req.body.chassisNumber });
    if (vehicle) {
      // Link vehicle to booking
      booking.vehicleRef = vehicle._id;
      
      // Always set to in_stock when first allocated
      vehicle.status = 'in_stock';
      await vehicle.save();
    }

  } catch (err) {
    console.error('Error in allocateChassisNumber:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during chassis allocation',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get bookings by insurance status
exports.getBookingsByInsuranceStatus = async (req, res, next) => {
  try {
    const { status } = req.params;

    const allowedStatuses = ['AWAITING', 'COMPLETED', 'LATER'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid insuranceStatus. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    const options = {
      populate: [
        { path: 'modelDetails' },
        { path: 'colorDetails' },
        { path: 'branchDetails' },
        { path: 'createdByDetails' },
        { path: 'salesExecutiveDetails' }
      ],
      sort: { createdAt: -1 },
      lean: true
    };

    const query = {
      insuranceStatus: status,
      chassisNumber: { $exists: true, $ne: '' } // ensure chassisNumber exists and is not empty
    };

    const bookings = await Booking.paginate(query, options);

    res.status(200).json({
      success: true,
      count: bookings.docs.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings by insuranceStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get bookings by subdealer
exports.getBookingsBySubdealer = async (req, res) => {
  try {
    const { subdealerId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      status, 
      fromDate, 
      toDate,
      customerType,
      model,
      kycStatus,
      financeLetterStatus
    } = req.query;

    // Validate subdealer ID
    if (!mongoose.Types.ObjectId.isValid(subdealerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subdealer ID format'
      });
    }

    // Check if subdealer exists
    const subdealerExists = await mongoose.model('Subdealer').exists({ _id: subdealerId });
    if (!subdealerExists) {
      return res.status(404).json({
        success: false,
        message: 'Subdealer not found'
      });
    }

    // Build filter object
    const filter = {
      subdealer: subdealerId,
      bookingType: 'SUBDEALER'
    };

    // Status filter
    if (status) {
      filter.status = status;
    }
    
    // Customer type filter
    if (customerType) {
      filter.customerType = customerType;
    }
    
    // Model filter
    if (model) {
      filter.model = model;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Permission check - ensure user has access to this subdealer's data
    if (!req.user.isSuperAdmin) {
      // For subdealer users, they can only see their own subdealer's bookings
      if (req.user.subdealer && req.user.subdealer.toString() !== subdealerId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view bookings for your assigned subdealer'
        });
      }
      
      // For branch users, they might have limited access
      if (req.user.branch) {
        // Add additional permission checks if needed for branch users
        if (!req.user.roles.some(role => ['MANAGER', 'ADMIN'].includes(role.name))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient permissions'
          });
        }
      }
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }, // Newest first
      populate: [
        'model',
        { path: 'color', select: 'name code' },
        'subdealer',
        {
          path: 'createdBy',
          select: 'name email'
        },
        {
          path: 'subdealerUser',
          select: 'name email'
        },
        {
          path: 'payment.financer',
          select: 'name'
        }
      ],
      lean: true
    };

    // Get paginated bookings
    let bookings = await Booking.paginate(filter, options);

    // Get KYC and Finance Letter details for each booking
    const bookingsWithDocStatus = await Promise.all(
      bookings.docs.map(async (booking) => {
        const [kyc, financeLetter] = await Promise.all([
          mongoose.model('KYC').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean(),
          mongoose.model('FinanceLetter').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean()
        ]);
        
        // Create simplified status objects
        const kycStatusObj = kyc ? {
          status: kyc.status,
          verifiedBy: kyc.verifiedBy?.name || null,
          verificationNote: kyc.verificationNote || null,
          updatedAt: kyc.updatedAt
        } : {
          status: 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        const financeLetterStatusObj = financeLetter ? {
          status: financeLetter.status,
          verifiedBy: financeLetter.verifiedBy?.name || null,
          verificationNote: financeLetter.verificationNote || null,
          updatedAt: financeLetter.updatedAt
        } : {
          status: 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        // Apply additional filtering if KYC or Finance Letter status filters were provided
        let includeBooking = true;
        if (kycStatus && kycStatusObj.status !== kycStatus) {
          includeBooking = false;
        }
        if (financeLetterStatus && financeLetterStatusObj.status !== financeLetterStatus) {
          includeBooking = false;
        }

        return includeBooking ? {
          ...booking,
          documentStatus: {
            kyc: kycStatusObj,
            financeLetter: financeLetterStatusObj
          }
        } : null;
      })
    );

    // Filter out null bookings (excluded by document status filters)
    const filteredBookings = bookingsWithDocStatus.filter(booking => booking !== null);
    
    // Adjust pagination counts
    const adjustedTotal = filteredBookings.length === bookings.docs.length ? 
      bookings.totalDocs : 
      await Booking.countDocuments({ ...filter, 
        ...(kycStatus && { 'documentStatus.kyc.status': kycStatus }),
        ...(financeLetterStatus && { 'documentStatus.financeLetter.status': financeLetterStatus })
      });
    
    const adjustedPages = Math.ceil(adjustedTotal / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        subdealer: subdealerId,
        bookings: filteredBookings,
        total: adjustedTotal,
        pages: adjustedPages,
        currentPage: parseInt(page)
      }
    });

  } catch (err) {
    console.error('Error getting bookings by subdealer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subdealer bookings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get deal form document
exports.getDealForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if deal form exists
    if (!booking.dealForm || !booking.dealForm.path) {
      return res.status(404).json({
        success: false,
        message: 'Deal form not found for this booking'
      });
    }

    // Construct the full file path
    const filePath = path.join(__dirname, '../', booking.dealForm.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Deal form file not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', booking.dealForm.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${booking.dealForm.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    await AuditLog.create({
      action: 'DOWNLOAD_DEAL_FORM',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user?.id,
      ip: req.ip,
      status: 'SUCCESS',
      metadata: {
        filename: booking.dealForm.originalName,
        size: booking.dealForm.size
      }
    });

  } catch (err) {
    console.error('Error getting deal form:', err);
    
    await AuditLog.create({
      action: 'DOWNLOAD_DEAL_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching deal form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get delivery challan document
exports.getDeliveryChallan = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if delivery challan exists
    if (!booking.deliveryChallan || !booking.deliveryChallan.path) {
      return res.status(404).json({
        success: false,
        message: 'Delivery challan not found for this booking'
      });
    }

    // Construct the full file path
    const filePath = path.join(__dirname, '../', booking.deliveryChallan.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Delivery challan file not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', booking.deliveryChallan.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${booking.deliveryChallan.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    await AuditLog.create({
      action: 'DOWNLOAD_DELIVERY_CHALLAN',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user?.id,
      ip: req.ip,
      status: 'SUCCESS',
      metadata: {
        filename: booking.deliveryChallan.originalName,
        size: booking.deliveryChallan.size
      }
    });

  } catch (err) {
    console.error('Error getting delivery challan:', err);
    
    await AuditLog.create({
      action: 'DOWNLOAD_DELIVERY_CHALLAN',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching delivery challan',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get subdealer booking statistics
exports.getSubdealerBookingStats = async (req, res) => {
  try {
    const { subdealerId } = req.params;

    // Validate subdealer ID
    if (!mongoose.Types.ObjectId.isValid(subdealerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subdealer ID format'
      });
    }

    // Check if subdealer exists
    const subdealerExists = await mongoose.model('Subdealer').exists({ _id: subdealerId });
    if (!subdealerExists) {
      return res.status(404).json({
        success: false,
        message: 'Subdealer not found'
      });
    }

    // Permission check
    if (!req.user.isSuperAdmin && req.user.subdealer?.toString() !== subdealerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get booking counts for different time periods
    const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
      Booking.countDocuments({
        subdealer: subdealerId,
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        subdealer: subdealerId,
        createdAt: { $gte: weekStart }
      }),
      Booking.countDocuments({
        subdealer: subdealerId,
        createdAt: { $gte: monthStart }
      }),
      Booking.countDocuments({ subdealer: subdealerId })
    ]);

    // Get status counts
    const statusCounts = await Booking.aggregate([
      { $match: { subdealer: new mongoose.Types.ObjectId(subdealerId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get document status counts
    const [kycPending, financeLetterPending] = await Promise.all([
      Booking.countDocuments({
        subdealer: subdealerId,
        kycStatus: 'PENDING'
      }),
      Booking.countDocuments({
        subdealer: subdealerId,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE'
      })
    ]);

    // Format status counts
    const statusSummary = {};
    statusCounts.forEach(item => {
      statusSummary[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        counts: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount,
          total: totalCount
        },
        statusSummary,
        pendingDocuments: {
          kyc: kycPending,
          financeLetter: financeLetterPending
        }
      }
    });

  } catch (err) {
    console.error('Error getting subdealer booking stats:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subdealer booking statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


