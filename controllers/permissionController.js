const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');

exports.createPermission = async (req, res) => {
  try {
    const { name, description, module, action } = req.body;
    
    if (!name || !module || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, module and action are required' 
      });
    }
    
    const existingPermission = await Permission.findOne({ name });
    if (existingPermission) {
      return res.status(409).json({ 
        success: false, 
        message: 'Permission already exists' 
      });
    }
    
    const permission = await Permission.create({
      name,
      description,
      module,
      action,
      createdBy: req.user.id
    });
    
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Permission',
      entityId: permission._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { name, module, action }
    });
    
    res.status(201).json({ 
      success: true, 
      data: permission 
    });
  } catch (err) {
    console.error('Error creating permission:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating permission' 
    });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({ is_active: true });
    res.status(200).json({ 
      success: true, 
      data: permissions 
    });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching permissions' 
    });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const permission = await Permission.findByIdAndUpdate(id, updates, { 
      new: true,
      runValidators: true 
    });
    
    if (!permission) {
      return res.status(404).json({ 
        success: false, 
        message: 'Permission not found' 
      });
    }
    
    await AuditLog.create({
      action: 'UPDATE',
      entity: 'Permission',
      entityId: permission._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates
    });
    
    res.status(200).json({ 
      success: true, 
      data: permission 
    });
  } catch (err) {
    console.error('Error updating permission:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating permission' 
    });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    const permission = await Permission.findByIdAndUpdate(id, { 
      is_active: false 
    }, { new: true });
    
    if (!permission) {
      return res.status(404).json({ 
        success: false, 
        message: 'Permission not found' 
      });
    }
    
    await AuditLog.create({
      action: 'DELETE',
      entity: 'Permission',
      entityId: permission._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { name: permission.name }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Permission deactivated successfully' 
    });
  } catch (err) {
    console.error('Error deleting permission:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting permission' 
    });
  }
};