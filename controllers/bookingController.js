const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Accessory = require('../models/Accessory');
const Broker = require('../models/Broker');
const FinanceProvider = require('../models/FinanceProvider');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Color = require('../models/Color');

// Helper function to calculate discounts
const calculateDiscounts = (priceComponents, discountAmount, discountType) => {
  const eligibleComponents = priceComponents.filter(c => c.isDiscountable);
  const totalEligible = eligibleComponents.reduce((sum, c) => sum + c.originalValue, 0);
  
  if (totalEligible === 0) {
    throw new Error('No discountable components available');
  }

  let remainingDiscount = discountType === 'PERCENTAGE' 
    ? (totalEligible * discountAmount) / 100 
    : discountAmount;

  return priceComponents.map(component => {
    if (!component.isDiscountable) {
      return {
        ...component.toObject(),
        discountedValue: component.originalValue
      };
    }
    const componentRatio = component.originalValue / totalEligible;
    const componentDiscount = Math.min(remainingDiscount * componentRatio, component.originalValue);
    remainingDiscount -= componentDiscount;

    return {
      ...component.toObject(),
      discountedValue: component.originalValue - componentDiscount
    };
  });
};

// Helper to validate discount limits
const validateDiscountLimits = (priceComponents) => {
  const violations = priceComponents.filter(
    c => c.discountedValue < (0.05 * c.originalValue)
  );

  if (violations.length > 0) {
    const itemNames = violations.map(v => v.headerDetails?.header_key).join(', ');
    throw new Error(`Discount cannot exceed 95% for: ${itemNames}`);
  }
};

// Create Booking Endpoint
exports.createBooking = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = [
      { field: 'model_id', message: 'Model selection is required' },
      { field: 'model_color', message: 'Color selection is required' },
      { field: 'customer_type', message: 'Customer type (B2B/B2C) is required' },
      { field: 'rto_type', message: 'RTO state (MH/BH/CRTM) is required' },
      { field: 'customer_details', message: 'Customer details are required' },
      { field: 'payment', message: 'Payment details are required' },
      { field: 'branch', message: 'Branch selection is required' }
    ];
    
    const missingFields = requiredFields.filter(item => !req.body[item.field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.map(f => f.message).join(', ')}`
      });
    }

    // Validate model exists
    const model = await Model.findById(req.body.model_id).populate('colors');
    if (!model) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model selected'
      });
    }

    // Validate color exists and is available for model
    const color = await Color.findById(req.body.model_color);
    if (!color) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color selected'
      });
    }

    const colorAvailable = model.colors.some(c => 
      c._id.toString() === req.body.model_color.toString()
    );
    
    if (!colorAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Selected color is not available for this model'
      });
    }

    // Validate GSTIN for B2B customers
    if (req.body.customer_type === 'B2B' && !req.body.gstin) {
      return res.status(400).json({
        success: false,
        message: 'GSTIN is required for B2B customers'
      });
    }

    // Get ALL headers for this vehicle type
    const headers = await Header.find({ 
      type: model.type
    }).sort({ priority: 1 });

    // Create price components from all available data
    const priceComponents = await Promise.all(headers.map(async (header) => {
      const priceData = model.prices.find(
        p => p.header_id.equals(header._id) && p.branch_id.equals(req.body.branch)
      );

      return {
        header: header._id,
        headerDetails: header,
        originalValue: priceData?.value || 0,
        discountedValue: priceData?.value || 0,
        isDiscountable: header.is_discount,
        isMandatory: header.is_mandatory,
        metadata: priceData?.metadata || {}
      };
    }));

    // Calculate base amount from price components
    const baseAmount = priceComponents.reduce(
      (sum, c) => sum + c.discountedValue, 0
    );

    // Handle HPA charges if applicable
    if (req.body.hpa) {
      const hpaHeader = headers.find(h => h.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)');
      if (hpaHeader) {
        const hpaPrice = model.prices.find(
          p => p.header_id.equals(hpaHeader._id) && p.branch_id.equals(req.body.branch)
        );
        
        if (hpaPrice) {
          priceComponents.push({
            header: hpaHeader._id,
            headerDetails: hpaHeader,
            originalValue: hpaPrice.value,
            discountedValue: hpaPrice.value,
            isDiscountable: false,
            isMandatory: false,
            metadata: hpaPrice.metadata || {}
          });
          req.body.hypothecationCharges = hpaPrice.value;
        }
      }
    }

    // Handle accessories - CORRECTED VERSION
    let accessoriesTotal = 0;
    let accessories = [];
    
    if (req.body.accessories && req.body.accessories.selected && req.body.accessories.selected.length > 0) {
      // Validate and map accessory IDs
      const accessoryIds = req.body.accessories.selected.map(acc => {
        if (!acc.id || !mongoose.Types.ObjectId.isValid(acc.id)) {
          throw new Error(`Invalid accessory ID: ${acc.id}`);
        }
        return new mongoose.Types.ObjectId(acc.id);
      });

      // Find valid active accessories
      const validAccessories = await Accessory.find({
        _id: { $in: accessoryIds },
        status: 'active'
      }).lean();

      // Verify all accessories were found
      if (validAccessories.length !== req.body.accessories.selected.length) {
        const foundIds = validAccessories.map(a => a._id.toString());
        const missingIds = req.body.accessories.selected
          .filter(a => !foundIds.includes(a.id))
          .map(a => a.id);
        throw new Error(`Invalid accessory IDs: ${missingIds.join(', ')}`);
      }

      // Check model compatibility
      const incompatibleAccessories = validAccessories.filter(
        a => !a.applicable_models.some(m => m.toString() === req.body.model_id.toString())
      );
      
      if (incompatibleAccessories.length > 0) {
        throw new Error(`Incompatible accessories: ${
          incompatibleAccessories.map(a => a.name).join(', ')
        }`);
      }

      // Get accessories total header
      const accessoriesTotalHeader = await Header.findOne({
        header_key: 'ACCESSORIES TOTAL',
        type: model.type
      });
      
      if (!accessoriesTotalHeader) {
        throw new Error('ACCESSORIES TOTAL header not configured');
      }

      // Get base accessories price
      const accessoriesTotalPrice = model.prices.find(
        p => p.header_id.equals(accessoriesTotalHeader._id) && 
             p.branch_id.equals(req.body.branch)
      )?.value || 0;

      // Calculate selected accessories total
      const selectedAccessoriesTotal = req.body.accessories.selected.reduce(
        (sum, acc) => {
          const validAcc = validAccessories.find(a => a._id.toString() === acc.id);
          return sum + (validAcc ? validAcc.price : 0);
        }, 0
      );

      accessoriesTotal = Math.max(selectedAccessoriesTotal, accessoriesTotalPrice);
      
      // Only include accessories if custom selection exceeds base price
      accessories = selectedAccessoriesTotal > accessoriesTotalPrice ? 
        validAccessories.map(acc => ({
          accessory: acc._id,
          price: acc.price,
          discount: 0
        })) : [];
    }

    // Handle exchange if applicable
    let exchangeDetails = null;
    if (req.body.exchange && req.body.exchange.is_exchange) {
      if (!req.body.exchange.broker_id) {
        throw new Error('Broker selection is required for exchange');
      }

      const broker = await Broker.findById(req.body.exchange.broker_id);
      if (!broker) {
        throw new Error('Invalid broker selected');
      }

      const brokerBranch = broker.branches.find(b => b.branch.equals(req.body.branch));
      if (!brokerBranch) {
        throw new Error('Broker not available for this branch');
      }

      exchangeDetails = {
        broker: req.body.exchange.broker_id,
        price: req.body.exchange.exchange_price,
        fixedBrokerPrice: req.body.exchange.fixed_broker_price,
        variableBrokerPrice: req.body.exchange.variable_broker_price,
        vehicleNumber: req.body.exchange.vehicle_number,
        chassisNumber: req.body.exchange.chassis_number
      };

      if (brokerBranch.commissionType === 'FIXED') {
        exchangeDetails.commissionType = 'FIXED';
        exchangeDetails.commissionAmount = brokerBranch.fixedCommission;
      } else {
        exchangeDetails.commissionType = 'VARIABLE';
        exchangeDetails.commissionAmount = 
          (req.body.exchange.exchange_price * brokerBranch.maxCommission) / 100;
      }
    }

    // Handle payment details
    let payment = {};
    if (req.body.payment.type.toLowerCase() === 'finance') {
      if (!req.body.payment.financer_id) {
        throw new Error('Financer selection is required');
      }

      const financer = await FinanceProvider.findById(req.body.payment.financer_id);
      if (!financer) {
        throw new Error('Invalid financer selected');
      }

      if (req.body.payment.scheme && !financer.schemes.includes(req.body.payment.scheme)) {
        throw new Error('Scheme not available with this financer');
      }

      payment = {
        type: 'FINANCE',
        amount: req.body.payment.amount,
        financer: req.body.payment.financer_id,
        scheme: req.body.payment.scheme,
        emiPlan: req.body.payment.emi_plan,
        gcApplicable: req.body.payment.gc_applicable,
        gcAmount: req.body.payment.gc_amount
      };
    } else {
      payment = {
        type: 'CASH',
        amount: req.body.payment.amount
      };
    }

    // Apply discounts if provided
    let discounts = [];
    if (req.body.discount) {
      const discount = {
        amount: req.body.discount.value,
        type: req.body.discount.type === 'percentage' ? 'PERCENTAGE' : 'FIXED',
        approvalStatus: 'PENDING'
      };

      const updatedComponents = calculateDiscounts(
        priceComponents, 
        discount.amount, 
        discount.type
      );
      
      validateDiscountLimits(updatedComponents);

      updatedComponents.forEach(updated => {
        const original = priceComponents.find(c => c.header?.toString() === updated.header?.toString());
        if (original) {
          original.discountedValue = updated.discountedValue;
        }
      });

      discounts = [discount];
    }

    // Calculate total amount
    const totalAmount = baseAmount + accessoriesTotal;

    // Create the booking
    const bookingData = {
      model: req.body.model_id,
      color: req.body.model_color,
      customerType: req.body.customer_type,
      gstin: req.body.gstin || '',
      rto: req.body.rto_type,
      hpa: req.body.hpa || false,
      hypothecationCharges: req.body.hypothecationCharges || 0,
      customerDetails: {
        name: req.body.customer_details.name,
        gender: req.body.customer_details.gender,
        dob: req.body.customer_details.dob,
        occupation: req.body.customer_details.occupation,
        address: req.body.customer_details.address,
        taluka: req.body.customer_details.taluka,
        district: req.body.customer_details.district,
        pincode: req.body.customer_details.pincode,
        mobile1: req.body.customer_details.mobile1,
        mobile2: req.body.customer_details.mobile2 || '',
        aadharNumber: req.body.customer_details.aadhar_number || '',
        nomineeName: req.body.customer_details.nominee_name || '',
        nomineeRelation: req.body.customer_details.nominee_relation || '',
        nomineeAge: req.body.customer_details.nominee_age || 0
      },
      exchange: req.body.exchange ? req.body.exchange.is_exchange : false,
      exchangeDetails: exchangeDetails,
      payment: payment,
      accessories: accessories,
      priceComponents: priceComponents,
      discounts: discounts,
      accessoriesTotal: accessoriesTotal,
      totalAmount: totalAmount,
      status: discounts.length > 0 ? 'PENDING_APPROVAL' : 'DRAFT',
      branch: req.body.branch,
      createdBy: req.user.id
    };

    const booking = await Booking.create(bookingData);

    await booking.populate([
      'modelDetails',
      'branchDetails',
      'createdByDetails',
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
// ... (keep the rest of the controller methods the same)
exports.getBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Base query
    const query = { branch: req.user.branch };
    
    // Optional filters
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.customerType) {
      query.customerType = req.query.customerType;
    }
    if (req.query.model) {
      query.model = req.query.model;
    }
    if (req.query.fromDate && req.query.toDate) {
      query.createdAt = {
        $gte: new Date(req.query.fromDate),
        $lte: new Date(req.query.toDate)
      };
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .skip(skip)
        .limit(limit)
        .populate('modelDetails', 'model_name type')
        .populate('colorDetails', 'name code')
        .populate('rtoDetails', 'rto_code rto_name')
        .populate('createdByDetails', 'name email')
        .sort({ createdAt: -1 }),
      Booking.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bookings
    });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('rtoDetails')
      .populate('branchDetails')
      .populate('createdByDetails')
      .populate('approvedByDetails')
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
        model: 'Broker',
        select: 'name brokerId'
      })
      .populate({
        path: 'payment.financer',
        model: 'FinanceProvider',
        select: 'name'
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has access to this booking
    if (!req.user.roles.some(r => r.isSuperAdmin) && 
        !booking.branch.equals(req.user.branch)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this booking'
      });
    }
    
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
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