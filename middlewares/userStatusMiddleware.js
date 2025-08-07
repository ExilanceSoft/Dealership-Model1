// middlewares/checkSalesExecutiveStatus.js
const Booking = require('../models/Booking');
const User = require('../models/User');

// 100% Confirm it's a function
module.exports = async function checkSalesExecutiveStatus(req, res, next) {
  try {
    const salesExecutiveId = req.body.sales_executive || req.user.id;
    const user = await User.findById(salesExecutiveId).populate('roles');

    if (!user) {
      return res.status(400).json({ error: "Sales Executive not found" });
    }

    const isSalesExecutive = user.roles.some(role => role.name === 'SALES_EXECUTIVE');
    if (!isSalesExecutive) return next();

    const cutoffTime = new Date(Date.now() - 2 * 60 * 1000); // 2 mins ago

    const oldPendingBooking = await Booking.findOne({
      salesExecutive: user._id,
      createdAt: { $lte: cutoffTime },
      $or: [
        { kycStatus: 'NOT_SUBMITTED' },
        { financeLetterStatus: 'NOT_SUBMITTED' }
      ]
    });

    if (oldPendingBooking) {
      if (user.status !== 'FROZEN') {
        user.status = 'FROZEN';
        await user.save();
      }
      return res.status(403).json({ error: "Sales Executive is frozen" });
    }

    if (user.status === 'FROZEN') {
      return res.status(403).json({ error: "Sales Executive is frozen" });
    }

    next(); 
  } catch (err) {
    console.error("[checkSalesExecutiveStatus] Error:", err);
    res.status(500).json({ error: "Server error in status check" });
  }
};