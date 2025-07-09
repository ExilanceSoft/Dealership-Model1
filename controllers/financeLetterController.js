// controllers/financeLetterController.js
const FinanceLetter = require('../models/FinanceLetter');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Helper function to handle file upload
const handleFinanceLetterUpload = (file, bookingId) => {
  if (!file) return null;
  
  const uploadDir = path.join(__dirname, '../uploads/finance-letters', bookingId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname);
  const filename = `finance-letter-${Date.now()}${ext}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/finance-letters/${bookingId}/${filename}`;
};

/**
 * @desc Get finance letter details for a booking
 * @route GET /api/v1/finance-letter/:bookingId
 * @access Private
 */
exports.getFinanceLetterDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId)
      .select('customerDetails.name customerDetails.salutation');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId })
      .select('status verifiedBy verificationNote')
      .populate('verifiedBy', 'name');

    const response = {
      customerName: `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name}`.trim(),
      financeLetterStatus: financeLetter ? financeLetter.status : 'NOT_SUBMITTED',
      verificationNote: financeLetter ? financeLetter.verificationNote : null,
      verifiedBy: financeLetter?.verifiedBy?.name || null
    };

    res.status(200).json({ 
      success: true, 
      data: response 
    });
  } catch (err) {
    console.error('Error fetching finance letter details:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc Submit finance letter for a booking
 * @route POST /api/v1/finance-letter/:bookingId/submit
 * @access Private
 */
exports.submitFinanceLetter = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId)
      .select('customerDetails.name customerDetails.salutation status');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const existingFinanceLetter = await FinanceLetter.findOne({ booking: bookingId });
    if (existingFinanceLetter) {
      return res.status(400).json({ 
        success: false, 
        message: 'Finance letter already submitted' 
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Finance letter file is required'
      });
    }

    const financeLetterPath = handleFinanceLetterUpload(file, bookingId);
    if (!financeLetterPath) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload finance letter'
      });
    }

    const financeLetter = await FinanceLetter.create({
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation || ''} ${booking.customerDetails.name}`.trim(),
      financeLetter: financeLetterPath
    });
    
    if (booking.status === 'APPROVED') {
      booking.status = 'FINANCE_LETTER_PENDING';
      await booking.save();
    }

    await AuditLog.create({
      action: 'SUBMIT_FINANCE_LETTER',
      entity: 'FINANCE_LETTER',
      entityId: financeLetter._id,
      user: userId,
      ip: req.ip,
      metadata: { bookingId },
      status: 'SUCCESS'
    });

    res.status(201).json({ 
      success: true, 
      data: { 
        financeLetterId: financeLetter._id,
        status: financeLetter.status 
      }
    });
  } catch (err) {
    console.error('Error submitting finance letter:', err);
    
    await AuditLog.create({
      action: 'SUBMIT_FINANCE_LETTER',
      entity: 'FINANCE_LETTER',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc Verify finance letter (Admin only)
 * @route POST /api/v1/finance-letter/:financeLetterId/verify
 * @access Private/Admin
 */
exports.verifyFinanceLetter = async (req, res) => {
  try {
    const { financeLetterId } = req.params;
    const { status, verificationNote } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(financeLetterId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid finance letter ID' 
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    const financeLetter = await FinanceLetter.findByIdAndUpdate(
      financeLetterId,
      {
        status,
        verifiedBy: userId,
        verificationNote: verificationNote || '',
        updatedAt: Date.now()
      },
      { new: true }
    ).populate('booking', 'status');

    if (!financeLetter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter not found' 
      });
    }

    if (status === 'APPROVED' && financeLetter.booking) {
      await Booking.findByIdAndUpdate(financeLetter.booking._id, { 
        status: 'FINANCE_LETTER_VERIFIED',
        updatedAt: Date.now()
      });
    }

    await AuditLog.create({
      action: 'VERIFY_FINANCE_LETTER',
      entity: 'FINANCE_LETTER',
      entityId: financeLetter._id,
      user: userId,
      ip: req.ip,
      metadata: { status, verificationNote },
      status: 'SUCCESS'
    });

    res.status(200).json({ 
      success: true, 
      data: { 
        status: financeLetter.status,
        verifiedBy: userId,
        verificationNote: financeLetter.verificationNote
      }
    });
  } catch (err) {
    console.error('Error verifying finance letter:', err);
    
    await AuditLog.create({
      action: 'VERIFY_FINANCE_LETTER',
      entity: 'FINANCE_LETTER',
      entityId: req.params.financeLetterId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc Get finance letter document
 * @route GET /api/v1/finance-letter/:bookingId/document
 * @access Private
 */
exports.getFinanceLetterDocument = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId })
      .select('financeLetter status');

    if (!financeLetter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: {
        documentPath: financeLetter.financeLetter,
        status: financeLetter.status
      }
    });
  } catch (err) {
    console.error('Error fetching finance letter document:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc Get all finance letters with pagination
 * @route GET /api/v1/finance-letter
 * @access Private/Admin
 */
exports.getAllFinanceLetters = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    if (isNaN(pageInt) || isNaN(limitInt) || pageInt < 1 || limitInt < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    const query = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [financeLetters, total] = await Promise.all([
      FinanceLetter.find(query)
        .populate('booking', 'bookingReference vehicleDetails')
        .populate('verifiedBy', 'name email')
        .sort(sort)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .lean(),
      FinanceLetter.countDocuments(query)
    ]);

    const formattedFinanceLetters = financeLetters.map(letter => ({
      id: letter._id,
      bookingId: letter.booking?._id,
      bookingReference: letter.booking?.bookingReference,
      vehicle: letter.booking?.vehicleDetails?.model,
      customerName: letter.customerName,
      status: letter.status,
      verifiedBy: letter.verifiedBy ? {
        name: letter.verifiedBy.name,
        email: letter.verifiedBy.email
      } : null,
      verificationNote: letter.verificationNote,
      createdAt: letter.createdAt,
      updatedAt: letter.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedFinanceLetters,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt)
      }
    });
  } catch (err) {
    console.error('Error fetching finance letters:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};