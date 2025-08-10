// controllers/insuranceController.js

const Insurance = require('../models/insuranceModel');
const Booking = require('../models/Booking');

// Utility: Standard API response format
const sendResponse = (res, status, success, message, data = null) => {
  res.status(status).json({ success, message, data });
};

// CREATE Insurance
exports.createInsurance = async (req, res) => {
  try {
    const {
      booking,
      insuranceProvider,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      status,
      remarks
    } = req.body;

    const userId = req.user?._id;

    // 1️⃣ Check booking exists
    const bookingDoc = await Booking.findById(booking);
    if (!bookingDoc) {
      return sendResponse(res, 404, false, 'Booking not found');
    }

    // 2️⃣ Prevent duplicate insurance
    const existingInsurance = await Insurance.findOne({ booking });
    if (existingInsurance) {
      return sendResponse(res, 400, false, 'Insurance already exists for this booking');
    }

    // 3️⃣ Process uploaded files
    const documents = [];
    
    // Helper function to process each document
    const processDocument = (file, index) => {
      if (!file) return null;
      return {
        url: `/uploads/insurance/${file.filename}`,
        name: file.originalname,
        type: index === 0 ? 'POLICY' : 
              index === 1 ? 'RECEIPT' : 'OTHER',
        path: file.path
      };
    };

    // Process all possible document fields
    if (req.files) {
      if (req.files['document']) {
        documents.push(processDocument(req.files['document'][0], 0));
      }
      if (req.files['document1']) {
        documents.push(processDocument(req.files['document1'][0], 1));
      }
      if (req.files['document2']) {
        documents.push(processDocument(req.files['document2'][0], 2));
      }
    }

    // 4️⃣ Validate documents if status is COMPLETED
    if (status === 'COMPLETED' && documents.length === 0) {
      return sendResponse(res, 400, false, 'Documents are required when status is COMPLETED');
    }

    // 5️⃣ Create insurance
    const insurance = await Insurance.create({
      booking,
      insuranceProvider,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      documents,
      status,
      remarks,
      createdBy: userId
    });

    // 6️⃣ Update booking insuranceStatus
    bookingDoc.insuranceStatus = status === 'COMPLETED' ? 'COMPLETED' : 'LATER';
    await bookingDoc.save();

    return sendResponse(res, 201, true, 'Insurance created successfully', insurance);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

exports.updateInsurance = async (req, res) => {
  try {
    const {
      status,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      remarks
    } = req.body;

    const userId = req.user?._id;

    const insurance = await Insurance.findById(req.params.id);
    if (!insurance) {
      return sendResponse(res, 404, false, 'Insurance not found');
    }

    const bookingDoc = await Booking.findById(insurance.booking);
    if (!bookingDoc) {
      return sendResponse(res, 404, false, 'Associated booking not found');
    }

    // Process uploaded files
    const newDocuments = [...insurance.documents]; 
    
    // Helper function to process each document
    const processDocument = (file, index) => {
      if (!file) return null;
      return {
        url: `/uploads/insurance/${file.filename}`,
        name: file.originalname,
        path: file.path
      };
    };

    // Process all possible document fields
    if (req.files) {
      // Replace existing documents if new ones are uploaded
      if (req.files['document']) {
        newDocuments[0] = processDocument(req.files['document'][0], 0);
      }
      if (req.files['document1']) {
        newDocuments[1] = processDocument(req.files['document1'][0], 1);
      }
      if (req.files['document2']) {
        newDocuments[2] = processDocument(req.files['document2'][0], 2);
      }
    }

    // Filter out any null documents (if any field was missing)
    const filteredDocuments = newDocuments.filter(doc => doc !== null && doc !== undefined);

    // Validate documents if status is being updated to COMPLETED
    const finalStatus = status || insurance.status;
    if (finalStatus === 'COMPLETED' && filteredDocuments.length === 0) {
      return sendResponse(res, 400, false, 'Documents are required when status is COMPLETED');
    }

    // Update fields
    if (status) insurance.status = status;
    if (policyNumber) insurance.policyNumber = policyNumber;
    if (rsaPolicyNumber) insurance.rsaPolicyNumber = rsaPolicyNumber;
    if (cmsPolicyNumber) insurance.cmsPolicyNumber = cmsPolicyNumber;
    if (remarks) insurance.remarks = remarks;
    
    // Update documents array if files were uploaded
    if (req.files) {
      insurance.documents = filteredDocuments;
    }

    insurance.updatedBy = userId;
    await insurance.save();

    // Update booking insuranceStatus
    bookingDoc.insuranceStatus = finalStatus === 'COMPLETED' ? 'COMPLETED' : 'AWAITING';
    await bookingDoc.save();

    return sendResponse(res, 200, true, 'Insurance updated successfully', insurance);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// UPDATE Insurance by Booking ID
exports.updateInsuranceByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      status,
      policyNumber,
      rsaPolicyNumber,
      cmsPolicyNumber,
      remarks
    } = req.body;

    const userId = req.user?._id;

    // Find insurance by booking ID
    const insurance = await Insurance.findOne({ booking: bookingId });
    if (!insurance) {
      return sendResponse(res, 404, false, 'Insurance not found for this booking');
    }

    const bookingDoc = await Booking.findById(bookingId);
    if (!bookingDoc) {
      return sendResponse(res, 404, false, 'Booking not found');
    }

    // Process uploaded files
    const newDocuments = [...insurance.documents];
    
    const processDocument = (file, index) => {
      if (!file) return null;
      return {
        url: `/uploads/insurance/${file.filename}`,
        name: file.originalname,
        type: index === 0 ? 'POLICY' : 
              index === 1 ? 'RECEIPT' : 'OTHER',
        path: file.path
      };
    };

    if (req.files) {
      if (req.files['document']) {
        newDocuments[0] = processDocument(req.files['document'][0], 0);
      }
      if (req.files['document1']) {
        newDocuments[1] = processDocument(req.files['document1'][0], 1);
      }
      if (req.files['document2']) {
        newDocuments[2] = processDocument(req.files['document2'][0], 2);
      }
    }

    const filteredDocuments = newDocuments.filter(doc => doc !== null);

    // Validate documents if status is COMPLETED
    const finalStatus = status || insurance.status;
    if (finalStatus === 'COMPLETED' && filteredDocuments.length === 0) {
      return sendResponse(res, 400, false, 'Documents are required when status is COMPLETED');
    }

    // Update fields
    if (status) insurance.status = status;
    if (policyNumber) insurance.policyNumber = policyNumber;
    if (rsaPolicyNumber) insurance.rsaPolicyNumber = rsaPolicyNumber;
    if (cmsPolicyNumber) insurance.cmsPolicyNumber = cmsPolicyNumber;
    if (remarks) insurance.remarks = remarks;
    
    if (req.files) {
      insurance.documents = filteredDocuments;
    }

    insurance.updatedBy = userId;
    await insurance.save();

    // Update booking insuranceStatus
    bookingDoc.insuranceStatus = finalStatus === 'COMPLETED' ? 'COMPLETED' : 'LATER';
    await bookingDoc.save();

    return sendResponse(res, 200, true, 'Insurance updated successfully', insurance);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// GET All Insurances
exports.getAllInsurances = async (req, res) => {
  try {
    const insurances = await Insurance.findAllInsurances();
    return sendResponse(res, 200, true, 'Insurances retrieved successfully', insurances);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// GET Single Insurance by ID
exports.getInsuranceById = async (req, res) => {
  try {
    const insurance = await Insurance.findById(req.params.id)
      .populate('bookingDetails')
      .populate('insuranceProviderDetails')
      .populate('createdBy')
      .populate('approvedBy');

    if (!insurance) {
      return sendResponse(res, 404, false, 'Insurance not found');
    }

    return sendResponse(res, 200, true, 'Insurance retrieved successfully', insurance);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// DELETE Insurance
exports.deleteInsurance = async (req, res) => {
  try {
    const insurance = await Insurance.findById(req.params.id);
    if (!insurance) {
      return sendResponse(res, 404, false, 'Insurance not found');
    }

    // Reset booking insuranceStatus to AWAITING when deleting
    await Booking.findByIdAndUpdate(insurance.booking, { insuranceStatus: 'AWAITING' });

    await insurance.remove();
    return sendResponse(res, 200, true, 'Insurance deleted successfully');
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
