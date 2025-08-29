// controllers/commissionRangeController.js
const CommissionRangeMaster = require('../models/CommissionRangeMaster');
const AuditLog = require('../models/AuditLog');

exports.createCommissionRange = async (req, res) => {
  try {
    const { minAmount, maxAmount, isActive } = req.body;
    const userId = req.user.id;

    // Check for overlapping ranges
    const overlappingRange = await CommissionRangeMaster.findOne({
      $or: [
        { 
          minAmount: { $lte: minAmount }, 
          maxAmount: { $gte: minAmount },
          isActive: true 
        },
        { 
          minAmount: { $lte: maxAmount || Number.MAX_SAFE_INTEGER }, 
          maxAmount: { $gte: maxAmount || Number.MAX_SAFE_INTEGER },
          isActive: true 
        }
      ]
    });

    if (overlappingRange && isActive !== false) {
      return res.status(400).json({
        success: false,
        message: 'Commission range overlaps with existing active range'
      });
    }

    const commissionRange = await CommissionRangeMaster.create({
      minAmount,
      maxAmount: maxAmount || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userId
    });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'CommissionRange',
      entityId: commissionRange._id,
      user: userId,
      ip: req.ip,
      metadata: {
        minAmount,
        maxAmount
      }
    });

    res.status(201).json({
      success: true,
      data: commissionRange
    });
  } catch (err) {
    console.error('Error creating commission range:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error creating commission range'
    });
  }
};

exports.getAllCommissionRanges = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const commissionRanges = await CommissionRangeMaster.find(filter)
      .populate({
        path: 'createdBy',
        select: 'name email'
      })
      .sort({ minAmount: 1 });

    res.status(200).json({
      success: true,
      data: commissionRanges
    });
  } catch (err) {
    console.error('Error fetching commission ranges:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching commission ranges'
    });
  }
};

exports.updateCommissionRange = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    if (updates.minAmount !== undefined || updates.maxAmount !== undefined) {
      // Check for overlapping ranges excluding current range
      const currentRange = await CommissionRangeMaster.findById(id);
      const minAmount = updates.minAmount !== undefined ? updates.minAmount : currentRange.minAmount;
      const maxAmount = updates.maxAmount !== undefined ? updates.maxAmount : currentRange.maxAmount;

      const overlappingRange = await CommissionRangeMaster.findOne({
        _id: { $ne: id },
        $or: [
          { 
            minAmount: { $lte: minAmount }, 
            maxAmount: { $gte: minAmount },
            isActive: true 
          },
          { 
            minAmount: { $lte: maxAmount || Number.MAX_SAFE_INTEGER }, 
            maxAmount: { $gte: maxAmount || Number.MAX_SAFE_INTEGER },
            isActive: true 
          }
        ]
      });

      if (overlappingRange && (updates.isActive === undefined || updates.isActive !== false)) {
        return res.status(400).json({
          success: false,
          message: 'Commission range overlaps with existing active range'
        });
      }
    }
    const commissionRange = await CommissionRangeMaster.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    if (!commissionRange) {
      return res.status(404).json({
        success: false,
        message: 'Commission range not found'
      });
    }
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'CommissionRange',
      entityId: id,
      user: userId,
      ip: req.ip,
      metadata: updates
    });

    res.status(200).json({
      success: true,
      data: commissionRange
    });
  } catch (err) {
    console.error('Error updating commission range:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error updating commission range'
    });
  }
};

exports.deleteCommissionRange = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const commissionRange = await CommissionRangeMaster.findByIdAndDelete(id);

    if (!commissionRange) {
      return res.status(404).json({
        success: false,
        message: 'Commission range not found'
      });
    }

    await AuditLog.create({
      action: 'DELETE',
      entity: 'CommissionRange',
      entityId: id,
      user: userId,
      ip: req.ip,
      metadata: {
        minAmount: commissionRange.minAmount,
        maxAmount: commissionRange.maxAmount
      }
    });

    res.status(200).json({
      success: true,
      message: 'Commission range deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting commission range:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error deleting commission range'
    });
  }
};