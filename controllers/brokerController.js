const Broker = require('../models/Broker');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const BrokerLedger = require('../models/BrokerLedger');

const validateBranchData = (branchData) => {
  if (!branchData.branch) {
    throw new Error('Branch reference is required');
  }

  if (branchData.commissionType === 'FIXED') {
    if (branchData.commissionRange !== undefined) {
      throw new Error('Cannot set commission range for FIXED type');
    }
    if (branchData.fixedCommission === undefined) {
      throw new Error('Fixed commission is required for FIXED type');
    }
    if (branchData.fixedCommission < 0) {
      throw new Error('Fixed commission cannot be negative');
    }
  } else if (branchData.commissionType === 'VARIABLE') {
    if (branchData.fixedCommission !== undefined) {
      throw new Error('Cannot set fixed commission for VARIABLE type');
    }
    if (!branchData.commissionRange) {
      throw new Error('Commission range is required for VARIABLE type');
    }
    const validRanges = ['1-20000', '20001-40000', '40001-60000', '60001'];
    if (!validRanges.includes(branchData.commissionRange)) {
      throw new Error('Invalid commission range');
    }
  }
};

exports.createOrAddBroker = async (req, res) => {
  try {
    const { name, mobile, email, branchesData } = req.body;
    const userId = req.user.id;

    if (!branchesData || !Array.isArray(branchesData)) {
      return res.status(400).json({
        success: false,
        message: 'branchesData must be an array'
      });
    }

    // Validate all branch data
    for (const branchData of branchesData) {
      validateBranchData(branchData);
    }

    // Check if all branches exist
    const branchIds = branchesData.map(b => b.branch);
    const existingBranches = await Branch.find({ _id: { $in: branchIds } });
    
    if (existingBranches.length !== branchIds.length) {
      const missingBranches = branchIds.filter(
        id => !existingBranches.some(b => b._id.toString() === id)
      );
      return res.status(400).json({
        success: false,
        message: `Branches not found: ${missingBranches.join(', ')}`
      });
    }

    const completeBranchesData = branchesData.map(branchData => ({
      ...branchData,
      addedBy: userId
    }));

    let broker = await Broker.findOne({ $or: [{ mobile }, { email }] });

    if (broker) {
      // Check for existing branch associations
      const existingBranches = broker.branches.filter(b => 
        branchIds.includes(b.branch.toString())
      );
      
      if (existingBranches.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Broker already associated with branches: ${existingBranches.map(b => b.branch).join(', ')}`
        });
      }

      // Add all new branches
      broker.branches.push(...completeBranchesData);
      broker = await broker.save();
    } else {
      // Create new broker with all branches
      broker = await Broker.create({
        name,
        mobile,
        email,
        branches: completeBranchesData,
        createdBy: userId
      });

      // Initialize ledger for the new broker
      await BrokerLedger.create({
        broker: broker._id,
        totalAmount: 0,
        balanceAmount: 0,
        createdBy: userId
      });
    }

    // Log the action
    await AuditLog.create({
      action: broker.branches.length > branchesData.length ? 'ADD_BRANCHES' : 'CREATE',
      entity: 'Broker',
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        branches: branchIds,
        action: broker.branches.length > branchesData.length ? 'added_branches' : 'created_broker'
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

exports.getAllBrokers = async (req, res) => {
  try {
    const brokers = await Broker.find({})
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

exports.getBrokerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    const broker = await Broker.findById(id)
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

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    res.status(200).json({
      success: true,
      data: broker
    });
  } catch (err) {
    console.error('Error fetching broker by ID:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error fetching broker'
    });
  }
};

exports.updateBroker = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    if (!brokerId) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    const updateObj = {};
    if (updates.name) updateObj.name = updates.name;
    if (updates.mobile) updateObj.mobile = updates.mobile;
    if (updates.email) updateObj.email = updates.email;

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

    await AuditLog.create({
      action: 'UPDATE_BROKER',
      entity: 'Broker',
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

exports.deleteBroker = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    const broker = await Broker.findByIdAndDelete(id);

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    await AuditLog.create({
      action: 'DELETE_BROKER',
      entity: 'Broker',
      entityId: id,
      user: userId,
      ip: req.ip,
      metadata: {
        name: broker.name,
        mobile: broker.mobile,
        email: broker.email
      }
    });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Error deleting broker:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error deleting broker'
    });
  }
};