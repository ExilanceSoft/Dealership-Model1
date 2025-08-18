const Broker = require('../models/Broker');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const BrokerLedger = require('../models/BrokerLedger');
const { generateOTP, sendOTPSMS } = require('../utils/otpService');

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

const initializeLedger = async (brokerId, userId) => {
  try {
    const existingLedger = await BrokerLedger.findOne({ broker: brokerId });
    if (!existingLedger) {
      return await BrokerLedger.create({
        broker: brokerId,
        currentBalance: 0,
        createdBy: userId
      });
    }
    return existingLedger;
  } catch (error) {
    console.error('Error initializing ledger:', error);
    throw error;
  }
};

exports.createOrAddBroker = async (req, res) => {
  try {
    const { name, mobile, email, branchesData, otp_required } = req.body;
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
        const branchNames = await Branch.find({ 
          _id: { $in: existingBranches.map(b => b.branch) } 
        }).select('name');
        
        return res.status(400).json({
          success: false,
          message: `Broker already associated with branches: ${branchNames.map(b => b.name).join(', ')}`
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
        createdBy: userId,
        otp_required: otp_required !== undefined ? otp_required : true
      });

      // Initialize ledger for the new broker
      await initializeLedger(broker._id, userId);
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
        action: broker.branches.length > branchesData.length ? 'added_branches' : 'created_broker',
        otp_required: broker.otp_required
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
    const { name, mobile, email, otp_required, branchesData } = req.body;
    const userId = req.user.id;

    if (!brokerId) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    // Find the broker first
    let broker = await Broker.findById(brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Update basic broker info
    const updateObj = {};
    if (name) updateObj.name = name;
    if (mobile) updateObj.mobile = mobile;
    if (email) updateObj.email = email;
    if (otp_required !== undefined) updateObj.otp_required = otp_required;

    // Handle branch updates if provided
    if (branchesData && Array.isArray(branchesData)) {
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

      // Prepare complete branches data
      const completeBranchesData = branchesData.map(branchData => ({
        ...branchData,
        addedBy: userId
      }));

      // Remove existing branches that are in the update list
      broker.branches = broker.branches.filter(
        b => !branchIds.includes(b.branch.toString())
      );

      // Add the updated branches
      broker.branches.push(...completeBranchesData);
    }

    // Save all changes
    broker.set(updateObj);
    broker = await broker.save();

    // Populate the updated broker for response
    broker = await Broker.findById(broker._id)
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

    await AuditLog.create({
      action: 'UPDATE_BROKER',
      entity: 'Broker',
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        updates: {
          name,
          mobile,
          email,
          otp_required,
          branchesUpdated: branchesData ? true : false
        }
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

exports.toggleBrokerOTPRequirement = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const userId = req.user.id;

    if (!brokerId) {
      return res.status(400).json({
        success: false,
        message: 'Broker ID is required'
      });
    }

    const broker = await Broker.findById(brokerId);
    
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Toggle the OTP requirement
    broker.otp_required = !broker.otp_required;
    await broker.save();

    await AuditLog.create({
      action: 'TOGGLE_OTP_REQUIREMENT',
      entity: 'Broker',
      entityId: broker._id,
      user: userId,
      ip: req.ip,
      metadata: {
        otp_required: broker.otp_required
      }
    });

    res.status(200).json({
      success: true,
      data: {
        otp_required: broker.otp_required
      },
      message: `OTP requirement ${broker.otp_required ? 'enabled' : 'disabled'} successfully`
    });
  } catch (err) {
    console.error('Error toggling broker OTP requirement:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error toggling OTP requirement'
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
        email: broker.email,
        otp_required: broker.otp_required
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

exports.sendBrokerOTP = async (req, res) => {
  try {
    const { brokerId } = req.params;
    const broker = await Broker.findById(brokerId);
    
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Check if OTP is required for this broker
    if (!broker.otp_required) {
      return res.status(200).json({
        success: true,
        message: 'OTP not required for this broker',
        otpRequired: false
      });
    }

    // If there's an existing OTP that hasn't expired, don't generate a new one
    const now = new Date();
    if (broker.otp && broker.otpExpiresAt && broker.otpExpiresAt > now) {
      return res.status(200).json({
        success: true,
        message: 'Existing OTP is still valid',
        otpRequired: true,
        expiresAt: broker.otpExpiresAt
      });
    }

    // Generate and store OTP at broker level
    const otp = generateOTP();
    broker.otp = otp;
    broker.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await broker.save();

    // Send OTP to broker's mobile
    await sendOTPSMS(broker.mobile, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent to broker successfully',
      otpRequired: true,
      expiresAt: broker.otpExpiresAt
    });
  } catch (err) {
    console.error('Error sending broker OTP:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error sending OTP to broker'
    });
  }
};
exports.verifyBrokerOTP = async (req, res) => {
  try {
    const { brokerId, otp } = req.body;
    const broker = await Broker.findById(brokerId);
    
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    // Check if OTP is required for this broker
    if (!broker.otp_required) {
      return res.status(200).json({
        success: true,
        message: 'OTP verification skipped - not required for this broker',
        verified: true
      });
    }

    // Check broker-level OTP
    const now = new Date();
    if (!broker.otp || 
        broker.otp !== otp || 
        !broker.otpExpiresAt || 
        broker.otpExpiresAt < now) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Don't clear OTP - let it expire naturally after 10 minutes
    // Just mark the verification in the exchange details if needed
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (err) {
    console.error('Error verifying broker OTP:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error verifying OTP'
    });
  }
};