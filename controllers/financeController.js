const FinanceProvider = require('../models/FinanceProvider');
const FinanceRate = require('../models/FinancerRate');

// Helper function to set update metadata
const setUpdateMetadata = (doc, userId) => {
  doc.updatedBy = userId;
  if (doc.isModified('is_active')) {
    doc.updatedBy = userId;
  }
};
// Finance Provider CRUD
exports.createProvider = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Provider name is required'
      });
    }

    const provider = await FinanceProvider.create({
      name,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: await FinanceProvider.findById(provider._id)
        .populate('createdByDetails', 'name email')
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Provider with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating provider'
    });
  }
};

exports.getProvider = async (req, res) => {
  try {
    const provider = await FinanceProvider.findById(req.params.id)
      .populate('createdByDetails updatedByDetails', 'name email');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    res.status(200).json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching provider'
    });
  }
};

exports.updateProvider = async (req, res) => {
  try {
    const { name, is_active } = req.body;
    
    const updates = {};
    if (name?.trim()) updates.name = name;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const provider = await FinanceProvider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    Object.assign(provider, updates);
    setUpdateMetadata(provider, req.user._id);
    await provider.save();

    res.status(200).json({
      success: true,
      data: await FinanceProvider.findById(provider._id)
        .populate('createdByDetails updatedByDetails', 'name email')
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Provider with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating provider'
    });
  }
};

exports.deleteProvider = async (req, res) => {
  try {
    const provider = await FinanceProvider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Check if provider has any rates (active or inactive)
    const ratesExist = await FinanceRate.exists({ financeProvider: provider._id });
    if (ratesExist) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete provider with existing rates'
      });
    }

    // Use deleteOne() instead of remove() as it's more modern
    await FinanceProvider.deleteOne({ _id: provider._id });
    
    res.status(200).json({ 
      success: true, 
      data: {},
      message: 'Provider deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting provider:', err); // Add logging
    res.status(500).json({
      success: false,
      message: 'Error deleting provider',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getProviders = async (req, res) => {
  try {
    const { active } = req.query;
    const query = {};
    
    if (active === 'true') query.is_active = true;
    if (active === 'false') query.is_active = false;

    const providers = await FinanceProvider.find(query)
      .populate('createdByDetails', 'name email')
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching providers'
    });
  }
};

// Finance Rate CRUD
exports.createRate = async (req, res) => {
  try {
    const { branchId, providerId, gcRate } = req.body;

    if (!branchId || !providerId || gcRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Branch, provider and GC rate are required'
      });
    }

    if (gcRate < 0 || gcRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'GC rate must be between 0 and 100'
      });
    }

    const rate = await FinanceRate.create({
      branch: branchId,
      financeProvider: providerId,
      gcRate,
      createdBy: req.user._id
    });

    const populatedRate = await FinanceRate.findById(rate._id)
      .populate('branchDetails', 'name city')
      .populate('financeProviderDetails', 'name')
      .populate('createdByDetails', 'name email');

    res.status(201).json({ success: true, data: populatedRate });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Rate already exists for this branch-provider combination'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating rate'
    });
  }
};

exports.getRate = async (req, res) => {
  try {
    const rate = await FinanceRate.findById(req.params.id)
      .populate('branchDetails', 'name city')
      .populate('financeProviderDetails', 'name')
      .populate('createdByDetails updatedByDetails', 'name email');

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    res.status(200).json({ success: true, data: rate });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching rate'
    });
  }
};

exports.updateRate = async (req, res) => {
  try {
    const { gcRate, is_active } = req.body;

    const updates = {};
    if (gcRate !== undefined) updates.gcRate = gcRate;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const rate = await FinanceRate.findById(req.params.id);
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    if (gcRate !== undefined && (gcRate < 0 || gcRate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'GC rate must be between 0 and 100'
      });
    }

    Object.assign(rate, updates);
    setUpdateMetadata(rate, req.user._id);
    await rate.save();

    const populatedRate = await FinanceRate.findById(rate._id)
      .populate('branchDetails', 'name city')
      .populate('financeProviderDetails', 'name')
      .populate('createdByDetails updatedByDetails', 'name email');

    res.status(200).json({ success: true, data: populatedRate });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error updating rate'
    });
  }
};

exports.deleteRate = async (req, res) => {
  try {
    const rate = await FinanceRate.findByIdAndDelete(req.params.id);
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error deleting rate'
    });
  }
};

exports.getBranchRates = async (req, res) => {
  try {
    const { active } = req.query;
    const query = { branch: req.params.branchId };
    
    if (active === 'true') query.is_active = true;
    if (active === 'false') query.is_active = false;

    const rates = await FinanceRate.find(query)
      .populate('financeProviderDetails', 'name')
      .populate('branchDetails', 'name city')
      .populate('createdByDetails', 'name email');

    res.status(200).json({ success: true, data: rates });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching rates'
    });
  }
};

exports.getAllRates = async (req, res) => {
  try {
    const { active, branchId, providerId } = req.query;
    const query = {};
    
    // Add filters if provided
    if (active === 'true') query.is_active = true;
    if (active === 'false') query.is_active = false;
    if (branchId) query.branch = branchId;
    if (providerId) query.financeProvider = providerId;

    const rates = await FinanceRate.find(query)
      .populate({
        path: 'branchDetails',
        select: 'name address city'
      })
      .populate({
        path: 'financeProviderDetails',
        select: 'name'
      })
      .populate({
        path: 'createdByDetails',
        select: 'name email'
      })
      .populate({
        path: 'updatedByDetails',
        select: 'name email'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      data: rates 
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching rates',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getProviderWithRates = async (req, res) => {
  try {
    const providerId = req.params.id;

    // Get provider details
    const provider = await FinanceProvider.findById(providerId)
      .populate('createdByDetails updatedByDetails', 'name email');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get all rates for this provider
    const rates = await FinanceRate.find({ financeProvider: providerId })
      .populate('branchDetails', 'name city')
      .populate('createdByDetails updatedByDetails', 'name email');

    // Combine the results
    const result = {
      provider: provider.toObject(),
      rates: rates
    };

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching provider with rates'
    });
  }
};