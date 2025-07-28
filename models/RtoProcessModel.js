const mongoose = require("mongoose");

const RtoProcessSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  rtoId: {
    type: String,
    required: true,
    trim: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  chassisNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[A-Z0-9]{17}$/.test(v);
      },
      message: "Chassis number must be 17 alphanumeric characters",
    },
  },
  modelName: {
    type: String,
    required: true,
    trim: true,
  },
  bookingDate: {
    type: Date,
    required: true,
  },
  mobileNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: "Invalid mobile number",
    },
  },
  rtoStatus: {
    type: String,
    enum: ["Pending", "Completed", "Rejected", "In Progress"],
    default: "Pending",
  },
  contactNumber: {
    type: String,
    validate: {
      validator: function (v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: "Invalid contact number",
    },
  },
  rtoPaperStatus: {
    type: String,
    enum: ["Not Submitted", "Submitted", "Verified", "Rejected"],
    default: "Not Submitted",
  },
  rtoAmount: {
    type: Number,
    min: 0,
    required: true,
  },
  numberPlate: {
    type: String,
    trim: true,
  },
  receiptNumber: {
    type: String,
    trim: true,
  },
  rtoPendingTaxStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "N/A"],
    default: "N/A",
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
}, {
  timestamps: true,
});

module.exports = mongoose.model("RtoProcess", RtoProcessSchema);