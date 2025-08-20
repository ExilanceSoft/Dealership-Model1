const Subdealer = require('../models/Subdealer');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
// Add these imports at the top
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const SubdealerOnAccountRef = require('../models/SubdealerOnAccountRef');
const User = require('../models/User');

// Create a new subdealer
exports.createSubdealer = async (req, res, next) => {
  try {
    const { name, location, rateOfInterest, type, discount } = req.body;

    // Validate input
    if (!name) return next(new AppError('Subdealer name is required', 400));
    if (!location) return next(new AppError('Location is required', 400));
    if (!rateOfInterest) return next(new AppError('Rate of interest is required', 400));
    if (!type) return next(new AppError('Type is required', 400));

    // Create new subdealer
    const subdealer = await Subdealer.create({
      name,
      location,
      rateOfInterest,
      type,
      discount: discount || 0,
      createdBy: req.user.id
    });

    // Populate creator details in the response
    const populatedSubdealer = await Subdealer.findById(subdealer._id)
      .populate('createdByDetails', 'name email');

    res.status(201).json({
      status: 'success',
      data: {
        subdealer: populatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error creating subdealer: ${err.message}`);
    next(err);
  }
};

// Get all subdealers (with optional filtering)
exports.getAllSubdealers = async (req, res, next) => {
  try {
    const filter = {};
    
    // Add type filter if provided
    if (req.query.type && ['B2B', 'B2C'].includes(req.query.type.toUpperCase())) {
      filter.type = req.query.type.toUpperCase();
    }
    
    // Add status filter if provided
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    
    // Add search filter if provided
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Query subdealers with filters
    const subdealers = await Subdealer.find(filter)
      .populate('createdByDetails', 'name email')
      .sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: subdealers.length,
      data: {
        subdealers
      }
    });
  } catch (err) {
    logger.error(`Error getting subdealers: ${err.message}`);
    next(err);
  }
};

// Get single subdealer by ID
exports.getSubdealerById = async (req, res, next) => {
  try {
    const subdealer = await Subdealer.findById(req.params.id)
      .populate('createdByDetails', 'name email');

    if (!subdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer
      }
    });
  } catch (err) {
    logger.error(`Error getting subdealer: ${err.message}`);
    next(err);
  }
};

// Update a subdealer
exports.updateSubdealer = async (req, res, next) => {
  try {
    const { name, location, rateOfInterest, type, discount, status } = req.body;

    const updatedSubdealer = await Subdealer.findByIdAndUpdate(
      req.params.id,
      {
        name,
        location,
        rateOfInterest,
        type,
        discount,
        status
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('createdByDetails', 'name email');

    if (!updatedSubdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer: updatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error updating subdealer: ${err.message}`);
    next(err);
  }
};

// Update subdealer status only
exports.updateSubdealerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    const updatedSubdealer = await Subdealer.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedSubdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        subdealer: updatedSubdealer
      }
    });
  } catch (err) {
    logger.error(`Error updating subdealer status: ${err.message}`);
    next(err);
  }
};

// Delete a subdealer
exports.deleteSubdealer = async (req, res, next) => {
  try {
    const subdealer = await Subdealer.findByIdAndDelete(req.params.id);

    if (!subdealer) {
      return next(new AppError('No subdealer found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting subdealer: ${err.message}`);
    next(err);
  }
};

// Add this method to subdealerController.js

// In subdealerController.js - Update the existing method
exports.getSubdealerFinancialSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid subdealer ID', 400));
    }

    // Check if subdealer exists
    const subdealer = await Subdealer.findById(id)
      .populate('createdByDetails', 'name email');
    
    if (!subdealer) {
      return next(new AppError('Subdealer not found', 404));
    }

    // Permission check
    if (!req.user.roles.some(role => ['ADMIN', 'SUPERADMIN'].includes(role.name))) {
      const subdealerUser = await User.findOne({ 
        subdealer: id, 
        _id: req.user.id 
      });
      
      if (!subdealerUser) {
        return next(new AppError('Access denied. You can only view your own subdealer data', 403));
      }
    }

    // Build date filter
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    // 1. Get booking statistics - FIXED: Convert subdealer ID to ObjectId
    const bookingMatch = {
      subdealer: new mongoose.Types.ObjectId(id),
      bookingType: 'SUBDEALER',
      ...dateFilter
    };

    const bookingStats = await Booking.aggregate([
      { $match: bookingMatch },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalBookingAmount: { $sum: '$totalAmount' },
          totalReceivedAmount: { $sum: '$receivedAmount' },
          totalBalanceAmount: { $sum: '$balanceAmount' },
          totalDiscountedAmount: { $sum: '$discountedAmount' }
        }
      }
    ]);

    const bookingSummary = bookingStats[0] || {
      totalBookings: 0,
      totalBookingAmount: 0,
      totalReceivedAmount: 0,
      totalBalanceAmount: 0,
      totalDiscountedAmount: 0
    };

    // 2. Get on-account summary - FIXED: Convert subdealer ID to ObjectId
    const onAccountMatch = {
      subdealer: new mongoose.Types.ObjectId(id),
      ...dateFilter
    };

    const onAccountStats = await SubdealerOnAccountRef.aggregate([
      { $match: onAccountMatch },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          totalReceiptAmount: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedTotal' },
          totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } }
        }
      }
    ]);

    const onAccountSummary = onAccountStats[0] || {
      totalReceipts: 0,
      totalReceiptAmount: 0,
      totalAllocated: 0,
      totalBalance: 0
    };

    // 3. Calculate financial overview
    const totalOutstanding = bookingSummary.totalBalanceAmount; // Amount yet to be received from customers
    const availableCredit = onAccountSummary.totalBalance; // Available on-account balance
    const netPosition = availableCredit - totalOutstanding;

    const financialOverview = {
      totalOutstanding,
      availableCredit,
      netPosition,
      status: netPosition >= 0 ? 'POSITIVE' : 'NEGATIVE'
    };

    // 4. Get recent transactions (last 10)
    const recentTransactions = await Booking.find({
      subdealer: id,
      bookingType: 'SUBDEALER',
      ...dateFilter
    })
      .select('bookingNumber customerDetails.name totalAmount receivedAmount balanceAmount status createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // 5. Get recent on-account receipts (last 10)
    const recentReceipts = await SubdealerOnAccountRef.find({
      subdealer: id,
      ...dateFilter
    })
      .select('refNumber amount allocatedTotal status receivedDate')
      .sort({ receivedDate: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      status: 'success',
      data: {
        subdealer,
        bookingSummary: {
          totalBookings: bookingSummary.totalBookings,
          totalBookingAmount: bookingSummary.totalBookingAmount,
          totalReceivedAmount: bookingSummary.totalReceivedAmount,
          totalBalanceAmount: bookingSummary.totalBalanceAmount,
          totalDiscountedAmount: bookingSummary.totalDiscountedAmount,
          averageBookingValue: bookingSummary.totalBookings > 0 
            ? bookingSummary.totalBookingAmount / bookingSummary.totalBookings 
            : 0
        },
        onAccountSummary: {
          totalReceipts: onAccountSummary.totalReceipts,
          totalReceiptAmount: onAccountSummary.totalReceiptAmount,
          totalAllocated: onAccountSummary.totalAllocated,
          totalBalance: onAccountSummary.totalBalance,
          utilizationRate: onAccountSummary.totalReceiptAmount > 0 
            ? (onAccountSummary.totalAllocated / onAccountSummary.totalReceiptAmount) * 100 
            : 0
        },
        financialOverview,
        recentTransactions,
        recentReceipts,
        period: {
          from: from || 'All time',
          to: to || 'Present'
        }
      }
    });

  } catch (err) {
    logger.error(`Error getting subdealer financial summary: ${err.message}`);
    next(err);
  }
};
// Add this method to subdealerController.js
exports.getAllSubdealersWithFinancialSummary = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, type, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter for subdealers
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (type && ['B2B', 'B2C'].includes(type.toUpperCase())) {
      filter.type = type.toUpperCase();
    }
    if (status && ['active', 'inactive'].includes(status.toLowerCase())) {
      filter.status = status.toLowerCase();
    }

    // Get total count for pagination
    const total = await Subdealer.countDocuments(filter);

    // Get paginated subdealers
    const subdealers = await Subdealer.find(filter)
      .populate('createdByDetails', 'name email')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);

    // Get financial data for each subdealer
    const subdealersWithFinancials = await Promise.all(
      subdealers.map(async (subdealer) => {
        try {
          // Get booking stats
          const bookingStats = await Booking.aggregate([
            { 
              $match: { 
                subdealer: subdealer._id,
                bookingType: 'SUBDEALER'
              } 
            },
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalBookingAmount: { $sum: '$totalAmount' },
                totalReceivedAmount: { $sum: '$receivedAmount' },
                totalBalanceAmount: { $sum: '$balanceAmount' }
              }
            }
          ]);

          const bookingSummary = bookingStats[0] || {
            totalBookings: 0,
            totalBookingAmount: 0,
            totalReceivedAmount: 0,
            totalBalanceAmount: 0
          };

          // Get on-account stats
          const onAccountStats = await SubdealerOnAccountRef.aggregate([
            { $match: { subdealer: subdealer._id } },
            {
              $group: {
                _id: null,
                totalReceipts: { $sum: 1 },
                totalReceiptAmount: { $sum: '$amount' },
                totalAllocated: { $sum: '$allocatedTotal' },
                totalBalance: { $sum: { $subtract: ['$amount', '$allocatedTotal'] } }
              }
            }
          ]);

          const onAccountSummary = onAccountStats[0] || {
            totalReceipts: 0,
            totalReceiptAmount: 0,
            totalAllocated: 0,
            totalBalance: 0
          };

          // Calculate financial overview
          const totalOutstanding = bookingSummary.totalBalanceAmount;
          const availableCredit = onAccountSummary.totalBalance;
          const netPosition = availableCredit - totalOutstanding;

          return {
            ...subdealer.toObject(),
            financials: {
              bookingSummary,
              onAccountSummary,
              financialOverview: {
                totalOutstanding,
                availableCredit,
                netPosition,
                status: netPosition >= 0 ? 'POSITIVE' : 'NEGATIVE'
              }
            }
          };
        } catch (error) {
          logger.error(`Error getting financials for subdealer ${subdealer._id}: ${error.message}`);
          return {
            ...subdealer.toObject(),
            financials: {
              bookingSummary: { totalBookings: 0, totalBookingAmount: 0, totalReceivedAmount: 0, totalBalanceAmount: 0 },
              onAccountSummary: { totalReceipts: 0, totalReceiptAmount: 0, totalAllocated: 0, totalBalance: 0 },
              financialOverview: { totalOutstanding: 0, availableCredit: 0, netPosition: 0, status: 'POSITIVE' }
            }
          };
        }
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        subdealers: subdealersWithFinancials,
        pagination: {
          total: total,
          pages: Math.ceil(total / limitNum),
          page: pageNum,
          limit: limitNum,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (err) {
    logger.error(`Error getting all subdealers with financial summary: ${err.message}`);
    next(err);
  }
};