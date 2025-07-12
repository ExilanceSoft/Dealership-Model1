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

// Helper function to delete old files
const deleteOldFiles = async (kyc) => {
  try {
    const docs = [
      kyc.aadharFront, kyc.aadharBack, kyc.panCard,
      kyc.vPhoto, kyc.chasisNoPhoto, kyc.addressProof1, 
      kyc.addressProof2
    ];
    
    for (const doc of docs) {
      if (doc) {
        const filePath = path.join(__dirname, '..', doc);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (err) {
    console.error('Error deleting old files:', err);
  }
};

// Get complete KYC details
exports.getKYCDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId)
      .select('customerDetails.name customerDetails.address customerDetails.salutation');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .populate('submittedBy', 'name')
      .populate('verifiedBy', 'name')
      .populate('updatedBy', 'name');

    const response = {
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address,
      kycStatus: kyc ? kyc.status : 'NOT_SUBMITTED',
      verificationNote: kyc ? kyc.verificationNote : null,
      verifiedBy: kyc && kyc.verifiedBy ? kyc.verifiedBy.name : null,
      submittedBy: kyc ? kyc.submittedBy.name : null,
      updatedBy: kyc && kyc.updatedBy ? kyc.updatedBy.name : null,
      submissionDate: kyc ? kyc.createdAt : null,
      verificationDate: kyc ? kyc.verificationDate : null,
      documents: kyc ? {
        aadharFront: kyc.aadharFront,
        aadharBack: kyc.aadharBack,
        panCard: kyc.panCard,
        vPhoto: kyc.vPhoto,
        chasisNoPhoto: kyc.chasisNoPhoto,
        addressProof1: kyc.addressProof1,
        addressProof2: kyc.addressProof2
      } : null
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

// Submit or resubmit KYC
exports.submitKYC = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const files = req.files;

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

    const existingKYC = await KYC.findOne({ booking: bookingId });
    const isResubmission = existingKYC && existingKYC.status === 'REJECTED';

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

    // Delete old files if resubmitting
    if (isResubmission) {
      await deleteOldFiles(existingKYC);
    }

    const kycData = {
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address,
      submittedBy: userId,
      status: 'PENDING',
      verificationNote: '',
      verifiedBy: null,
      verificationDate: null
    };

    for (const [field, file] of Object.entries(files)) {
      if (file) {
        kycData[field] = handleFileUpload(file[0], bookingId, field);
      }
    }

    let kyc;
    if (isResubmission) {
      kyc = await KYC.findByIdAndUpdate(
        existingKYC._id, 
        kycData, 
        { new: true }
      );
    } else {
      if (existingKYC) {
        return res.status(400).json({ 
          success: false, 
          message: 'KYC already submitted for this booking' 
        });
      }
      kyc = await KYC.create(kycData);
    }

    await AuditLog.create({
      action: isResubmission ? 'RESUBMIT_KYC' : 'SUBMIT_KYC',
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
        status: kyc.status,
        submissionDate: kyc.createdAt,
        isResubmission
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

// Verify KYC (approve/reject)
exports.verifyKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { status, verificationNote } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(kycId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid KYC ID' 
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be either APPROVED or REJECTED' 
      });
    }

    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found' 
      });
    }

    if (kyc.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'KYC has already been processed'
      });
    }

    const updateData = {
      status,
      verifiedBy: userId,
      verificationNote: verificationNote || '',
      verificationDate: Date.now(),
      updatedBy: userId
    };

    const updatedKYC = await KYC.findByIdAndUpdate(
      kycId,
      updateData,
      { new: true }
    );

    await AuditLog.create({
      action: 'VERIFY_KYC',
      entity: 'KYC',
      entityId: updatedKYC._id,
      user: userId,
      ip: req.ip,
      metadata: { 
        status, 
        verificationNote: verificationNote || '',
        previousStatus: kyc.status 
      },
      status: 'SUCCESS'
    });

    res.status(200).json({ 
      success: true, 
      data: { 
        status: updatedKYC.status,
        verifiedBy: userId,
        verificationNote: updatedKYC.verificationNote,
        verificationDate: updatedKYC.verificationDate
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

// Delete KYC
exports.deleteKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(kycId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid KYC ID' 
      });
    }

    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found' 
      });
    }

    // Delete associated files
    await deleteOldFiles(kyc);

    await KYC.findByIdAndDelete(kycId);

    await AuditLog.create({
      action: 'DELETE_KYC',
      entity: 'KYC',
      entityId: kycId,
      user: userId,
      ip: req.ip,
      status: 'SUCCESS'
    });

    res.status(200).json({ 
      success: true, 
      message: 'KYC deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting KYC:', err);
    
    await AuditLog.create({
      action: 'DELETE_KYC',
      entity: 'KYC',
      entityId: req.params.kycId,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error deleting KYC',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get KYC documents
exports.getKYCDocuments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .select('aadharFront aadharBack panCard vPhoto chasisNoPhoto addressProof1 addressProof2');

    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found' 
      });
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