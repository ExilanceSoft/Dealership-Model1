const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Accessory = require('../models/Accessory');
const Broker = require('../models/Broker');
const FinanceProvider = require('../models/FinanceProvider');
const FinancerRate = require('../models/FinancerRate');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Color = require('../models/Color');

// Helper function to calculate discounts
const calculateDiscounts = (priceComponents, discountAmount, discountType) => {
  const eligibleComponents = priceComponents.filter(c => 
    c.isDiscountable && c.headerDetails?.header_key !== 'HYPOTHECATION CHARGES (IF APPLICABLE)'
  );

  if (eligibleComponents.length === 0 && discountAmount > 0) {
    throw new Error('No discountable components available');
  }

  eligibleComponents.sort((a, b) => {
    const gstA = a.headerDetails?.metadata?.gst_rate || 0;
    const gstB = b.headerDetails?.metadata?.gst_rate || 0;
    return gstB - gstA;
  });

  const totalEligible = eligibleComponents.reduce((sum, c) => sum + c.originalValue, 0);
  let remainingDiscount = discountType === 'PERCENTAGE' 
    ? (totalEligible * discountAmount) / 100 
    : discountAmount;

  return priceComponents.map(component => {
    if (component.headerDetails?.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
      return component;
    }
    
    if (!component.isDiscountable) {
      return component;
    }

    const targetComponent = eligibleComponents.find(c => c.header === component.header);
    if (!targetComponent || remainingDiscount <= 0) {
      return component;
    }

    const maxDiscount = component.originalValue * 0.95;
    const desiredDiscount = Math.min(maxDiscount, remainingDiscount);
    remainingDiscount -= desiredDiscount;

    return {
      ...component,
      discountedValue: component.originalValue - desiredDiscount
    };
  });
};

const validateDiscountLimits = (priceComponents) => {
  const violations = priceComponents.filter(
    c => c.isDiscountable && 
         c.headerDetails?.header_key !== 'HYPOTHECATION CHARGES (IF APPLICABLE)' &&
         c.discountedValue < (0.05 * c.originalValue)
  );

  if (violations.length > 0) {
    const itemNames = violations.map(v => v.headerDetails?.header_key).join(', ');
    throw new Error(`Discount cannot exceed 95% for: ${itemNames}`);
  }
};

exports.createBooking = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = [
      { field: 'model_id', message: 'Model selection is required' },
      { field: 'model_color', message: 'Color selection is required' },
      { field: 'customer_type', message: 'Customer type (B2B/B2C) is required' },
      { field: 'rto_type', message: 'RTO state (MH/BH/CRTM) is required' },
      { field: 'customer_details', message: 'Customer details are required' },
      { field: 'payment', message: 'Payment details are required' }
    ];
    
    const missingFields = requiredFields.filter(item => !req.body[item.field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.map(f => f.message).join(', ')}`
      });
    }

    // Check user permissions and branch
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    let branchId = req.body.branch;
    
    if (!isSuperAdmin) {
      if (!req.user.branch) {
        return res.status(400).json({
          success: false,
          message: 'Your account is not associated with any branch'
        });
      }
      branchId = req.user.branch;
      
      if (req.body.branch && req.body.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create bookings for your own branch'
        });
      }
    } else {
      if (!req.body.branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch selection is required'
        });
      }
      
      const branchExists = await mongoose.model('Branch').exists({ _id: req.body.branch });
      if (!branchExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid branch selected'
        });
      }
    }

    // Validate sales executive selection
    if (req.body.sales_executive) {
      if (!mongoose.Types.ObjectId.isValid(req.body.sales_executive)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sales executive ID format'
        });
      }

      const salesExecutive = await User.findById(req.body.sales_executive)
        .populate('roles');
      
      if (!salesExecutive || !salesExecutive.isActive) {
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
          salesExecutive.branch.toString() !== branchId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Sales executive must belong to the selected branch'
        });
      }
    }

    // Validate salutation
    const validSalutations = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'];
    if (!req.body.customer_details.salutation || 
        !validSalutations.includes(req.body.customer_details.salutation)) {
      return res.status(400).json({
        success: false,
        message: 'Valid salutation (Mr., Mrs., Miss, Dr., Prof.) is required'
      });
    }

    // Validate model and color
    const model = await Model.findById(req.body.model_id).populate('colors');
    if (!model) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model selected'
      });
    }

    const color = await Color.findById(req.body.model_color);
    if (!color || !model.colors.some(c => c._id.toString() === req.body.model_color.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color selected'
      });
    }

    // Validate GSTIN for B2B
    if (req.body.customer_type === 'B2B' && !req.body.gstin) {
      return res.status(400).json({
        success: false,
        message: 'GSTIN is required for B2B customers'
      });
    }

    // Get all headers
    const headers = await Header.find({ type: model.type }).sort({ priority: 1 });

    // Create price components with mandatory/optional handling
    const priceComponents = await Promise.all(headers.map(async (header) => {
      const priceData = model.prices.find(
        p => p.header_id.equals(header._id) && p.branch_id.equals(branchId)
      );

      // Skip if no price data found for this branch
      if (!priceData) return null;

      // Special handling for hypothecation charges
      if (header.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
        return {
          header: header._id,
          headerDetails: header,
          originalValue: priceData.value,
          discountedValue: req.body.hpa ? priceData.value : 0,
          isDiscountable: false,
          isMandatory: false,
          metadata: priceData.metadata || {}
        };
      }

      // Handle mandatory components - always include these
      if (header.is_mandatory) {
        return {
          header: header._id,
          headerDetails: header,
          originalValue: priceData.value,
          discountedValue: priceData.value,
          isDiscountable: header.is_discount,
          isMandatory: true,
          metadata: priceData.metadata || {}
        };
      }

      // Handle optional components - only include if explicitly selected
      if (req.body.optionalComponents && 
          Array.isArray(req.body.optionalComponents) &&
          req.body.optionalComponents.includes(header._id.toString())) {
        return {
          header: header._id,
          headerDetails: header,
          originalValue: priceData.value,
          discountedValue: priceData.value,
          isDiscountable: header.is_discount,
          isMandatory: false,
          metadata: priceData.metadata || {}
        };
      }

      // Skip all other optional components that weren't selected
      return null;
    }));

    // Filter out null components
    const filteredComponents = priceComponents.filter(c => c !== null);

    // Verify at least one price component exists
    if (filteredComponents.length === 0) {
      throw new Error('No valid price components found for this model and branch');
    }

    // Calculate base amount using filtered components
    const baseAmount = filteredComponents.reduce((sum, c) => sum + c.discountedValue, 0);

    // Set HPA charges
    const hpaHeader = headers.find(h => h.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)');
    req.body.hypothecationCharges = req.body.hpa 
      ? (model.prices.find(
          p => p.header_id.equals(hpaHeader?._id) && p.branch_id.equals(branchId))
        )?.value || 0 
      : 0;

    // Set RTO amount
    let rtoAmount = 0;
    if (['BH', 'CRTM'].includes(req.body.rto_type)) {
      rtoAmount = req.body.rto_type === 'BH' ? 5000 : 4500;
    }

    // Handle accessories
    let accessoriesTotal = 0;
    let accessories = [];

    if (req.body.accessories?.selected?.length > 0) {
      const accessoryIds = req.body.accessories.selected.map(acc => {
        if (!mongoose.Types.ObjectId.isValid(acc.id)) {
          throw new Error(`Invalid accessory ID: ${acc.id}`);
        }
        return new mongoose.Types.ObjectId(acc.id);
      });

      const validAccessories = await Accessory.find({
        _id: { $in: accessoryIds },
        status: 'active'
      }).lean();

      if (validAccessories.length !== req.body.accessories.selected.length) {
        const missingIds = req.body.accessories.selected
          .filter(a => !validAccessories.some(v => v._id.toString() === a.id))
          .map(a => a.id);
        throw new Error(`Invalid accessory IDs: ${missingIds.join(', ')}`);
      }

      const incompatibleAccessories = validAccessories.filter(
        a => !a.applicable_models.some(m => m.toString() === req.body.model_id.toString())
      );
      if (incompatibleAccessories.length > 0) {
        throw new Error(`Incompatible accessories: ${
          incompatibleAccessories.map(a => a.name).join(', ')
        }`);
      }

      const accessoriesTotalHeader = await Header.findOne({
        header_key: 'ACCESSORIES TOTAL',
        type: model.type
      });
      if (!accessoriesTotalHeader) {
        throw new Error('ACCESSORIES TOTAL header not configured');
      }

      const accessoriesTotalPrice = model.prices.find(
        p => p.header_id.equals(accessoriesTotalHeader._id) && 
             p.branch_id.equals(branchId)
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

    // Handle exchange
    let exchangeDetails = null;
    if (req.body.exchange?.is_exchange) {
      if (!req.body.exchange.broker_id) {
        throw new Error('Broker selection is required for exchange');
      }

      const broker = await Broker.findById(req.body.exchange.broker_id);
      if (!broker) {
        throw new Error('Invalid broker selected');
      }

      if (!broker.branches.some(b => b.branch.equals(branchId))) {
        throw new Error('Broker not available for this branch');
      }

      exchangeDetails = {
        broker: req.body.exchange.broker_id,
        price: req.body.exchange.exchange_price,
        vehicleNumber: req.body.exchange.vehicle_number,
        chassisNumber: req.body.exchange.chassis_number
      };
    }

    // Handle payment
    let payment = {};
    if (req.body.payment.type.toLowerCase() === 'finance') {
      if (!req.body.payment.financer_id) {
        throw new Error('Financer selection is required');
      }

      const financer = await FinanceProvider.findById(req.body.payment.financer_id);
      if (!financer) {
        throw new Error('Invalid financer selected');
      }

      let gcAmount = 0;
      if (req.body.payment.gc_applicable) {
        const financerRate = await FinancerRate.findOne({
          financeProvider: req.body.payment.financer_id,
          branch: branchId,
          is_active: true
        });

        if (!financerRate) {
          throw new Error('Financer rate not found for this branch');
        }

        gcAmount = (baseAmount * financerRate.gcRate) / 100;
      }

      payment = {
        type: 'FINANCE',
        financer: req.body.payment.financer_id,
        scheme: req.body.payment.scheme || null,
        emiPlan: req.body.payment.emi_plan || null,
        gcApplicable: req.body.payment.gc_applicable,
        gcAmount: gcAmount
      };
    } else {
      payment = {
        type: 'CASH'
      };
    }

    // Apply discounts
    let discounts = [];
    let totalDiscount = 0;
    if (req.body.discount) {
      const discount = {
        amount: req.body.discount.value,
        type: req.body.discount.type === 'percentage' ? 'PERCENTAGE' : 'FIXED',
        approvalStatus: 'PENDING'
      };

      const updatedComponents = calculateDiscounts(filteredComponents, discount.amount, discount.type);
      validateDiscountLimits(updatedComponents);

      updatedComponents.forEach(updated => {
        const original = filteredComponents.find(c => c.header?.toString() === updated.header?.toString());
        if (original) {
          original.discountedValue = updated.discountedValue;
        }
      });

      totalDiscount = filteredComponents.reduce((sum, component) => {
        return sum + (component.originalValue - component.discountedValue);
      }, 0);

      discounts = [discount];
    }

    // Calculate total amounts
    const totalAmount = baseAmount + accessoriesTotal + rtoAmount;
    const discountedAmount = totalAmount - totalDiscount;

    // Create booking
    const bookingData = {
      model: req.body.model_id,
      color: req.body.model_color,
      customerType: req.body.customer_type,
      gstin: req.body.gstin || '',
      rto: req.body.rto_type,
      rtoAmount: ['BH', 'CRTM'].includes(req.body.rto_type) ? rtoAmount : undefined,
      hpa: req.body.hpa || false,
      hypothecationCharges: req.body.hypothecationCharges || 0,
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
        nomineeAge: req.body.customer_details.nomineeAge ? parseInt(req.body.customer_details.nomineeAge) : undefined
      },
      exchange: req.body.exchange ? req.body.exchange.is_exchange : false,
      exchangeDetails: exchangeDetails,
      payment: payment,
      accessories: accessories,
      priceComponents: filteredComponents,
      discounts: discounts,
      accessoriesTotal: accessoriesTotal,
      totalAmount: totalAmount,
      discountedAmount: discountedAmount,
      status: discounts.length > 0 ? 'PENDING_APPROVAL' : 'DRAFT',
      branch: branchId,
      createdBy: req.user.id,
      salesExecutive: req.body.sales_executive || req.user.id
    };

    const booking = await Booking.create(bookingData);

    await booking.populate([
      'modelDetails',
      'branchDetails',
      'createdByDetails',
      'salesExecutiveDetails',
      { path: 'priceComponents.header', model: 'Header' },
      { path: 'accessories.accessory', model: 'Accessory' }
    ]);

    await AuditLog.create({
      action: 'CREATE',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: bookingData,
      status: 'SUCCESS'
    });

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    
    let message = 'Error creating booking';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    } else if (err.message) {
      message = err.message;
    }

    await AuditLog.create({
      action: 'CREATE',
      entity: 'Booking',
      user: req.user?.id,
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

// Get booking by ID with all populated details (fixed version)
exports.getBookingById = async (req, res) => {
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
      })
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has permission to view this booking
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
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

exports.getAllBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      branch, 
      fromDate, 
      toDate,
      customerType,
      model
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
    
    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }
    
    // Branch filter (non-superadmins can only see their branch)
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin) {
      filter.branch = req.user.branch;
    } else if (branch) {
      filter.branch = branch;
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
        }
      ],
      lean: true
    };
    
    const bookings = await Booking.paginate(filter, options);
    
    res.status(200).json({
      success: true,
      data: {
        bookings: bookings.docs,
        total: bookings.totalDocs,
        pages: bookings.totalPages,
        currentPage: bookings.page
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

exports.updateBooking = async (req, res) => {
  try {
    // Find existing booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check permissions
    if (booking.status !== 'DRAFT' && booking.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Only DRAFT or PENDING_APPROVAL bookings can be modified'
      });
    }

    if (!booking.createdBy.equals(req.user.id) && 
        !req.user.roles.some(r => r.isSuperAdmin)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this booking'
      });
    }

    // Apply updates
    const updates = { ...req.body };
    
    // Recalculate if discounts or price components changed
    if (updates.discounts || updates.priceComponents) {
      if (updates.priceComponents) {
        booking.priceComponents = updates.priceComponents;
      }

      if (updates.discounts) {
        booking.discounts = updates.discounts;
        
        // Recalculate all discounts
        let components = [...booking.priceComponents];
        for (const discount of booking.discounts) {
          components = calculateDiscounts(components, discount.amount, discount.type);
          validateDiscountLimits(components);
        }
        
        booking.priceComponents = components;
      }

      // Recalculate total
      const componentsTotal = booking.priceComponents.reduce(
        (sum, c) => sum + c.discountedValue, 0
      );
      const accessoriesTotal = booking.accessories.reduce(
        (sum, a) => sum + (a.price - a.discount), 0
      );
      updates.totalAmount = componentsTotal + accessoriesTotal;
    }

    // Update status if discounts were added/removed
    if (updates.discounts) {
      updates.status = updates.discounts.length > 0 ? 'PENDING_APPROVAL' : 'DRAFT';
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true }
    ).populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails'
    ]);

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Booking',
      entityId: updatedBooking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: updatedBooking
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    
    let message = 'Error updating booking';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.approveBooking = async (req, res) => {
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

    // Check if user has approval permissions
    const canApprove = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && p.action === 'APPROVE'
      )
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to approve bookings'
      });
    }

    // Update booking status
    booking.status = 'APPROVED';
    booking.approvedBy = req.user.id;
    
    // Update discount approval status
    booking.discounts = booking.discounts.map(d => ({
      ...d.toObject(),
      approvedBy: req.user.id,
      approvalStatus: 'APPROVED',
      approvalNote: req.body.approvalNote
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
      action: 'APPROVE',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        approvalNote: req.body.approvalNote
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error approving booking:', err);
    
    await AuditLog.create({
      action: 'APPROVE',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error approving booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

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

    // Check if user has approval permissions
    const canApprove = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && p.action === 'APPROVE'
      )
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reject bookings'
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

    // Check if user has complete permissions
    const canComplete = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && p.action === 'COMPLETE'
      )
    );

    if (!canComplete) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to complete bookings'
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

    // Check if user has cancel permissions
    const canCancel = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && (p.action === 'CANCEL' || p.action === 'ALL')
      )
    );

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel bookings'
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
// Generate Booking Form (for bookings without discounts)
exports.generateBookingForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('createdByDetails')
      .populate('salesExecutiveDetails')
      .populate('exchangeDetails.broker')
      .populate('payment.financer');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if user has permission
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && !booking.branch.equals(req.user.branch)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Format data for the form
    const formData = {
      bookingNumber: booking.bookingNumber,
      date: booking.createdAt.toLocaleDateString('en-IN'),
      customerDetails: {
        name: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
        address: booking.customerDetails.address,
        mobile: booking.customerDetails.mobile1,
        gstin: booking.gstin || 'N/A',
        pan: booking.customerDetails.panNo || 'N/A'
      },
      vehicleDetails: {
        model: booking.modelDetails.model_name,
        color: booking.colorDetails.name,
        type: booking.modelDetails.type
      },
      paymentDetails: {
        type: booking.payment.type,
        totalAmount: booking.totalAmount,
        accessoriesTotal: booking.accessoriesTotal,
        hypothecationCharges: booking.hypothecationCharges
      },
      status: booking.status,
      isExchange: booking.exchange,
      exchangeDetails: booking.exchangeDetails
    };

    res.status(200).json({ 
      success: true, 
      data: formData,
      documentType: 'BOOKING_FORM'
    });

  } catch (err) {
    console.error('Error generating booking form:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating booking form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Generate Booking Receipt (for bookings with discounts)
exports.generateBookingReceipt = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('createdByDetails')
      .populate('salesExecutiveDetails')
      .populate('exchangeDetails.broker')
      .populate('payment.financer')
      .populate('priceComponents.header')
      .populate('accessories.accessory');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if booking has discounts (should be a receipt)
    if (booking.discounts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'This booking has no discounts - use booking form instead' 
      });
    }

    // Check if user has permission
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && !booking.branch.equals(req.user.branch)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Format price components with tax details
    const priceComponents = booking.priceComponents.map(comp => ({
      name: comp.header.header_key,
      hsnCode: comp.header.metadata?.hsnCode || 'N/A',
      originalValue: comp.originalValue,
      discountedValue: comp.discountedValue,
      gstRate: comp.header.metadata?.gstRate || 0,
      isDiscountable: comp.isDiscountable
    }));

    // Format data for the receipt
    const receiptData = {
      bookingNumber: booking.bookingNumber,
      date: booking.createdAt.toLocaleDateString('en-IN'),
      customerDetails: {
        name: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
        address: booking.customerDetails.address,
        mobile: booking.customerDetails.mobile1,
        gstin: booking.gstin || 'N/A',
        pan: booking.customerDetails.panNo || 'N/A'
      },
      vehicleDetails: {
        model: booking.modelDetails.model_name,
        color: booking.colorDetails.name,
        type: booking.modelDetails.type
      },
      priceDetails: {
        components: priceComponents,
        accessories: booking.accessories.map(acc => ({
          name: acc.accessory?.name || 'Additional Charges',
          price: acc.price,
          discount: acc.discount
        })),
        totalAmount: booking.totalAmount,
        discountedAmount: booking.discountedAmount,
        totalDiscount: booking.totalAmount - booking.discountedAmount
      },
      paymentDetails: {
        type: booking.payment.type,
        financer: booking.payment.type === 'FINANCE' ? booking.payment.financer.name : null,
        gcAmount: booking.payment.gcAmount || 0
      },
      discounts: booking.discounts.map(d => ({
        amount: d.amount,
        type: d.type,
        approvedBy: d.approvedBy?.name || 'Pending Approval'
      })),
      status: booking.status,
      isExchange: booking.exchange,
      exchangeDetails: booking.exchangeDetails,
      branchDetails: {
        name: booking.branchDetails.name,
        address: booking.branchDetails.address,
        gstin: booking.branchDetails.gstin
      }
    };

    res.status(200).json({ 
      success: true, 
      data: receiptData,
      documentType: 'BOOKING_RECEIPT'
    });

  } catch (err) {
    console.error('Error generating booking receipt:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating booking receipt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};