const InwardVehicle = require('../models/VehicleInward');
const AuditLog = require('../models/AuditLog');
const QRCode = require('qrcode');

exports.createInward = async (req, res) => {
  try {
    const data = {
      ...req.body,
      purchase_invoice: req.file.path,
      createdBy: req.user.id
    };

    // For ICE vehicles, remove EV-specific fields
    if (data.fuel_type !== 'ELECTRIC') {
      delete data.battery_number;
      delete data.motor_number;
    }

    const inward = await InwardVehicle.create(data);
    
    res.status(201).json({ 
      success: true, 
      data: inward,
      qrCodeUrl: inward.qr_code 
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getAllInwards = async (req, res) => {
  try {
    const vehicles = await InwardVehicle.find()
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails');
    res.status(200).json({ success: true, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInwardsByBranch = async (req, res) => {
  try {
    const vehicles = await InwardVehicle.find({ branch_id: req.params.branchId })
      .populate('modelDetails')
      .populate('colorDetails');
    res.status(200).json({ success: true, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInwardById = async (req, res) => {
  try {
    const vehicle = await InwardVehicle.findById(req.params.id)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails');
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateInward = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
    delete updates.inward_id;
    delete updates.model_id;
    delete updates.color_id;
    delete updates.branch_id;
    delete updates.chassis_number;
    delete updates.createdBy;

    const vehicle = await InwardVehicle.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.reportDamage = async (req, res) => {
  try {
    const { id } = req.params;
    const { damage_description } = req.body;

    const vehicle = await InwardVehicle.findByIdAndUpdate(
      id,
      { 
        vehicle_status: 'DAMAGED',
        damage_description,
        is_damage_approved: false
      },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.approveDamage = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await InwardVehicle.findByIdAndUpdate(
      id,
      { 
        vehicle_status: 'GO_DOWN',
        is_damage_approved: true,
        approved_by: req.user.id
      },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteInward = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await InwardVehicle.findByIdAndDelete(id);
    
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVehicleByQR = async (req, res) => {
  try {
    const vehicle = await InwardVehicle.findOne({ chassis_number: req.params.chassisNumber })
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails');
    
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    
    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};