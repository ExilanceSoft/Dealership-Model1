const mongoose = require('mongoose');

const expenseAccountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Expense account name is required'],
    trim: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for createdBy details
expenseAccountSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email' }
});

// Update the updatedAt field before saving
expenseAccountSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const ExpenseAccount = mongoose.model('ExpenseAccount', expenseAccountSchema);

module.exports = ExpenseAccount;