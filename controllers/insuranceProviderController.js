const InsuranceProvider = require('../models/InsuranceProvider');
const AuditLog = require('../models/AuditLog');

// Create Insurance Provider
exports.createInsuranceProvider = async (req, res) => {
  try {
    const { provider_name } = req.body;

    if (!provider_name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide provider name'
      });
    }

    const existingProvider = await InsuranceProvider.findOne({ 
      provider_name: { $regex: new RegExp(`^${provider_name}$`, 'i') }
    });

    if (existingProvider) {
      return res.status(400).json({
        success: false,
        message: 'Insurance provider with this name already exists'
      });
    }

    const provider = await InsuranceProvider.create({
      provider_name,
      createdBy: req.user.id
    });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'InsuranceProvider',
      entityId: provider._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { provider_name },
      status: 'SUCCESS'
    });

    res.status(201).json({
      success: true,
      data: provider
    });
  } catch (err) {
    console.error('Error creating insurance provider:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'CREATE',
      entity: 'InsuranceProvider',
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

// Get all Insurance Providers
exports.getInsuranceProviders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (req.query.status) {
      query.is_active = req.query.status === 'active';
    }
    if (req.query.search) {
      query.provider_name = { $regex: req.query.search, $options: 'i' };
    }

    const [providers, total] = await Promise.all([
      InsuranceProvider.find(query)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 }),
      InsuranceProvider.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: providers.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: providers
    });
  } catch (err) {
    console.error('Error fetching insurance providers:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get single Insurance Provider
exports.getInsuranceProvider = async (req, res) => {
  try {
    const provider = await InsuranceProvider.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    res.status(200).json({
      success: true,
      data: provider
    });
  } catch (err) {
    console.error('Error fetching insurance provider:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update Insurance Provider
exports.updateInsuranceProvider = async (req, res) => {
  try {
    const { provider_name } = req.body;

    if (!provider_name) {
      return res.status(400).json({
        success: false,
        message: 'Provider name is required'
      });
    }

    const existingProvider = await InsuranceProvider.findOne({ 
      provider_name: { $regex: new RegExp(`^${provider_name}$`, 'i') },
      _id: { $ne: req.params.id }
    });

    if (existingProvider) {
      return res.status(400).json({
        success: false,
        message: 'Insurance provider with this name already exists'
      });
    }

    const provider = await InsuranceProvider.findByIdAndUpdate(
      req.params.id,
      { provider_name },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'InsuranceProvider',
      entityId: provider._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { provider_name },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: provider
    });
  } catch (err) {
    console.error('Error updating insurance provider:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'InsuranceProvider',
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

// Update Insurance Provider status
exports.updateInsuranceProviderStatus = async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const provider = await InsuranceProvider.findByIdAndUpdate(
      req.params.id,
      { is_active },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'InsuranceProvider',
      entityId: provider._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { is_active },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: `Insurance provider ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: provider
    });
  } catch (err) {
    console.error('Error updating insurance provider status:', err);
    
    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'InsuranceProvider',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete Insurance Provider
exports.deleteInsuranceProvider = async (req, res) => {
  try {
    const provider = await InsuranceProvider.findByIdAndDelete(req.params.id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    await AuditLog.create({
      action: 'DELETE',
      entity: 'InsuranceProvider',
      entityId: provider._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { provider_name: provider.provider_name },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: { message: 'Insurance provider deleted successfully' }
    });
  } catch (err) {
    console.error('Error deleting insurance provider:', err);
    
    await AuditLog.create({
      action: 'DELETE',
      entity: 'InsuranceProvider',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      metadata: req.body,
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};