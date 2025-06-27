const Booking = require('../models/Booking');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Accessory = require('../models/Accessory');
const Broker = require('../models/Broker');
const FinanceProvider = require('../models/FinanceProvider');
const RTO = require('../models/Rto');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

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

  // Apply discount proportionally
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

// Helper to validate discount doesn't exceed 95% of any item
const validateDiscountLimits = (priceComponents) => {
  const violations = priceComponents.filter(
    c => c.discountedValue < (0.05 * c.originalValue)
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
      'model', 'color', 'customerType', 'rto', 'personalDetails', 
      'payment', 'branch'
    ];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate model exists
    const model = await Model.findById(req.body.model);
    if (!model) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model selected'
      });
    }

    // Validate RTO exists
    const rto = await RTO.findById(req.body.rto);
    if (!rto) {
      return res.status(400).json({
        success: false,
        message: 'Invalid RTO selected'
      });
    }

    // Get all headers for the selected model type
    const headers = await Header.find({ type: model.type })
      .sort({ priority: 1 });

    // Create price components from headers
    const priceComponents = await Promise.all(headers.map(async (header) => {
      const priceData = model.prices.find(
        p => p.header_id.equals(header._id) && p.branch_id.equals(req.body.branch)
      );

      if (!priceData && header.is_mandatory) {
        throw new Error(`Missing mandatory price for header: ${header.header_key}`);
      }

      return {
        header: header._id,
        originalValue: priceData?.value || 0,
        discountedValue: priceData?.value || 0,
        isDiscountable: header.is_discount,
        isMandatory: header.is_mandatory
      };
    }));

    // Handle HPA charges if applicable
    if (req.body.hpa) {
      const hpaHeader = headers.find(h => h.header_key === 'HYPOTHECATION_CHARGES');
      if (hpaHeader) {
        const hpaPrice = model.prices.find(
          p => p.header_id.equals(hpaHeader._id) && p.branch_id.equals(req.body.branch)
        );
        
        if (hpaPrice) {
          priceComponents.push({
            header: hpaHeader._id,
            originalValue: hpaPrice.value,
            discountedValue: hpaPrice.value,
            isDiscountable: false,
            isMandatory: false
          });
          req.body.hypothecationCharges = hpaPrice.value;
        }
      }
    }

    // Handle RTO charges for specific states
    if (['BH', 'CRTM'].includes(rto.rto_code.substring(0, 2))) {
      if (!req.body.rtoAmount || req.body.rtoAmount <= 0) {
        throw new Error('RTO amount is required for selected RTO');
      }
      
      const rtoHeader = headers.find(h => h.header_key === 'RTO_CHARGES');
      if (rtoHeader) {
        priceComponents.push({
          header: rtoHeader._id,
          originalValue: req.body.rtoAmount,
          discountedValue: req.body.rtoAmount,
          isDiscountable: false,
          isMandatory: true
        });
      }
    }

    // Handle exchange if applicable
    if (req.body.exchange) {
      if (!req.body.exchangeDetails) {
        throw new Error('Exchange details required when exchange is selected');
      }

      const broker = await Broker.findById(req.body.exchangeDetails.broker);
      if (!broker) {
        throw new Error('Invalid broker selected for exchange');
      }

      const brokerBranch = broker.branches.find(b => b.branch.equals(req.body.branch));
      if (!brokerBranch) {
        throw new Error('Selected broker is not available for this branch');
      }

      if (brokerBranch.commissionType === 'FIXED') {
        req.body.exchangeDetails.commissionType = 'FIXED';
        req.body.exchangeDetails.commissionAmount = brokerBranch.fixedCommission;
      } else {
        req.body.exchangeDetails.commissionType = 'VARIABLE';
        // In real app, this would be calculated based on some business logic
        req.body.exchangeDetails.commissionAmount = 
          (req.body.exchangeDetails.price * brokerBranch.maxCommission) / 100;
      }
    }

    // Handle accessories if provided
    if (req.body.accessories && req.body.accessories.length > 0) {
      const accessoryIds = req.body.accessories.map(a => a.accessory);
      const accessories = await Accessory.find({ _id: { $in: accessoryIds } });

      if (accessories.length !== req.body.accessories.length) {
        throw new Error('One or more accessories not found');
      }

      // Validate accessories are applicable to selected model
      const invalidAccessories = accessories.filter(
        a => !a.applicable_models.some(m => m.equals(req.body.model))
      );
      
      if (invalidAccessories.length > 0) {
        throw new Error(`Accessories not applicable for selected model: ${
          invalidAccessories.map(a => a.name).join(', ')
        }`);
      }

      // Update accessory prices in the request
      req.body.accessories = req.body.accessories.map(reqAcc => {
        const dbAcc = accessories.find(a => a._id.equals(reqAcc.accessory));
        return {
          accessory: reqAcc.accessory,
          price: dbAcc.price,
          discount: reqAcc.discount || 0
        };
      });
    }

    // Handle finance details if payment type is FINANCE
    if (req.body.payment.type === 'FINANCE') {
      if (!req.body.payment.financer) {
        throw new Error('Financer is required for finance payment');
      }

      const financer = await FinanceProvider.findById(req.body.payment.financer);
      if (!financer) {
        throw new Error('Invalid financer selected');
      }

      // In real app, would validate scheme and EMI details
    }

    // Apply discounts if provided
    if (req.body.discounts && req.body.discounts.length > 0) {
      for (const discount of req.body.discounts) {
        const updatedComponents = calculateDiscounts(
          priceComponents, 
          discount.amount, 
          discount.type
        );
        
        // Validate no item gets >95% discount
        validateDiscountLimits(updatedComponents);

        // Update components with new discounted values
        updatedComponents.forEach(updated => {
          const original = priceComponents.find(c => c.header.equals(updated.header));
          original.discountedValue = updated.discountedValue;
        });
      }
    }

    // Calculate total amount
    const componentsTotal = priceComponents.reduce(
      (sum, c) => sum + c.discountedValue, 0
    );
    const accessoriesTotal = req.body.accessories?.reduce(
      (sum, a) => sum + (a.price - a.discount), 0
    ) || 0;
    const totalAmount = componentsTotal + accessoriesTotal;

    // Create the booking
    const bookingData = {
      ...req.body,
      priceComponents,
      totalAmount,
      status: req.body.discounts?.length > 0 ? 'PENDING_APPROVAL' : 'DRAFT',
      createdBy: req.user.id
    };

    const booking = await Booking.create(bookingData);

    // Populate references for response
    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails'
    ]);

    // Log the creation
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
    }

    // Log failed attempt
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Booking',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    }).catch(logErr => console.error('Failed to create audit log:', logErr));
    
    res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

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