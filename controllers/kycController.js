// controllers/kycController.js
const KYC = require('../models/KYC');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const pdfkit = require('pdfkit');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const FinanceLetter = require('../models/FinanceLetter');
const User = require('../models/User');

// Helper to generate PDF for a single document
const generateSingleDocumentPdf = async (file, docType, bookingId) => {
  const uploadDir = path.join(__dirname, '../uploads/kyc', bookingId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const pdfPath = path.join(uploadDir, `${docType}-${Date.now()}.pdf`);
  const doc = new pdfkit();
  const writeStream = fs.createWriteStream(pdfPath);

  doc.pipe(writeStream);

  // Add document type as title
  doc.fontSize(16).text(docType.toUpperCase(), { align: 'center' });
  doc.moveDown();

  // Check if the file is a PDF or image
  if (file.mimetype === 'application/pdf') {
    doc.fontSize(12).text('Original PDF Document:', { underline: true });
    doc.moveDown(0.5);
    doc.text(`File name: ${file.originalname}`);
    doc.text(`Saved at: /uploads/kyc/${bookingId}/${file.originalname}`);
    doc.moveDown();
    doc.text('View the original PDF file for full details.');
  } else if (file.mimetype.startsWith('image/')) {
    // For images
    doc.fontSize(12).text('Document Image:', { underline: true });
    doc.moveDown(0.5);
    try {
      doc.image(file.buffer, {
        fit: [500, 400],
        align: 'center',
        valign: 'center'
      });
      doc.moveDown();
      doc.text(`Original file type: ${file.mimetype}`);
      doc.text(`Original file name: ${file.originalname}`);
    } catch (err) {
      doc.text('Error processing image file');
      console.error(`Error processing image for ${docType}:`, err);
    }
  } else {
    // For other file types
    doc.fontSize(12).text('Original Document:', { underline: true });
    doc.moveDown(0.5);
    doc.text(`File type: ${file.mimetype}`);
    doc.text(`File name: ${file.originalname}`);
    doc.moveDown();
    doc.text('View the original file for full document content.');
  }

  doc.end();
  await new Promise(resolve => writeStream.on('finish', resolve));

  return `/uploads/kyc/${bookingId}/${path.basename(pdfPath)}`;
};

// Helper to generate combined PDF from all documents
const generateCombinedKycPdf = async (documentPaths, bookingId) => {
  const uploadDir = path.join(__dirname, '../uploads/kyc', bookingId);
  const pdfPath = path.join(uploadDir, `kyc-combined-${Date.now()}.pdf`);
  const doc = new pdfkit();
  const writeStream = fs.createWriteStream(pdfPath);

  doc.pipe(writeStream);

  // Add cover page
  doc.fontSize(20).text('KYC DOCUMENTS', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).text(`Booking ID: ${bookingId}`, { align: 'center' });
  doc.addPage();

  // Add each document to the combined PDF
  for (const [docType, fileInfo] of Object.entries(documentPaths)) {
    if (fileInfo && fileInfo.originalPath) {
      try {
        doc.fontSize(16).text(docType.toUpperCase(), { align: 'center' });
        doc.moveDown();

        if (fileInfo.mimetype === 'application/pdf') {
          doc.fontSize(12).text('PDF Document - view original file for details');
          doc.text(`File name: ${fileInfo.originalname}`);
        } else if (fileInfo.mimetype.startsWith('image/')) {
          const fullPath = path.join(__dirname, '..', fileInfo.originalPath);
          if (fs.existsSync(fullPath)) {
            doc.image(fullPath, {
              fit: [500, 400],
              align: 'center',
              valign: 'center'
            });
          } else {
            doc.text('Image file not found on server');
          }
        } else {
          doc.text('Document - view original file for details');
          doc.text(`Type: ${fileInfo.mimetype}`);
          doc.text(`Name: ${fileInfo.originalname}`);
        }

        doc.addPage();
      } catch (err) {
        console.error(`Error adding ${docType} to combined PDF:`, err);
        doc.text(`Error processing ${docType} document`);
        doc.addPage();
      }
    }
  }

  doc.end();
  await new Promise(resolve => writeStream.on('finish', resolve));

  return `/uploads/kyc/${bookingId}/${path.basename(pdfPath)}`;
};

// Get KYC Details
exports.getKYCDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .populate('submittedBy', 'name email')
      .populate('verifiedBy', 'name email');

    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found for this booking' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookingId: bookingId,
        ...kyc.toObject()
      }
    });
  } catch (err) {
    console.error('Error fetching KYC details:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Submit KYC
exports.submitKYC = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const files = req.files;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    // Check if booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // Validate required documents
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

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads/kyc', bookingId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process each document and generate individual PDFs
    const documentPaths = {};
    const pdfPaths = {};

    for (const [docType, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray[0]) {
        const file = fileArray[0];
        
        // Save original file
        const fileName = `${docType}-${Date.now()}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadDir, fileName);
        await fs.promises.writeFile(filePath, file.buffer);
        documentPaths[docType] = {
          originalPath: `/uploads/kyc/${bookingId}/${fileName}`,
          mimetype: file.mimetype,
          originalname: file.originalname
        };

        // Generate PDF version
        const pdfPath = await generateSingleDocumentPdf(file, docType, bookingId);
        pdfPaths[docType] = pdfPath;
      }
    }

    // Generate combined PDF
    const combinedPdfPath = await generateCombinedKycPdf(documentPaths, bookingId);

    // Prepare KYC data
    const kycData = {
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address,
      aadharFront: {
        original: documentPaths.aadharFront.originalPath,
        pdf: pdfPaths.aadharFront,
        mimetype: documentPaths.aadharFront.mimetype,
        originalname: documentPaths.aadharFront.originalname
      },
      aadharBack: {
        original: documentPaths.aadharBack.originalPath,
        pdf: pdfPaths.aadharBack,
        mimetype: documentPaths.aadharBack.mimetype,
        originalname: documentPaths.aadharBack.originalname
      },
      panCard: {
        original: documentPaths.panCard.originalPath,
        pdf: pdfPaths.panCard,
        mimetype: documentPaths.panCard.mimetype,
        originalname: documentPaths.panCard.originalname
      },
      vPhoto: {
        original: documentPaths.vPhoto.originalPath,
        pdf: pdfPaths.vPhoto,
        mimetype: documentPaths.vPhoto.mimetype,
        originalname: documentPaths.vPhoto.originalname
      },
      chasisNoPhoto: {
        original: documentPaths.chasisNoPhoto.originalPath,
        pdf: pdfPaths.chasisNoPhoto,
        mimetype: documentPaths.chasisNoPhoto.mimetype,
        originalname: documentPaths.chasisNoPhoto.originalname
      },
      addressProof1: {
        original: documentPaths.addressProof1.originalPath,
        pdf: pdfPaths.addressProof1,
        mimetype: documentPaths.addressProof1.mimetype,
        originalname: documentPaths.addressProof1.originalname
      },
      addressProof2: documentPaths.addressProof2 ? {
        original: documentPaths.addressProof2.originalPath,
        pdf: pdfPaths.addressProof2,
        mimetype: documentPaths.addressProof2.mimetype,
        originalname: documentPaths.addressProof2.originalname
      } : null,
      documentPdf: combinedPdfPath,
      submittedBy: userId,
      status: 'PENDING'
    };

    // Update or create KYC
    const existingKYC = await KYC.findOne({ booking: bookingId });
    let kyc;

    if (existingKYC) {
      // Delete old files if they exist
      const oldFiles = [
        existingKYC.aadharFront?.original,
        existingKYC.aadharFront?.pdf,
        existingKYC.aadharBack?.original,
        existingKYC.aadharBack?.pdf,
        existingKYC.panCard?.original,
        existingKYC.panCard?.pdf,
        existingKYC.vPhoto?.original,
        existingKYC.vPhoto?.pdf,
        existingKYC.chasisNoPhoto?.original,
        existingKYC.chasisNoPhoto?.pdf,
        existingKYC.addressProof1?.original,
        existingKYC.addressProof1?.pdf,
        existingKYC.addressProof2?.original,
        existingKYC.addressProof2?.pdf,
        existingKYC.documentPdf
      ].filter(Boolean);

      for (const filePath of oldFiles) {
        try {
          const fullPath = path.join(__dirname, '..', filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Error deleting old file ${filePath}:`, err);
        }
      }
      
      kyc = await KYC.findByIdAndUpdate(existingKYC._id, kycData, { new: true });
    } else {
      kyc = await KYC.create(kycData);
    }

    // Update booking KYC status
    booking.kycStatus = 'PENDING';
    await booking.save();

    // Unfreeze user account based on payment type
    if (booking) {
      if (booking.payment.type !== 'FINANCE') {
        await User.findByIdAndUpdate(req.user.id, {
          isFrozen: false,
          freezeReason: ''
        });
      } else {
        const financeLetter = await FinanceLetter.findOne({ booking: bookingId });
        if (financeLetter) {
          await User.findByIdAndUpdate(req.user.id, {
            isFrozen: false,
            freezeReason: ''
          });
        }
      }
    }

    // Log the action
    await AuditLog.create({
      action: existingKYC ? 'KYC_RESUBMITTED' : 'KYC_SUBMITTED',
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
        isResubmission: !!existingKYC,
        documentPdf: kyc.documentPdf
      }
    });
  } catch (err) {
    console.error('Error submitting KYC:', err);
    
    await AuditLog.create({
      action: 'KYC_SUBMISSION_FAILED',
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

// Get KYC Documents
exports.getKYCDocuments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    // First get the booking details
    const booking = await Booking.findById(bookingId)
      .select('bookingNumber customerDetails chassisNumber model color branch')
      .populate('model', 'name model_name')
      .populate('color', 'name code')
      .populate('branch', 'name');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .select('aadharFront aadharBack panCard vPhoto chasisNoPhoto addressProof1 addressProof2 documentPdf');

    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found for this booking' 
      });
    }

    // Prepare booking details for response
    const bookingDetails = {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerDetails.name,
      chassisNumber: booking.chassisNumber,
      model: booking.model,
      color: booking.color,
      branch: booking.branch
    };

    res.status(200).json({
      success: true,
      data: {
        bookingDetails,
        kycDocuments: kyc
      }
    });
  } catch (err) {
    console.error('Error fetching KYC documents:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC documents',
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

    // Get the directory path
    const uploadDir = path.join(__dirname, '../uploads/kyc', kyc.booking.toString());

    // Delete all files in the directory
    if (fs.existsSync(uploadDir)) {
      fs.readdirSync(uploadDir).forEach(file => {
        const filePath = path.join(uploadDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error deleting file ${filePath}:`, err);
        }
      });

      // Remove the directory
      try {
        fs.rmdirSync(uploadDir);
      } catch (err) {
        console.error(`Error deleting directory ${uploadDir}:`, err);
      }
    }

    await kyc.remove();

    // Update booking KYC status
    const booking = await Booking.findById(kyc.booking);
    if (booking) {
      booking.kycStatus = 'NOT_SUBMITTED';
      await booking.save();
    }

    await AuditLog.create({
      action: 'KYC_DELETED',
      entity: 'KYC',
      entityId: kycId,
      user: userId,
      ip: req.ip,
      metadata: { bookingId: kyc.booking },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'KYC deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting KYC:', err);
    
    await AuditLog.create({
      action: 'KYC_DELETION_FAILED',
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

exports.verifyKYCByBooking = async (req, res) => {
  try {
    const bookingId = new mongoose.Types.ObjectId(req.params.bookingId);
    const userId = req.user.id;

    const kyc = await KYC.findOne({ booking: bookingId });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC not found'
      });
    }

    kyc.status = req.body.status;
    kyc.verificationNote = req.body.verificationNote || '';
    kyc.verifiedBy = userId;
    kyc.verificationDate = new Date();
    await kyc.save();

    // Update booking KYC status
    await Booking.findByIdAndUpdate(bookingId, {
      kycStatus: req.body.status
    });

    // Log the action
    await AuditLog.create({
      action: 'KYC_VERIFIED',
      entity: 'KYC',
      entityId: kyc._id,
      user: userId,
      ip: req.ip,
      metadata: { 
        bookingId,
        status: req.body.status,
        note: req.body.verificationNote || ''
      },
      status: 'SUCCESS'
    });

    return res.status(200).json({
      success: true,
      message: 'KYC verified successfully',
      data: {
        status: kyc.status,
        verificationNote: kyc.verificationNote,
        verifiedBy: userId,
        verificationDate: kyc.verificationDate
      }
    });

  } catch (err) {
    console.error('Error verifying KYC:', err);
    
    await AuditLog.create({
      action: 'KYC_VERIFICATION_FAILED',
      entity: 'KYC',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    return res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Get KYC Status by Booking ID
exports.getKYCStatusByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    const booking = await Booking.findById(bookingId)
      .select('kycStatus customerDetails');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    const kyc = await KYC.findOne({ booking: bookingId })
      .select('status documentPdf verificationNote verifiedBy verificationDate')
      .populate('verifiedBy', 'name');

    res.status(200).json({
      success: true,
      data: {
        bookingId,
        customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
        status: booking.kycStatus,
        documentPdf: kyc?.documentPdf || null,
        verificationNote: kyc?.verificationNote || null,
        verifiedBy: kyc?.verifiedBy?.name || null,
        verificationDate: kyc?.verificationDate || null
      }
    });
  } catch (err) {
    console.error('Error fetching KYC status:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Download KYC PDF
exports.downloadKYCPdf = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    // Find KYC by booking ID
    const kyc = await KYC.findOne({ booking: bookingId });
    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found for this booking' 
      });
    }

    if (!kyc.documentPdf) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC document PDF not generated yet' 
      });
    }

    const filePath = path.join(__dirname, '..', kyc.documentPdf);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC document file not found on server' 
      });
    }

    // Set appropriate headers for viewing in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=kyc-${bookingId}.pdf`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error viewing KYC PDF:', err);
    res.status(500).json({
      success: false,
      message: 'Error viewing KYC document',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Download Original Document
exports.downloadOriginalDocument = async (req, res) => {
  try {
    const { bookingId, docType } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID' 
      });
    }

    // Find KYC by booking ID
    const kyc = await KYC.findOne({ booking: bookingId });
    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found for this booking' 
      });
    }

    const document = kyc[docType];
    if (!document || !document.original) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found' 
      });
    }

    const filePath = path.join(__dirname, '..', document.original);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document file not found on server' 
      });
    }

    // Determine content type
    const contentType = document.mimetype || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename=${document.originalname || docType}`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error downloading original document:', err);
    res.status(500).json({
      success: false,
      message: 'Error downloading document',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};