const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  contact: {
    type: String,
    required: [true, 'Contact is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid mobile number!`
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch is required']
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtuals
EmployeeSchema.virtual('branchDetails', {
  ref: 'Branch',
  localField: 'branch',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name address city state' }
});

EmployeeSchema.virtual('roleDetails', {
  ref: 'Role',
  localField: 'role',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name description' }
});

// Indexes
EmployeeSchema.index({ name: 1 });
EmployeeSchema.index({ branch: 1 });
EmployeeSchema.index({ role: 1 });
EmployeeSchema.index({ email: 1 }, { unique: true });
EmployeeSchema.index({ contact: 1 }, { unique: true });

module.exports = mongoose.model('Employee', EmployeeSchema);