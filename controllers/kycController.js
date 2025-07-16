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

// Helper to generate PDF from images
const generateKycPdf = async (files, bookingId) => {
  const uploadDir = path.join(__dirname, '../uploads/kyc', bookingId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const pdfPath = path.join(uploadDir, `kyc-documents-${Date.now()}.pdf`);
  const doc = new pdfkit();
  const writeStream = fs.createWriteStream(pdfPath);

  doc.pipe(writeStream);

  // Add each image to the PDF
  for (const [docType, file] of Object.entries(files)) {
    if (file && file[0]) {
      doc.text(docType.toUpperCase(), { align: 'center' });
      doc.moveDown();
      doc.image(file[0].buffer, {
        fit: [500, 400],
        align: 'center',
        valign: 'center'
      });
      doc.addPage();
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
      data: kyc
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
// Update the submitKYC function in kycController.js
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
    const uploadDir = path.join(__dirname, '../uploads/kyc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate PDF filename
    const pdfFileName = `kyc-${bookingId}-${Date.now()}.pdf`;
    const pdfPath = path.join(uploadDir, pdfFileName);
    const pdfUrl = `/uploads/kyc/${pdfFileName}`;

    // Create PDF document
    const doc = new pdfkit();
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add each document to the PDF
    for (const [docType, file] of Object.entries(files)) {
      if (file && file[0]) {
        doc.text(docType.toUpperCase(), { align: 'center' });
        doc.moveDown();
        
        // Check if the file is a PDF or image
        if (file[0].mimetype === 'application/pdf') {
          // For PDF files, we would need a different approach since pdfkit can't directly embed PDFs
          // For now, we'll skip PDF files in the combined document
          doc.text('PDF document - view separately');
        } else {
          // For images
          doc.image(file[0].buffer, {
            fit: [500, 400],
            align: 'center',
            valign: 'center'
          });
        }
        
        doc.addPage();
      }
    }

    doc.end();
    await new Promise(resolve => writeStream.on('finish', resolve));

    // Save file information for each document
    const documentPaths = {};
    for (const [docType, file] of Object.entries(files)) {
      if (file && file[0]) {
        const fileName = `${docType}-${Date.now()}${path.extname(file[0].originalname)}`;
        const filePath = path.join(uploadDir, fileName);
        await fs.promises.writeFile(filePath, file[0].buffer);
        documentPaths[docType] = `/uploads/kyc/${fileName}`;
      }
    }

    // Prepare KYC data
    const kycData = {
      booking: bookingId,
      customerName: `${booking.customerDetails.salutation} ${booking.customerDetails.name}`,
      address: booking.customerDetails.address,
      aadharFront: documentPaths.aadharFront,
      aadharBack: documentPaths.aadharBack,
      panCard: documentPaths.panCard,
      vPhoto: documentPaths.vPhoto,
      chasisNoPhoto: documentPaths.chasisNoPhoto,
      addressProof1: documentPaths.addressProof1,
      addressProof2: documentPaths.addressProof2 || null,
      documentPdf: pdfUrl,
      submittedBy: userId,
      status: 'PENDING'
    };

    // Update or create KYC
    const existingKYC = await KYC.findOne({ booking: bookingId });
    let kyc;

    if (existingKYC) {
      // Delete old files if they exist
      const oldFiles = [
        existingKYC.aadharFront,
        existingKYC.aadharBack,
        existingKYC.panCard,
        existingKYC.vPhoto,
        existingKYC.chasisNoPhoto,
        existingKYC.addressProof1,
        existingKYC.addressProof2,
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

// Verify KYC
// exports.verifyKYC = async (req, res) => {
//   try {
//     const { kycId } = req.params;
//     const { status, verificationNote } = req.body;
//     const userId = req.user.id;

//     if (!mongoose.Types.ObjectId.isValid(kycId)) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Invalid KYC ID' 
//       });
//     }

//     if (!['APPROVED', 'REJECTED'].includes(status)) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Status must be either APPROVED or REJECTED' 
//       });
//     }

//     const kyc = await KYC.findById(kycId);
//     if (!kyc) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'KYC not found' 
//       });
//     }

//     if (kyc.status !== 'PENDING') {
//       return res.status(400).json({
//         success: false,
//         message: 'KYC has already been processed'
//       });
//     }

//     // Update KYC
//     kyc.status = status;
//     kyc.verifiedBy = userId;
//     kyc.verificationNote = verificationNote || '';
//     kyc.verificationDate = new Date();
//     await kyc.save();

//     // Update booking status
//     const booking = await Booking.findById(kyc.booking);
//     if (booking) {
//       booking.kycStatus = status;
//       await booking.save();
//     }

//     await AuditLog.create({
//       action: 'KYC_VERIFIED',
//       entity: 'KYC',
//       entityId: kyc._id,
//       user: userId,
//       ip: req.ip,
//       metadata: { 
//         status, 
//         verificationNote,
//         bookingId: kyc.booking 
//       },
//       status: 'SUCCESS'
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         kycId: kyc._id,
//         status: kyc.status,
//         verifiedBy: userId,
//         verificationNote: kyc.verificationNote
//       }
//     });
//   } catch (err) {
//     console.error('Error verifying KYC:', err);
    
//     await AuditLog.create({
//       action: 'KYC_VERIFICATION_FAILED',
//       entity: 'KYC',
//       entityId: req.params.kycId,
//       user: req.user?.id,
//       ip: req.ip,
//       status: 'FAILED',
//       error: err.message
//     });

//     res.status(500).json({
//       success: false,
//       message: 'Error verifying KYC',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

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

    const kyc = await KYC.findOne({ booking: bookingId })
      .select('aadharFront aadharBack panCard vPhoto chasisNoPhoto addressProof1 addressProof2 documentPdf');

    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: 'KYC not found for this booking' 
      });
    }

    res.status(200).json({
      success: true,
      data: kyc
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

    // Delete associated PDF file if exists
    if (kyc.documentPdf) {
      const filePath = path.join(__dirname, '..', kyc.documentPdf);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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

    const kyc = await KYC.findOne({ booking: bookingId });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC not found'
      });
    }

    kyc.status = req.body.status;
    kyc.verificationNote = req.body.verificationNote || '';
    await kyc.save();

    // Optionally update booking as well
    await Booking.findByIdAndUpdate(bookingId, {
      kycStatus: req.body.status
    });

    return res.status(200).json({
      success: true,
      message: 'KYC verified successfully'
    });

  } catch (err) {
    console.error('Error verifying KYC:', err);
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