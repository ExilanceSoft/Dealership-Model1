// controllers/qrController.js
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const Handlebars = require('handlebars');
const Color = require('../models/Color');
// const { generateBookingFormHTML } = require('../controllers/bookingController');
const path = require('path');
const fs = require('fs');
const templatePath = path.join(__dirname, '../templates/updateFormTemplate.html');
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
// Generate QR Code for a booking
exports.generateQRCode = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Generate the correct URL for the update form
    // Fix the baseUrl generation
    const baseUrl = (process.env.BACKEND_URL || 'http://localhost:5002').replace(/\/$/, '');
    const qrData = `${baseUrl}/api/v1/bookings/${booking._id}/update-form`;
    
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData);
    
    // Save QR code to booking
    booking.qrCode = qrCodeDataURL;
    await booking.save();

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};
// Get booking data for update form
exports.getBookingForUpdateForm = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('createdByDetails')
      .populate('salesExecutiveDetails');

    if (!booking) {
      throw new Error('Booking not found');
    }

    return {
      booking,
      formHtml: await generateBookingFormHTML(booking, false)
    };
  } catch (error) {
    console.error('Error getting booking for update form:', error);
    throw error;
  }
};

exports.submitUpdateRequest = async (req, res) => {
  try {
    const { updates } = req.body;
    const bookingId = req.params.id;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No updates provided' 
      });
    }

    // Check if update was already submitted
    const existingBooking = await Booking.findById(bookingId);
    if (existingBooking.updateRequestSubmitted) {
      return res.status(400).json({
        success: false,
        message: 'Update request already submitted for this booking'
      });
    }

    // Update the booking
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { 
        pendingUpdates: updates,
        updateRequestStatus: 'PENDING',
        updateRequestedBy: null, // Since this is unauthenticated
        updateRequestSubmitted: true // Mark as submitted
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Update request submitted successfully. It will be reviewed by management.',
      data: booking
    });
  } catch (error) {
    console.error('submitUpdateRequest error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Process update request (approve/reject)
exports.approveUpdateRequest = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { note } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // Check if there are pending updates
    if (!booking.pendingUpdates || booking.updateRequestStatus !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending update request found for this booking' 
      });
    }

    // Apply updates from pendingUpdates
    const updates = booking.pendingUpdates;
    
    if (updates.customerDetails) {
      booking.customerDetails = {
        ...booking.customerDetails,
        ...updates.customerDetails
      };
    }

    if (updates.payment) {
      booking.payment = {
        ...booking.payment,
        ...updates.payment
      };
    }

    if (updates.color) {
      const color = await Color.findOne({ name: updates.color });
      if (color) {
        booking.color = color._id;
      }
    }

    // Clear pending updates and update status
    booking.pendingUpdates = null;
    booking.updateRequestStatus = 'APPROVED';
    booking.updateApprovedBy = req.user.id;
    booking.updateRequestNote = note || '';
    
    await booking.save();

    // Populate the updated booking for response
    const updatedBooking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('salesExecutiveDetails');

    return res.status(200).json({
      success: true,
      message: 'Booking updates approved successfully',
      data: updatedBooking
    });

  } catch (err) {
    console.error('approveUpdateRequest error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get pending update requests
// In qrController.js - Update the getPendingUpdateRequests function
exports.getPendingUpdateRequests = async (branchId = null) => {
  try {
    const query = { 
      updateRequestStatus: 'PENDING',
      pendingUpdates: { $exists: true, $ne: null }
    };

    if (branchId) {
      query.branch = branchId;
    }

    const bookings = await Booking.find(query)
      .populate({
        path: 'model',
        select: 'model_name' // Include model ID by default
      })
      .populate({
        path: 'color',
        select: 'name'
      })
      .populate({
        path: 'updateRequestedBy',
        select: 'name email'
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Transform the data to include model ID and name
    const pendingUpdates = bookings.map(booking => ({
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      customerName: `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name || ''}`.trim(),
      model: {
        id: booking.model?._id, // Include model ID
        name: booking.model?.model_name // Include model name
      },
      color: booking.color?.name,
      pendingUpdates: booking.pendingUpdates,
      updateRequestStatus: booking.updateRequestStatus,
      updateRequestNote: booking.updateRequestNote,
      updateRequestedBy: booking.updateRequestedBy,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    }));

    return pendingUpdates;
  } catch (error) {
    console.error('Error getting pending update requests:', error);
    throw error;
  }
};

// qrController.js - Add this new function

/**
 * @desc    Get pending update request for a specific booking
 * @param   {String} bookingId - Booking ID
 * @return  {Object} Pending update details
 */
exports.getPendingUpdateRequestById = async (bookingId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new Error('Invalid booking ID format');
    }

    const booking = await Booking.findById(bookingId)
      .populate('modelDetails', 'model_name')
      .populate('colorDetails', 'name')
      .populate('updateRequestedBy', 'name email')
      .lean();

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.updateRequestStatus !== 'PENDING' || !booking.pendingUpdates) {
      throw new Error('No pending update request found for this booking');
    }

    return {
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerDetails.name,
      model: booking.modelDetails?.model_name,
      color: booking.colorDetails?.name,
      pendingUpdates: booking.pendingUpdates,
      updateRequestStatus: booking.updateRequestStatus,
      updateRequestNote: booking.updateRequestNote,
      updateRequestedBy: booking.updateRequestedBy,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };
  } catch (error) {
    console.error('Error getting pending update request:', error);
    throw error;
  }
};