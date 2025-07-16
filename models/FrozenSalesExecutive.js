// models/FrozenSalesExecutive.js
const mongoose = require('mongoose');

const FrozenSalesExecutiveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  frozenAt: {
    type: Date,
    default: Date.now
  },
  frozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  unfrozenAt: Date,
  unfrozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  unfrozenReason: String
}, {
  timestamps: true
});

module.exports = mongoose.model('FrozenSalesExecutive', FrozenSalesExecutiveSchema);