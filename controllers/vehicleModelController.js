const VehicleModel = require('../models/VehicleModel');
const AuditLog = require('../models/AuditLog');
const { generateModelId } = require('../utils/idGenerator');

exports.createModel = async (req, res) => {
  try {
    const { manufacturer, model_name, variant } = req.body;
    
    // Check if model already exists
    const existingModel = await VehicleModel.findOne({ 
      manufacturer, 
      model_name, 
      variant 
    });
    
    if (existingModel) {
      return res.status(400).json({ 
        success: false, 
        message: 'Model with same manufacturer, name and variant already exists' 
      });
    }
    
    // Generate model ID
    const model_id = await generateModelId(manufacturer, model_name);
    
    const model = await VehicleModel.create({ 
      model_id,
      ...req.body,
      createdBy: req.user.id
    });
    
    res.status(201).json({ 
      success: true, 
      data: model 
    });
  } catch (err) {
    console.error('Error creating vehicle model:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating vehicle model' 
    });
  }
};
exports.approveVehicles = async (req, res, next) => {
  try {
    const { vehicleIds } = req.body;

    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return next(new AppError('Please provide an array of vehicle IDs to approve', 400));
    }

    // Validate all IDs
    const invalidIds = vehicleIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return next(new AppError(`Invalid vehicle IDs: ${invalidIds.join(', ')}`, 400));
    }

    // Update all vehicles to in_stock status
    const result = await Vehicle.updateMany(
      { 
        _id: { $in: vehicleIds },
        status: 'not_approved' // Only approve vehicles that are not already approved
      },
      { 
        $set: { 
          status: 'in_stock',
          lastUpdatedBy: req.user.id 
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return next(new AppError('No vehicles were approved (either already approved or not found)', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        approvedCount: result.modifiedCount,
        message: `${result.modifiedCount} vehicle(s) approved successfully`
      }
    });

  } catch (err) {
    logger.error(`Error approving vehicles: ${err.message}`);
    next(new AppError('Server Error', 500));
  }
};
exports.getAllModels = async (req, res) => {
  try {
    const models = await VehicleModel.find()
      .sort({ manufacturer: 1, model_name: 1 });
      
    res.status(200).json({ 
      success: true, 
      data: models 
    });
  } catch (err) {
    console.error('Error fetching vehicle models:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle models' 
    });
  }
};

exports.getModelById = async (req, res) => {
  try {
    const model = await VehicleModel.findById(req.params.id);
    
    if (!model) {
      return res.status(404).json({ 
        success: false, 
        message: 'Model not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: model 
    });
  } catch (err) {
    console.error('Error fetching vehicle model:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vehicle model' 
    });
  }
};

exports.updateModel = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent updating certain fields
    const updates = req.body;
    delete updates.model_id;
    delete updates.createdBy;
    
    const model = await VehicleModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    
    if (!model) {
      return res.status(404).json({ 
        success: false, 
        message: 'Model not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: model 
    });
  } catch (err) {
    console.error('Error updating vehicle model:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating vehicle model' 
    });
  }
};

exports.deleteModel = async (req, res) => {
  try {
    const { id } = req.params;
    
    const model = await VehicleModel.findByIdAndDelete(id);
    
    if (!model) {
      return res.status(404).json({ 
        success: false, 
        message: 'Model not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: {} 
    });
  } catch (err) {
    console.error('Error deleting vehicle model:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting vehicle model' 
    });
  }
};