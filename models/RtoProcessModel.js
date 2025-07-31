const mongoose = require('mongoose');

const RtoProcessSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  },
  applicationNumber: {
    type: String,
    required: true,
    trim: true,
  },
  rtoStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  rtoPaperStatus: {
    type: String,
    enum: ['Not Submitted', 'Submitted'],
    default: 'Not Submitted',
  },
  rtoAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
  numberPlate: {
    type: String,
    trim: true,
    default: '',
  },
  receiptNumber: {
    type: String,
    trim: true,
    default: '',
  },
  rtoPendingTaxStatus: {
     type: Boolean,
    default: false,
  },
  hsrbOrdering: {
    type: Boolean,
    default: false,
  },
  hsrbInstallation: {
    type: Boolean,
    default: false,
  },
  rcConfirmation: {
    type: Boolean,
    default: false,
  },
  rtoNumber: {
    type: String,
    trim: true,
    default: '',
  },
  rtoDate: {
    type: Date,
    default: Date.now,
  },
  rtoProcess: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: String,
    required: true,
  },
  updatedBy: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('RtoProcess', RtoProcessSchema);
