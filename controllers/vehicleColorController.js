const VehicleColor = require('../models/VehicleColor');
const VehicleModel = require('../models/VehicleModel');
const AuditLog = require('../models/AuditLog');
const { generateColorId } = require('../utils/idGenerator');

exports.createColor = async (req, res) => {
  try {
    const { color_name, model_id } = req.body;
    
    // Check if model exists
    const model = await VehicleModel.findById(model_id);
    if (!model) {
      return res.status(404).json({ 
        success: false, 
        message: 'Model not found' 
      });
    }
    
    // Check if color already exists for this model
    const existingColor = await VehicleColor.findOne({ 
      color_name: { $regex: new RegExp(`^${color_name}$`, 'i') },
      model_id 
    });
    
    if (existingColor) {
      return res.status(400).json({ 
        success: false, 
        message: 'Color with same name already exists for this model' 
      });
    }
    
    // Generate color ID
    const color_id = await generateColorId(model.model_id, color_name);
    
    const color = await VehicleColor.create({ 
      color_id,
      ...req.body,
      createdBy: req.user.id
    });
    
    res.status(201).json({ 
      success: true, 
      data: color 
    });
  } catch (err) {
    console.error('Error creating vehicle color:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating vehicle color' 
    });
  }
};

exports.getAllColors = async (req, res) => {
  try {
    const colors = await VehicleColor.find()
      .populate('modelDetails', 'model_name manufacturer variant')
      .sort({ color_name: 1 });
      
    res.status(200).json({ 
      success: true, 
      data: colors 
    });
  } catch (err) {
    console.error('Error fetching vehicle colors:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle colors' 
    });
  }
};

exports.getColorsByModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    const colors = await VehicleColor.find({ model_id: modelId })
      .populate('modelDetails', 'model_name manufacturer variant')
      .sort({ color_name: 1 });
      
    res.status(200).json({ 
      success: true, 
      data: colors 
    });
  } catch (err) {
    console.error('Error fetching vehicle colors by model:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle colors by model' 
    });
  }
};

exports.updateColor = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent updating certain fields
    const updates = req.body;
    delete updates.color_id;
    delete updates.model_id;
    delete updates.createdBy;
    
    const color = await VehicleColor.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    
    if (!color) {
      return res.status(404).json({ 
        success: false, 
        message: 'Color not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: color 
    });
  } catch (err) {
    console.error('Error updating vehicle color:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating vehicle color' 
    });
  }
};

exports.deleteColor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const color = await VehicleColor.findByIdAndDelete(id);
    
    if (!color) {
      return res.status(404).json({ 
        success: false, 
        message: 'Color not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: {} 
    });
  } catch (err) {
    console.error('Error deleting vehicle color:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting vehicle color' 
    });
  }
};