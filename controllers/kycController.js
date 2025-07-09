const KYC = require('../models/KYC');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Helper function to handle file uploads
const handleFileUpload = (file, bookingId, docType) => {
  if (!file) return null;
  
  const uploadDir = path.join(__dirname, '../uploads/kyc', bookingId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname);
  const filename = `${docType}-${Date.now()}${ext}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/kyc/${bookingId}/${filename}`;
};

exports.getKYCDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    // Check if booking exists and get customer details
    const booking = await Booking.findById(bookingId)
      .select('customerDetails.name customerDetails.address');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if KYC already exists
    const kyc = await KYC.findOne({ booking: bookingId })
      .select('status verifiedBy verificationNote');

    const response = {
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address,
      kycStatus: kyc ? kyc.status : 'NOT_SUBMITTED',
      verificationNote: kyc ? kyc.verificationNote : null,
      verifiedBy: kyc ? kyc.verifiedBy : null
    };

    res.status(200).json({ success: true, data: response });
  } catch (err) {
    console.error('Error fetching KYC details:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching KYC details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.submitKYC = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const files = req.files;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    // Check if booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if KYC already exists
    const existingKYC = await KYC.findOne({ booking: bookingId });
    if (existingKYC) {
      return res.status(400).json({ 
        success: false, 
        message: 'KYC already submitted for this booking' 
      });
    }

    // Validate required files
    const requiredDocs = [
      'aadharFront', 'aadharBack', 'panCard', 
      'vPhoto', 'chasisNoPhoto', 'addressProof1'
    ];
    
    const missingDocs = requiredDocs.filter(doc => !files[doc]);
    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missingDocs.join(', ')}`
      });
    }

    // Process file uploads
    const kycData = {
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address
    };

    // Handle all file uploads
    for (const [field, file] of Object.entries(files)) {
      if (file) {
        kycData[field] = handleFileUpload(file[0], bookingId, field);
      }
    }

    // Create KYC record
    const kyc = await KYC.create(kycData);
    
    // Update booking status if needed
    if (booking.status === 'APPROVED') {
      booking.status = 'KYC_PENDING';
      await booking.save();
    }

    await AuditLog.create({
      action: 'SUBMIT_KYC',
      entity: 'KYC',
      entityId: kyc._id,
      user: userId,
      ip: req.ip,
      metadata: { bookingId },
      status: 'SUCCESS'
    });

    res.status(201).json({ 
      success: true, 
      data: { 
        kycId: kyc._id,
        status: kyc.status 
      }
    });

  } catch (err) {
    console.error('Error submitting KYC:', err);
    
    await AuditLog.create({
      action: 'SUBMIT_KYC',
      entity: 'KYC',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error submitting KYC',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.verifyKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { status, verificationNote } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(kycId)) {
      return res.status(400).json({ success: false, message: 'Invalid KYC ID' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be either APPROVED or REJECTED' 
      });
    }

    const kyc = await KYC.findByIdAndUpdate(
      kycId,
      {
        status,
        verifiedBy: userId,
        verificationNote: verificationNote || '',
        updatedAt: Date.now()
      },
      { new: true }
    ).populate('booking', 'status');

    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC not found' });
    }

    // Update booking status if KYC is approved
    if (status === 'APPROVED' && kyc.booking) {
      await Booking.findByIdAndUpdate(kyc.booking._id, { 
        status: 'KYC_VERIFIED',
        updatedAt: Date.now()
      });
    }

    await AuditLog.create({
      action: 'VERIFY_KYC',
      entity: 'KYC',
      entityId: kyc._id,
      user: userId,
      ip: req.ip,
      metadata: { status, verificationNote },
      status: 'SUCCESS'
    });

    res.status(200).json({ 
      success: true, 
      data: { 
        status: kyc.status,
        verifiedBy: userId,
        verificationNote: kyc.verificationNote
      }
    });

  } catch (err) {
    console.error('Error verifying KYC:', err);
    
    await AuditLog.create({
      action: 'VERIFY_KYC',
      entity: 'KYC',
      entityId: req.params.kycId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error verifying KYC',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getKYCDocuments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .select('aadharFront aadharBack panCard vPhoto chasisNoPhoto addressProof1 addressProof2 status');

    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC not found for this booking' });
    }

    res.status(200).json({ success: true, data: kyc });
  } catch (err) {
    console.error('Error fetching KYC documents:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching KYC documents',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};