// controllers/qrController.js
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const { generateBookingFormHTML } = require('./bookingController');
const path = require('path');
const fs = require('fs');

// Generate QR Code for a booking
// Update the generateQRCode function
exports.generateQRCode = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Generate URL that will be encoded in QR code
    const qrData = `${process.env.FRONTEND_URL}/booking-update/${booking._id}`;
    
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

// Submit update request
exports.submitUpdateRequest = async (bookingId, updates, userId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Validate updates
    const allowedFields = [
      'customerDetails.name',
      'customerDetails.mobile1',
      'customerDetails.mobile2',
      'customerDetails.address',
      'customerDetails.pincode',
      'color',
      'payment.type',
      'payment.scheme',
      'payment.emiPlan'
    ];

    const filteredUpdates = {};
    for (const field in updates) {
      if (allowedFields.includes(field)) {
        filteredUpdates[field] = updates[field];
      }
    }

    // Save updates as pending
    booking.pendingUpdates = filteredUpdates;
    booking.updateRequestStatus = 'PENDING';
    booking.updateRequestedBy = userId;
    await booking.save();

    // Log the action
    await AuditLog.create({
      action: 'UPDATE_REQUEST',
      entity: 'Booking',
      entityId: booking._id,
      user: userId,
      metadata: {
        updates: filteredUpdates
      },
      status: 'SUCCESS'
    });

    return booking;
  } catch (error) {
    console.error('Error submitting update request:', error);
    throw error;
  }
};

// Process update request (approve/reject)
exports.processUpdateRequest = async (bookingId, action, managerId, note = '') => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.updateRequestStatus !== 'PENDING') {
      throw new Error('No pending update request for this booking');
    }

    if (action === 'APPROVE') {
      // Apply the updates
      for (const field in booking.pendingUpdates) {
        const value = booking.pendingUpdates[field];
        const fieldParts = field.split('.');
        
        if (fieldParts.length === 1) {
          booking[fieldParts[0]] = value;
        } else if (fieldParts.length === 2) {
          if (!booking[fieldParts[0]]) booking[fieldParts[0]] = {};
          booking[fieldParts[0]][fieldParts[1]] = value;
        }
      }

      booking.updateRequestStatus = 'APPROVED';
      booking.updateApprovedBy = managerId;
      booking.updateRequestNote = note;
      booking.pendingUpdates = null;

      await booking.save();

      // Log the action
      await AuditLog.create({
        action: 'UPDATE_APPROVED',
        entity: 'Booking',
        entityId: booking._id,
        user: managerId,
        metadata: {
          note
        },
        status: 'SUCCESS'
      });

    } else if (action === 'REJECT') {
      booking.updateRequestStatus = 'REJECTED';
      booking.updateApprovedBy = managerId;
      booking.updateRequestNote = note;
      booking.pendingUpdates = null;

      await booking.save();

      // Log the action
      await AuditLog.create({
        action: 'UPDATE_REJECTED',
        entity: 'Booking',
        entityId: booking._id,
        user: managerId,
        metadata: {
          note
        },
        status: 'SUCCESS'
      });
    }

    return booking;
  } catch (error) {
    console.error('Error processing update request:', error);
    throw error;
  }
};

// Get pending update requests
exports.getPendingUpdateRequests = async (branchId = null) => {
  try {
    const query = { 
      updateRequestStatus: 'PENDING' 
    };

    if (branchId) {
      query.branch = branchId;
    }

    return await Booking.find(query)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('updateRequestedBy', 'name email')
      .sort({ updatedAt: -1 });
  } catch (error) {
    console.error('Error getting pending update requests:', error);
    throw error;
  }
};