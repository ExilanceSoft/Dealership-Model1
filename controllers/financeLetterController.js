// controllers/financeLetterController.js
const FinanceLetter = require('../models/FinanceLetter');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const KYC = require('../models/KYC')
const User = require('../models/User')

// Submit Finance Letter
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

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Finance letter file is required'
      });
    }

    const uploadDir = path.join(__dirname, '../uploads/finance-letters', bookingId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `finance-letter-${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, filename);
    const fileUrl = `/uploads/finance-letters/${bookingId}/${filename}`;

    await fs.promises.writeFile(filePath, file.buffer);

    const financeLetterData = {
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      financeLetter: fileUrl,
      submittedBy: userId,
      status: 'PENDING'
    };

    const existingFinanceLetter = await FinanceLetter.findOne({ booking: bookingId });
    let financeLetter;

    if (existingFinanceLetter) {
      // Delete old file
      if (existingFinanceLetter.financeLetter) {
        const oldFilePath = path.join(__dirname, '..', existingFinanceLetter.financeLetter);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      financeLetter = await FinanceLetter.findByIdAndUpdate(
        existingFinanceLetter._id, 
        financeLetterData, 
        { new: true }
      );
    } else {
      financeLetter = await FinanceLetter.create(financeLetterData);
    }

    // Update booking finance letter status
    booking.financeLetterStatus = 'PENDING';
    await booking.save();

    // Check KYC and unfreeze user if KYC exists
    const kyc = await KYC.findOne({ booking: bookingId });
    if (kyc) {
      await User.findByIdAndUpdate(userId, {
        isFrozen: false,
        freezeReason: ''
      });
    }

    await AuditLog.create({
      action: existingFinanceLetter ? 'FINANCE_LETTER_RESUBMITTED' : 'FINANCE_LETTER_SUBMITTED',
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
        status: financeLetter.status,
        documentUrl: financeLetter.financeLetter
      }
    });
  } catch (err) {
    console.error('Error submitting finance letter:', err);
    
    await AuditLog.create({
      action: 'FINANCE_LETTER_SUBMISSION_FAILED',
      entity: 'FINANCE_LETTER',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error submitting finance letter',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get Finance Letter by Booking ID
exports.getFinanceLetterByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId })
      .populate('verifiedBy', 'name email')
      .lean();

    if (!financeLetter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter not found for this booking' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookingId: bookingId, // Explicitly include booking ID
        ...financeLetter // Spread all other finance letter details
      }
    });
  } catch (err) {
    console.error('Error fetching finance letter:', err);
    
    await AuditLog.create({
      action: 'VIEW_FINANCE_LETTER_FAILED',
      entity: 'FINANCE_LETTER',
      entityId: req.params.bookingId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching finance letter',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Verify Finance Letter by Booking ID
exports.verifyFinanceLetterByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, verificationNote } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be either APPROVED or REJECTED' 
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId });
    if (!financeLetter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter not found for this booking' 
      });
    }

    if (financeLetter.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Finance letter has already been processed'
      });
    }

    // Update finance letter
    financeLetter.status = status;
    financeLetter.verifiedBy = userId;
    financeLetter.verificationNote = verificationNote || '';
    financeLetter.verificationDate = new Date();
    await financeLetter.save();

    // Update booking status
    booking.financeLetterStatus = status;
    await booking.save();

    await AuditLog.create({
      action: 'FINANCE_LETTER_VERIFIED',
      entity: 'FINANCE_LETTER',
      entityId: financeLetter._id,
      user: userId,
      ip: req.ip,
      metadata: { 
        status, 
        verificationNote,
        bookingId 
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: {
        financeLetterId: financeLetter._id,
        status: financeLetter.status,
        verifiedBy: userId,
        verificationNote: financeLetter.verificationNote
      }
    });
  } catch (err) {
    console.error('Error verifying finance letter:', err);
    
    await AuditLog.create({
      action: 'FINANCE_LETTER_VERIFICATION_FAILED',
      entity: 'FINANCE_LETTER',
      entityId: req.params.bookingId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error verifying finance letter',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get Finance Letter Status by Booking ID
exports.getFinanceLetterStatusByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId)
      .select('financeLetterStatus customerDetails');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId })
      .select('status financeLetter verificationNote verifiedBy verificationDate')
      .populate('verifiedBy', 'name');

    res.status(200).json({
      success: true,
      data: {
        bookingId,
        customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
        status: booking.financeLetterStatus,
        documentUrl: financeLetter?.financeLetter || null,
        verificationNote: financeLetter?.verificationNote || null,
        verifiedBy: financeLetter?.verifiedBy?.name || null,
        verificationDate: financeLetter?.verificationDate || null
      }
    });
  } catch (err) {
    console.error('Error fetching finance letter status:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching finance letter status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Download Finance Letter
exports.downloadFinanceLetter = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const financeLetter = await FinanceLetter.findOne({ booking: bookingId });
    if (!financeLetter || !financeLetter.financeLetter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter not found' 
      });
    }

    const filePath = path.join(__dirname, '..', financeLetter.financeLetter);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Finance letter file not found' 
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    // res.setHeader('Content-Disposition', `attachment; filename=finance-letter-${bookingId}.pdf`);
    res.setHeader('Content-Disposition', `inline; filename=finance-letter-${bookingId}.pdf`);
    
    const readStream = fs.createReadStream(filePath);
    await pipeline(readStream, res);
  } catch (err) {
    console.error('Error downloading finance letter:', err);
    res.status(500).json({
      success: false,
      message: 'Error downloading finance letter',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};