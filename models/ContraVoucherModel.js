const mongoose = require('mongoose');


const ContraVoucherSchema = new mongoose.Schema({
  voucherId: {
    type: String,
    unique: true,
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  voucherType: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  recipientName: {
    type: String,
    required: true,
    trim: true,
  },
  contraType: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMode: {
    type: String,
    enum: ['cash'],
    default: 'cash',
    required: true,
  },
  remark: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  bankLocation: {
    type: String,
    required: true,
    trim: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch is required']
  },
  bill_url: [{
    url: {
      type: String,
      required: true,
      trim: true
    },
  }]
}, {
  timestamps: true,
});


// Auto-generate voucherId before saving
ContraVoucherSchema.pre('save', async function (next) {
  if (!this.isNew) return next();


  try {
    const year = new Date().getFullYear();
    const Counter = mongoose.model('Counter');
   
    // Get or create counter for this year
    const counter = await Counter.findOneAndUpdate(
      { _id: `contraVoucher_${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );


    this.voucherId = `CONV-${year}-${String(counter.seq).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('ContraVoucher', ContraVoucherSchema);


