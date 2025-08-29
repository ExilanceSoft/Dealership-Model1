const BankSubPaymentMode = require('../models/BankSubPaymentMode');
const AuditLog = require('../models/AuditLog');

// Create Bank Sub Payment Mode
exports.createBankSubPaymentMode = async (req, res) => {
  try {
    const { payment_mode } = req.body;

    if (!payment_mode ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide payment mode'
      });
    }

    const existingPaymentMode = await BankSubPaymentMode.findOne({ 
      payment_mode: payment_mode.trim() 
    });
    
    if (existingPaymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Payment mode with this name already exists'
      });
    }

    const paymentMode = await BankSubPaymentMode.create({
      payment_mode: payment_mode.trim(),
      createdBy: req.user.id
    });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'BANK_SUB_PAYMENT_MODE',
      entityId: paymentMode._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        payment_mode: paymentMode.payment_mode
      },
      status: 'SUCCESS'
    });

    res.status(201).json({
      success: true,
      data: paymentMode
    });
  } catch (err) {
    console.error('Error creating payment mode:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'CREATE',
      entity: 'BANK_SUB_PAYMENT_MODE',
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

// Get all Bank Sub Payment Modes
exports.getBankSubPaymentModes = async (req, res) => {
  try {
    const query = {};
    
    // Filter by status if provided
    if (req.query.status) {
      query.is_active = req.query.status === 'active';
    }
    
    // Search functionality
    if (req.query.search) {
      query.$or = [
        { payment_mode: { $regex: req.query.search, $options: 'i' } },
        { payment_description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get all payment modes without pagination
    const paymentModes = await BankSubPaymentMode.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: paymentModes
    });
  } catch (err) {
    console.error('Error fetching payment modes:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get single Bank Sub Payment Mode
exports.getBankSubPaymentMode = async (req, res) => {
  try {
    const paymentMode = await BankSubPaymentMode.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!paymentMode) {
      return res.status(404).json({
        success: false,
        message: 'Payment mode not found'
      });
    }

    res.status(200).json({
      success: true,
      data: paymentMode
    });
  } catch (err) {
    console.error('Error fetching payment mode:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update Bank Sub Payment Mode
exports.updateBankSubPaymentMode = async (req, res) => {
  try {
    const { payment_mode } = req.body;
    const updates = {};

    if (payment_mode) updates.payment_mode = payment_mode.trim();

    if (updates.payment_mode) {
      const existingPaymentMode = await BankSubPaymentMode.findOne({ 
        payment_mode: updates.payment_mode,
        _id: { $ne: req.params.id }
      });
      
      if (existingPaymentMode) {
        return res.status(400).json({
          success: false,
          message: 'Payment mode with this name already exists'
        });
      }
    }

    const paymentMode = await BankSubPaymentMode.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!paymentMode) {
      return res.status(404).json({
        success: false,
        message: 'Payment mode not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'BANK_SUB_PAYMENT_MODE',
      entityId: paymentMode._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: paymentMode
    });
  } catch (err) {
    console.error('Error updating payment mode:', err);
    
    let message = 'Server error';
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    await AuditLog.create({
      action: 'UPDATE',
      entity: 'BANK_SUB_PAYMENT_MODE',
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

// Update Bank Sub Payment Mode status
exports.updateBankSubPaymentModeStatus = async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const paymentMode = await BankSubPaymentMode.findByIdAndUpdate(
      req.params.id,
      { is_active },
      { new: true }
    );

    if (!paymentMode) {
      return res.status(404).json({
        success: false,
        message: 'Payment mode not found'
      });
    }

    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'BANK_SUB_PAYMENT_MODE',
      entityId: paymentMode._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { is_active },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: `Payment mode ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: paymentMode
    });
  } catch (err) {
    console.error('Error updating payment mode status:', err);
    
    await AuditLog.create({
      action: 'UPDATE_STATUS',
      entity: 'BANK_SUB_PAYMENT_MODE',
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

// Delete Bank Sub Payment Mode
exports.deleteBankSubPaymentMode = async (req, res) => {
  try {
    const paymentMode = await BankSubPaymentMode.findByIdAndDelete(req.params.id);

    if (!paymentMode) {
      return res.status(404).json({
        success: false,
        message: 'Payment mode not found'
      });
    }

    await AuditLog.create({
      action: 'DELETE',
      entity: 'BANK_SUB_PAYMENT_MODE',
      entityId: paymentMode._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { 
        payment_mode: paymentMode.payment_mode
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: { message: 'Payment mode deleted successfully' }
    });
  } catch (err) {
    console.error('Error deleting payment mode:', err);
    
    await AuditLog.create({
      action: 'DELETE',
      entity: 'BANK_SUB_PAYMENT_MODE',
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