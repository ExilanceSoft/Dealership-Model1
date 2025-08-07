const Branch = require('../models/Branch');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const fs = require('fs');
const path = require('path');

// Helper function for validation
const validateBranchData = (data) => {
  const errors = {};
  
  if (data.phone && !/^[6-9]\d{9}$/.test(data.phone)) {
    errors.phone = 'Invalid phone number format (must be 10 digits starting with 6-9)';
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (data.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.gst_number)) {
    errors.gst_number = 'Invalid GST number format';
  }

  if (data.pincode && !/^[1-9][0-9]{5}$/.test(data.pincode)) {
    errors.pincode = 'Invalid pincode format (must be 6 digits)';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

// Helper function to handle file uploads
const handleFileUpload = (file, branchId, logoNumber) => {
  if (!file) return null;
  
  const uploadDir = path.join(__dirname, '../uploads/branches', branchId.toString());
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const ext = path.extname(file.originalname);
  const filename = `logo${logoNumber}${ext}`;
  const filePath = path.join(uploadDir, filename);
  
  fs.writeFileSync(filePath, file.buffer);
  
  return `/uploads/branches/${branchId.toString()}/${filename}`;
};

exports.createBranch = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'gst_number'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate data formats
    const validationErrors = validateBranchData(req.body);
    if (validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate email or GST number
    const existingBranch = await Branch.findOne({
      $or: [
        { email: req.body.email.toLowerCase() },
        { gst_number: req.body.gst_number.toUpperCase() }
      ]
    });

    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch with this email or GST number already exists'
      });
    }

    // Create the branch
    const branchData = {
      name: req.body.name,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      phone: req.body.phone,
      email: req.body.email.toLowerCase(),
      gst_number: req.body.gst_number.toUpperCase(),
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      createdBy: req.user.id
    };

    const branch = await Branch.create(branchData);
    
    // Handle logo uploads if files are present
    if (req.files) {
      const updates = {};
      if (req.files.logo1) {
        updates.logo1 = handleFileUpload(req.files.logo1[0], branch._id, 1);
      }
      if (req.files.logo2) {
        updates.logo2 = handleFileUpload(req.files.logo2[0], branch._id, 2);
      }
      
      if (Object.keys(updates).length > 0) {
        await Branch.findByIdAndUpdate(branch._id, updates);
        Object.assign(branch, updates);
      }
    }
    
    // Log the creation
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Branch',
      entityId: branch._id,
      user: req.user.id,
      ip: req.ip,
      metadata: branchData,
      status: 'SUCCESS'
    });
    
    res.status(201).json({
      success: true,
      data: branch
    });
  } catch (err) {
    console.error('Error creating branch:', err);
    
    let message = 'Error creating branch';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    } else if (err.code === 11000) {
      message = 'Duplicate value entered for unique field';
    }
    
    // Log failed attempt
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Branch',
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    }).catch(logErr => console.error('Failed to create audit log:', logErr));
    
    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Remove the is_active filter to get all branches
    const query = {};
    
    // Optional filter by status if provided
    if (req.query.status) {
      query.is_active = req.query.status === 'active';
    }

    const [branches, total] = await Promise.all([
      Branch.find(query)
        .skip(skip)
        .limit(limit)
        .populate('createdByDetails', 'name email mobile'),
      Branch.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: branches.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: branches
    });
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching branches',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('createdByDetails', 'name email mobile');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (err) {
    console.error('Error fetching branch:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching branch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    // Validate data formats if provided
    const validationErrors = validateBranchData(req.body);
    if (validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    const updates = { ...req.body };
    
    // Format email and GST if provided
    if (updates.email) updates.email = updates.email.toLowerCase();
    if (updates.gst_number) updates.gst_number = updates.gst_number.toUpperCase();
    
    // Handle logo uploads if files are present
    if (req.files) {
      if (req.files.logo1) {
        updates.logo1 = handleFileUpload(req.files.logo1[0], req.params.id, 1);
      }
      if (req.files.logo2) {
        updates.logo2 = handleFileUpload(req.files.logo2[0], req.params.id, 2);
      }
    }
    
    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).populate('createdByDetails', 'name email mobile');
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Branch',
      entityId: branch._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: 'SUCCESS'
    });
    
    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (err) {
    console.error('Error updating branch:', err);
    
    let message = 'Error updating branch';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    } else if (err.code === 11000) {
      message = 'Duplicate value entered for unique field';
    }
    
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Branch',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });
    
    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateBranchStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    
    // Validate the request body
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. is_active must be a boolean value'
      });
    }

    // Find the branch
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // No change needed if status is already as requested
    if (branch.is_active === is_active) {
      return res.status(200).json({
        success: true,
        message: `Branch is already ${is_active ? 'active' : 'inactive'}`,
        data: branch
      });
    }

    // Update the branch status
    branch.is_active = is_active;
    await branch.save();

    // Handle user statuses based on branch status
    if (!is_active) {
      // Deactivate all users when branch is deactivated
      await User.updateMany(
        { branch: branch._id },
        { $set: { isActive: false } }
      );
    }

    // Log the status change
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Branch',
      entityId: branch._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        action: 'STATUS_CHANGE',
        previousStatus: !is_active,
        newStatus: is_active,
        affectedUsers: is_active ? null : await User.countDocuments({ branch: branch._id })
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: `Branch ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: branch
    });
  } catch (err) {
    console.error('Error updating branch status:', err);

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Branch',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message,
      metadata: req.body
    }).catch(logErr => console.error('Failed to create audit log:', logErr));

    res.status(500).json({
      success: false,
      message: 'Error updating branch status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    // First check if branch exists
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check for any users assigned to this branch (active or inactive)
    const usersCount = await User.countDocuments({ branch: req.params.id });
    if (usersCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch with assigned users (active or inactive)'
      });
    }

    // Delete associated logo files if they exist
    const uploadDir = path.join(__dirname, '../public/uploads/branches', req.params.id.toString());
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    // Perform the actual deletion
    await Branch.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'DELETE',
      entity: 'Branch',
      entityId: req.params.id,
      user: req.user.id,
      ip: req.ip,
      metadata: { deletedBranch: branch },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: { message: 'Branch deleted permanently' }
    });
  } catch (err) {
    console.error('Error deleting branch:', err);

    await AuditLog.create({
      action: 'DELETE',
      entity: 'Branch',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message,
      metadata: req.body
    }).catch(logErr => console.error('Failed to create audit log:', logErr));

    res.status(500).json({
      success: false,
      message: 'Error deleting branch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};