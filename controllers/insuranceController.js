// controllers/insuranceController.js
const mongoose = require('mongoose');
const Insurance = require('../models/insuranceModel');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');

// // Helper function to get insurance dashboard counts
// exports.getInsuranceDashboard = async (req, res) => {
//   try {
//     const [pendingCount, approvedCount] = await Promise.all([
//       Insurance.countDocuments({ status: 'PENDING' }),
//       Insurance.countDocuments({ status: 'APPROVED' })
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         pendingCount,
//         approvedCount
//       }
//     });
//   } catch (err) {
//     console.error('Error getting insurance dashboard:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching insurance dashboard',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Add insurance details
// exports.addInsurance = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
    
//     if (!mongoose.Types.ObjectId.isValid(bookingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid booking ID format'
//       });
//     }

//     // Check if booking exists
//     const booking = await Booking.findById(bookingId);
//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: 'Booking not found'
//       });
//     }

//     // Check if insurance already exists for this booking
//     const existingInsurance = await Insurance.findOne({ booking: bookingId });
//     if (existingInsurance) {
//       return res.status(400).json({
//         success: false,
//         message: 'Insurance already exists for this booking'
//       });
//     }

//     const {
//       insuranceProvider,
//       policyNumber,
//       rsaPolicyNumber,
//       cmsPolicyNumber,
//       premiumAmount,
//       validUptoDate,
//       paymentMode,
//       documents
//     } = req.body;

//     // Validate required fields
//     if (!insuranceProvider || !policyNumber || !premiumAmount || !validUptoDate || !paymentMode) {
//       return res.status(400).json({
//         success: false,
//         message: 'Required fields: insuranceProvider, policyNumber, premiumAmount, validUptoDate, paymentMode'
//       });
//     }

//     const insuranceData = {
//       booking: bookingId,
//       insuranceProvider,
//       policyNumber,
//       rsaPolicyNumber: rsaPolicyNumber || '',
//       cmsPolicyNumber: cmsPolicyNumber || '',
//       premiumAmount,
//       validUptoDate: new Date(validUptoDate),
//       paymentMode,
//       documents: documents || [],
//       createdBy: req.user.id
//     };

//     const insurance = await Insurance.create(insuranceData);

//     await AuditLog.create({
//       action: 'CREATE',
//       entity: 'Insurance',
//       entityId: insurance._id,
//       user: req.user.id,
//       ip: req.ip,
//       metadata: insuranceData,
//       status: 'SUCCESS'
//     });

//     res.status(201).json({
//       success: true,
//       data: insurance
//     });

//   } catch (err) {
//     console.error('Error adding insurance:', err);
    
//     await AuditLog.create({
//       action: 'CREATE',
//       entity: 'Insurance',
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       metadata: req.body,
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error adding insurance',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Get all pending insurance bookings
// exports.getPendingInsurances = async (req, res) => {
//   try {
//     const insurances = await Insurance.find({ status: 'PENDING' })
//       .populate('bookingDetails', 'bookingNumber customerDetails chassisNumber model color')
//       .populate('providerDetails', 'provider_name')
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       data: insurances
//     });
//   } catch (err) {
//     console.error('Error getting pending insurances:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching pending insurances',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Get all approved insurance bookings
// exports.getApprovedInsurances = async (req, res) => {
//   try {
//     const insurances = await Insurance.find({ status: 'APPROVED' })
//       .populate('bookingDetails', 'bookingNumber customerDetails chassisNumber model color')
//       .populate('providerDetails', 'provider_name')
//       .populate('approvedByDetails', 'name email')
//       .sort({ approvalDate: -1 });

//     res.status(200).json({
//       success: true,
//       data: insurances
//     });
//   } catch (err) {
//     console.error('Error getting approved insurances:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching approved insurances',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Update insurance approval status
// exports.updateInsuranceStatus = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { status, rejectionReason } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(bookingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid booking ID format'
//       });
//     }

//     if (!['APPROVED', 'REJECTED'].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status. Must be APPROVED or REJECTED'
//       });
//     }

//     if (status === 'REJECTED' && !rejectionReason) {
//       return res.status(400).json({
//         success: false,
//         message: 'Rejection reason is required when status is REJECTED'
//       });
//     }

//     const insurance = await Insurance.findOneAndUpdate(
//       { booking: bookingId },
//       {
//         status,
//         approvedBy: req.user.id,
//         approvalDate: status === 'APPROVED' ? new Date() : null,
//         rejectionReason: status === 'REJECTED' ? rejectionReason : null
//       },
//       { new: true }
//     ).populate('bookingDetails providerDetails');

//     if (!insurance) {
//       return res.status(404).json({
//         success: false,
//         message: 'Insurance not found for this booking'
//       });
//     }

//     await AuditLog.create({
//       action: 'UPDATE_STATUS',
//       entity: 'Insurance',
//       entityId: insurance._id,
//       user: req.user.id,
//       ip: req.ip,
//       metadata: {
//         oldStatus: insurance.status,
//         newStatus: status,
//         rejectionReason
//       },
//       status: 'SUCCESS'
//     });

//     res.status(200).json({
//       success: true,
//       data: insurance
//     });

//   } catch (err) {
//     console.error('Error updating insurance status:', err);
    
//     await AuditLog.create({
//       action: 'UPDATE_STATUS',
//       entity: 'Insurance',
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       metadata: req.body,
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error updating insurance status',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Get all insurance details
// exports.getAllInsuranceDetails = async (req, res) => {
//   try {
//     const insurances = await Insurance.find()
//       .populate({
//         path: 'bookingDetails',
//         select: 'bookingNumber customerDetails chassisNumber model color',
//         populate: [
//           { path: 'model', select: 'model_name' },
//           { path: 'color', select: 'name' }
//         ]
//       })
//       .populate('providerDetails', 'provider_name')
//       .populate('approvedByDetails', 'name email')
//       .sort({ insuranceDate: -1 });

//     const formattedInsurances = insurances.map(insurance => ({
//       _id: insurance._id,
//       customerName: insurance.bookingDetails?.customerDetails?.name || 'N/A',
//       chassisNumber: insurance.bookingDetails?.chassisNumber || 'N/A',
//       insuranceDate: insurance.insuranceDate,
//       policyNumber: insurance.policyNumber,
//       rsaPolicyNumber: insurance.rsaPolicyNumber,
//       cmsPolicyNumber: insurance.cmsPolicyNumber,
//       premiumAmount: insurance.premiumAmount,
//       validUptoDate: insurance.validUptoDate,
//       model: insurance.bookingDetails?.model?.model_name || 'N/A',
//       vehicleRegNo: insurance.bookingDetails?.registrationNumber || 'N/A',
//       insuranceCompany: insurance.providerDetails?.provider_name || 'N/A',
//       mobileNo: insurance.bookingDetails?.customerDetails?.mobile1 || 'N/A',
//       paymentMode: insurance.paymentMode,
//       status: insurance.status
//     }));

//     res.status(200).json({
//       success: true,
//       data: formattedInsurances
//     });
//   } catch (err) {
//     console.error('Error getting all insurance details:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching insurance details',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// // Get insurance details by chassis number
// exports.getInsuranceByChassisNumber = async (req, res) => {
//   try {
//     const { chassisNumber } = req.params;

//     if (!chassisNumber || !/^[A-Z0-9]{17}$/.test(chassisNumber)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid chassis number format (must be 17 alphanumeric characters)'
//       });
//     }

//     const booking = await Booking.findOne({ chassisNumber: chassisNumber.toUpperCase() });
//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: 'Booking not found for this chassis number'
//       });
//     }

//     const insurance = await Insurance.findOne({ booking: booking._id })
//       .populate({
//         path: 'bookingDetails',
//         select: 'bookingNumber customerDetails chassisNumber model color',
//         populate: [
//           { path: 'model', select: 'model_name' },
//           { path: 'color', select: 'name' }
//         ]
//       })
//       .populate('providerDetails', 'provider_name')
//       .populate('approvedByDetails', 'name email');

//     if (!insurance) {
//       return res.status(404).json({
//         success: false,
//         message: 'Insurance not found for this booking'
//       });
//     }

//     const formattedInsurance = {
//       _id: insurance._id,
//       customerName: insurance.bookingDetails.customerDetails.name,
//       chassisNumber: insurance.bookingDetails.chassisNumber,
//       insuranceDate: insurance.insuranceDate,
//       policyNumber: insurance.policyNumber,
//       rsaPolicyNumber: insurance.rsaPolicyNumber,
//       cmsPolicyNumber: insurance.cmsPolicyNumber,
//       premiumAmount: insurance.premiumAmount,
//       validUptoDate: insurance.validUptoDate,
//       model: insurance.bookingDetails.model.model_name,
//       vehicleRegNo: insurance.bookingDetails.registrationNumber || 'N/A',
//       insuranceCompany: insurance.providerDetails.provider_name,
//       mobileNo: insurance.bookingDetails.customerDetails.mobile1,
//       paymentMode: insurance.paymentMode,
//       status: insurance.status,
//       documents: insurance.documents
//     };

//     res.status(200).json({
//       success: true,
//       data: formattedInsurance
//     });

//   } catch (err) {
//     console.error('Error getting insurance by chassis number:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching insurance details',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

/**
 * @desc    Get approved bookings with awaiting insurance
 * @route   GET /api/v1/bookings/awaiting-insurance
 * @access  Private (Admin/Manager)
 */
exports.getBookingsAwaitingInsurance = async (req, res) => {
  try {
    // Check user permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    const isManagerOrAdmin = req.user.roles.some(r => 
      ['MANAGER', 'ADMIN'].includes(r.name)
    );

    if (!isSuperAdmin && !isManagerOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to access this endpoint' 
      });
    }

    // Build filter - approved bookings with AWAITING insurance status
    const filter = {
      status: 'APPROVED',
      insuranceStatus: 'AWAITING'
    };

    // For non-superadmins, filter by branch
    if (!isSuperAdmin && req.user.branch) {
      filter.branch = req.user.branch;
    }

    const { page = 1, limit = 100 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: 1 }, // Oldest first
      populate: [
        'model',
        { path: 'color', select: 'name code' },
        'branch',
        { path: 'createdBy', select: 'name email' },
        { path: 'salesExecutive', select: 'name email' }
      ]
    };

    const bookings = await Booking.paginate(filter, options);

    // Get insurance details for each booking
    const bookingsWithInsurance = await Promise.all(
      bookings.docs.map(async (booking) => {
        const insurance = await mongoose.model('Insurance').findOne({
          booking: booking._id
        }).select('status policyNumber premiumAmount');

        return {
          ...booking.toObject(),
          insuranceDetails: insurance || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        bookings: bookingsWithInsurance,
        total: bookings.totalDocs,
        pages: bookings.totalPages,
        currentPage: bookings.page
      }
    });

  } catch (err) {
    console.error('Error getting bookings awaiting insurance:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings awaiting insurance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};