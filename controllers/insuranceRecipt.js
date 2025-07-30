const Insurance = require('../models/InsuranceRecipt'); 

// Create new insurance
exports.createInsurance = async (req, res) => {
  try {
    const insurance = new Insurance(req.body);
    await insurance.save();

    res.status(201).json({
      success: true,
      message: 'Insurance record created successfully',
      data: insurance,
    });
  } catch (error) {
    console.error('Create Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get all insurance records
exports.getAllInsurance = async (req, res) => {
  try {
    const records = await Insurance.find();
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Fetch All Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get insurance by ID
exports.getInsuranceById = async (req, res) => {
  try {
    const insurance = await Insurance.findById(req.params.id);
    if (!insurance) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.status(200).json({ success: true, data: insurance });
  } catch (error) {
    console.error('Fetch by ID Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update insurance by ID
exports.updateInsurance = async (req, res) => {
  try {
    const updated = await Insurance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.status(200).json({ success: true, message: 'Updated successfully', data: updated });
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete insurance by ID
exports.deleteInsurance = async (req, res) => {
  try {
    const deleted = await Insurance.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
