const Broker = require('../models/Broker');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const BrokerLedger = require('../models/BrokerLedger');
const { generateOTP, sendOTPSMS } = require('../utils/otpService');
const CommissionRangeMaster = require('../models/CommissionRangeMaster');

// In brokerController.js - update validateBranchData function
const validateBranchData = async (branchData) => {
  if (!branchData.branch) {
    throw new Error('Branch reference is required');
  }

  if (!branchData.commissionConfigurations || !Array.isArray(branchData.commissionConfigurations)) {
    throw new Error('Commission configurations array is required');
  }

  if (branchData.commissionConfigurations.length === 0) {
    throw new Error('At least one commission configuration is required');
  }

  const seenTypes = new Set();
  
  for (const config of branchData.commissionConfigurations) {
    if (!config.commissionType) {
      throw new Error('Commission type is required for each configuration');
    }

    if (seenTypes.has(config.commissionType)) {
      throw new Error(`Duplicate commission type: ${config.commissionType} for the same branch`);
    }
    seenTypes.add(config.commissionType);

    if (config.commissionType === 'FIXED') {
      if (config.commissionRanges && config.commissionRanges.length > 0) {
        throw new Error('Cannot set commission ranges for FIXED type');
      }
      if (config.fixedCommission === undefined || config.fixedCommission === null) {
        throw new Error('Fixed commission is required for FIXED type');
      }
      if (config.fixedCommission < 0) {
        throw new Error('Fixed commission cannot be negative');
      }
    } else if (config.commissionType === 'VARIABLE') {
      if (config.fixedCommission !== undefined && config.fixedCommission !== null) {
        throw new Error('Cannot set fixed commission for VARIABLE type');
      }
      if (!config.commissionRanges || !Array.isArray(config.commissionRanges) || config.commissionRanges.length === 0) {
        throw new Error('Commission ranges are required for VARIABLE type');
      }
      
      const seenRanges = new Set();
      
      for (const rangeData of config.commissionRanges) {
        if (!rangeData.commissionRangeMaster) {
          throw new Error('Commission range master reference is required for each range');
        }
        
        // Validate that the commission range master exists and is active
        const commissionRangeMaster = await CommissionRangeMaster.findById(rangeData.commissionRangeMaster);
        if (!commissionRangeMaster) {
          throw new Error(`Commission range master not found: ${rangeData.commissionRangeMaster}`);
        }
        if (!commissionRangeMaster.isActive) {
          throw new Error(`Commission range master is not active: ${rangeData.commissionRangeMaster}`);
        }
        
        if (rangeData.amount === undefined || rangeData.amount === null) {
          throw new Error('Commission amount is required for each range');
        }
        if (rangeData.amount < 0) {
          throw new Error('Commission amount cannot be negative');
        }
        
        const rangeKey = rangeData.commissionRangeMaster.toString();
        if (seenRanges.has(rangeKey)) {
          throw new Error(`Duplicate commission range master: ${rangeData.commissionRangeMaster}`);
        }
        seenRanges.add(rangeKey);
      }
    } else {
      throw new Error('Invalid commission type. Must be FIXED or VARIABLE');
    }
  }
};

const initializeLedger = async (brokerId, branchId, userId) => {
  try {
    return await BrokerLedger.findOneAndUpdate(
      { broker: brokerId, branch: branchId },
      {
        $setOnInsert: {
          broker: brokerId,
          branch: branchId,
          currentBalance: 0,
          onAccount: 0,
          createdBy: userId,
          transactions: []
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
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
      try {
        await validateBranchData(branchData); // Added await here
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError.message
        });
      }
    }

    // Check if all branches exist
    const branchIds = branchesData.map(b => b.branch);
    const existingBranches = await Branch.find({ _id: { $in: branchIds } });
    
    if (existingBranches.length !== branchIds.length) {
      const existingBranchIds = existingBranches.map(b => b._id.toString());
      const missingBranches = branchIds.filter(
        id => !existingBranchIds.includes(id.toString())
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
      // Check for existing branch associations to avoid duplicates
      const newBranchesData = [];
      
      for (const branchData of completeBranchesData) {
        const isAlreadyAssociated = broker.branches.some(
          b => b.branch.toString() === branchData.branch.toString()
        );
        
        if (!isAlreadyAssociated) {
          newBranchesData.push(branchData);
        } else {
          // Branch already exists, add new commission configurations
          const existingBranch = broker.branches.find(
            b => b.branch.toString() === branchData.branch.toString()
          );
          
          // Check for duplicate commission types
          const newConfigs = branchData.commissionConfigurations.filter(
            newConfig => !existingBranch.commissionConfigurations.some(
              existingConfig => existingConfig.commissionType === newConfig.commissionType
            )
          );
          
          if (newConfigs.length > 0) {
            existingBranch.commissionConfigurations.push(...newConfigs);
            broker.markModified('branches');
          }
        }
      }
      
      if (newBranchesData.length === 0) {
        // Check if any new commission configurations were added to existing branches
        const hasNewConfigs = broker.branches.some(branch => 
          branch.commissionConfigurations.length > 0
        );
        
        if (!hasNewConfigs) {
          // All branches already associated with this broker and no new configs
          const branchNames = await Branch.find({ 
            _id: { $in: branchIds } 
          }).select('name');
          
          return res.status(400).json({
            success: false,
            message: `Broker already associated with all specified branches: ${branchNames.map(b => b.name).join(', ')}`
          });
        }
      }

      // Add only the new branches that aren't already associated
      if (newBranchesData.length > 0) {
        broker.branches.push(...newBranchesData);
      }
      
      broker = await broker.save();
      
      // Initialize ledger only for NEW branches
      for (const branchData of newBranchesData) {
        await initializeLedger(broker._id, branchData.branch, userId);
      }
      
      await AuditLog.create({
        action: 'ADD_BRANCHES',
        entity: 'Broker',
        entityId: broker._id,
        user: userId,
        ip: req.ip,
        metadata: {
          branches: newBranchesData.map(b => b.branch),
          action: 'added_branches',
          otp_required: broker.otp_required
        }
      });
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

      // Initialize ledger for each branch for the new broker
      for (const branchData of completeBranchesData) {
        await initializeLedger(broker._id, branchData.branch, userId);
      }
      
      await AuditLog.create({
        action: 'CREATE',
        entity: 'Broker',
        entityId: broker._id,
        user: userId,
        ip: req.ip,
        metadata: {
          branches: branchIds,
          action: 'created_broker',
          otp_required: broker.otp_required
        }
      });
    }

    // Populate the broker for response
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
        path: 'branches.commissionConfigurations.commissionRanges.commissionRangeMaster',
        select: 'minAmount maxAmount'
      })
      .populate({
        path: 'createdBy',
        select: 'name email'
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
        path: 'branches.commissionConfigurations.commissionRanges.commissionRangeMaster',
        select: 'minAmount maxAmount'
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
    })
    .populate({
      path: 'branches.branch',
      select: 'name code'
    })
    .populate({
      path: 'branches.addedBy',
      select: 'name email'
    })
    .populate({
      path: 'branches.commissionConfigurations.commissionRanges.commissionRangeMaster',
      select: 'minAmount maxAmount'
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
        path: 'branches.commissionConfigurations.commissionRanges.commissionRangeMaster',
        select: 'minAmount maxAmount'
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
      for (const branchData of branchesData) {
        try {
          await validateBranchData(branchData); // Added await here
        } catch (validationError) {
          return res.status(400).json({
            success: false,
            message: validationError.message
          });
        }
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
        path: 'branches.commissionConfigurations.commissionRanges.commissionRangeMaster',
        select: 'minAmount maxAmount'
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