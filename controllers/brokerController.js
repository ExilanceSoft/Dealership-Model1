const Broker = require('../models/Broker');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

// Helper function to validate branch data
const validateBranchData = (branchData) => {
  if (!branchData.branch) {
    throw new Error('Branch reference is required');
  }

  if (branchData.commissionType === 'FIXED') {
    if (branchData.minCommission !== undefined || branchData.maxCommission !== undefined) {
      throw new Error('Cannot set min/max commission for FIXED type');
    }
    if (branchData.fixedCommission === undefined) {
      throw new Error('Fixed commission is required for FIXED type');
    }
  } else if (branchData.commissionType === 'VARIABLE') {
    if (branchData.fixedCommission !== undefined) {
      throw new Error('Cannot set fixed commission for VARIABLE type');
    }
    if (branchData.minCommission === undefined || branchData.maxCommission === undefined) {
      throw new Error('Both min and max commission are required for VARIABLE type');
    }
    if (branchData.maxCommission < branchData.minCommission) {
      throw new Error(`Max commission (${branchData.maxCommission}) must be >= min commission (${branchData.minCommission})`);
    }
  }
};

exports.createOrAddBroker = async (req, res) => {
  try {
    const { name, mobile, email, branchData } = req.body;
    const userId = req.user.id;

    // Validate branch data
    validateBranchData(branchData);

    // Check if branch exists
    const branchExists = await Branch.exists({ _id: branchData.branch });
    if (!branchExists) {
      return res.status(400).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Prepare complete branch data
    const completeBranchData = {
      ...branchData,
      addedBy: userId
    };

    // Check if broker already exists
    let broker = await Broker.findOne({ $or: [{ mobile }, { email }] });

    if (broker) {
      // Check if already associated with this branch
      const existingBranch = broker.branches.find(b => 
        b.branch.toString() === branchData.branch
      );
      
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'Broker already associated with this branch'
        });
      }

      // Add new branch association
      broker.branches.push(completeBranchData);
      broker = await broker.save();
    } else {
      // Create new broker
      broker = await Broker.create({
        name,
        mobile,
        email,
        branches: [completeBranchData],
        createdBy: userId
      });
    }

    // Log the action
    await AuditLog.create({
      action: broker.branches.length > 1 ? 'ADD_BRANCH' : 'CREATE',
      entity: 'Broker',
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        branch: branchData.branch,
        commissionType: branchData.commissionType
      }
    });

    res.status(201).json({
      success: true,
      data: broker
    });
  } catch (err) {
    console.error('Error in createOrAddBroker:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error processing broker'
    });
  }
};

exports.getBrokersByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const brokers = await Broker.find({ 
      'branches.branch': branchId,
      'branches.isActive': true 
    }).populate({
      path: 'branches.branch',
      select: 'name code'
    }).populate({
      path: 'branches.addedBy',
      select: 'name email'
    });

    res.status(200).json({
      success: true,
      data: brokers
    });
  } catch (err) {
    console.error('Error fetching brokers by branch:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching brokers'
    });
  }
};

exports.updateBroker = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Validate input data
    if (!brokerId) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    // Prepare update object
    const updateObj = {};
    if (updates.name) updateObj.name = updates.name;
    if (updates.mobile) updateObj.mobile = updates.mobile;
    if (updates.email) updateObj.email = updates.email;

    // Find and update the broker
    const broker = await Broker.findByIdAndUpdate(
      brokerId,
      { $set: updateObj },
      {
        new: true,
        runValidators: true
      }
    ).populate({
      path: 'branches.branch',
      select: 'name code'
    }).populate({
      path: 'branches.addedBy',
      select: 'name email'
    }).populate({
      path: 'createdBy',
      select: 'name email'
    });

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Log the update with correct action and entity
    await AuditLog.create({
      action: 'UPDATE_BROKER',  // This must match your enum
      entity: 'Broker',         // This must match your enum
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        updates
      }
    });

    res.status(200).json({
      success: true,
      data: broker
    });
  } catch (err) {
    console.error('Error updating broker:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error updating broker'
    });
  }
};

exports.removeBrokerBranch = async (req, res) => {
  try {
    const { brokerId, branchId } = req.params;
    const userId = req.user.id;

    const broker = await Broker.findByIdAndUpdate(
      brokerId,
      {
        $pull: {
          branches: { branch: branchId }
        }
      },
      {
        new: true
      }
    );

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Log the removal
    await AuditLog.create({
      action: 'REMOVE_BRANCH',
      entity: 'Broker',
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        branch: branchId
      }
    });

    res.status(200).json({
      success: true,
      data: broker
    });
  } catch (err) {
    console.error('Error removing broker branch:', err);
    res.status(500).json({
      success: false,
      message: 'Error removing broker branch'
    });
  }
};

// Add this to brokerController.js after the other exports
exports.getAllBrokers = async (req, res) => {
  try {
    const { branch, isActive } = req.query;
    const user = req.user;
    
    // Build query object
    const query = {};
    
    // For non-SUPERADMIN users, filter by their accessible branches
    if (user.roles.includes('SUPERADMIN')) {
      // SUPERADMIN can see all brokers
      if (branch) {
        query['branches.branch'] = branch;
      }
    } else {
      // For other roles, get brokers only from their accessible branches
      // Assuming user.branches contains array of branch IDs the user has access to
      const accessibleBranches = user.branches || [];
      
      if (branch) {
        // Check if requested branch is in user's accessible branches
        if (!accessibleBranches.includes(branch)) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this branch'
          });
        }
        query['branches.branch'] = branch;
      } else {
        // If no branch specified, filter by all accessible branches
        query['branches.branch'] = { $in: accessibleBranches };
      }
    }
    
    // Add isActive filter if provided
    if (isActive !== undefined) {
      query['branches.isActive'] = isActive === 'true';
    }
    
    const brokers = await Broker.find(query)
      .populate({
        path: 'branches.branch',
        select: 'name code'
      })
      .populate({
        path: 'branches.addedBy',
        select: 'name email'
      })
      .populate({
        path: 'createdBy',
        select: 'name email'
      });
    
    res.status(200).json({
      success: true,
      count: brokers.length,
      data: brokers
    });
  } catch (err) {
    console.error('Error fetching brokers:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching brokers'
    });
  }
};
