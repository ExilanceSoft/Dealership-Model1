const IpWhitelist = require('../models/IpWhitelist');

exports.addIP = async (req, res) => {
  try {
    const { ip, description } = req.body;
    
    // Check if IP exists
    const existingIP = await IpWhitelist.findOne({ ip });
    if (existingIP) {
      return res.status(400).json({ 
        success: false, 
        message: 'IP already whitelisted' 
      });
    }
    
    const whitelist = new IpWhitelist({
      ip,
      description,
      createdBy: req.user.id
    });
    
    await whitelist.save();
    res.status(201).json({ success: true, data: whitelist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getIPs = async (req, res) => {
  try {
    const ips = await IpWhitelist.find();
    res.status(200).json({ success: true, data: ips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeIP = async (req, res) => {
  try {
    const ip = await IpWhitelist.findByIdAndDelete(req.params.id);
    if (!ip) {
      return res.status(404).json({ 
        success: false, 
        message: 'IP not found' 
      });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};