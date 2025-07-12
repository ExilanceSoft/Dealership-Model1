const Broker = require('../models/Broker');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

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
    const validRanges = ['20k-40k', '40k-60k', '60k-80k', '80k-100k', '100k+'];
    if (!validRanges.includes(branchData.commissionRange)) {
      throw new Error('Invalid commission range');
    }
  }
};

exports.createOrAddBroker = async (req, res) => {
  try {
    const { name, mobile, email, branchData } = req.body;
    const userId = req.user.id;

    validateBranchData(branchData);

    const branchExists = await Branch.exists({ _id: branchData.branch });
    if (!branchExists) {
      return res.status(400).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const completeBranchData = {
      ...branchData,
      addedBy: userId
    };

    let broker = await Broker.findOne({ $or: [{ mobile }, { email }] });

    if (broker) {
      const existingBranch = broker.branches.find(b => 
        b.branch.toString() === branchData.branch
      );
      
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'Broker already associated with this branch'
        });
      }

      broker.branches.push(completeBranchData);
      broker = await broker.save();
    } else {
      broker = await Broker.create({
        name,
        mobile,
        email,
        branches: [completeBranchData],
        createdBy: userId
      });
    }

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