const mongoose = require('mongoose');
const logger = require('../config/logger');

const AuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
       enum: [
      'CREATE', 'READ', 'UPDATE', 'DELETE',
      'LOGIN', 'LOGOUT', 'REGISTER', 
      'ASSIGN', 'REVOKE', 'CREATE_BROKER',
      'UPDATE_BROKER', 'REMOVE_BROKER',
      'ADD_BRANCH', 'UPDATE_BRANCH', 'REMOVE_BRANCH','ASSIGN_PERMISSIONS',"UPDATE_STATUS",'CREATE_USER','DELETE_BROKER','SUBMIT_KYC','SUBMIT_FINANCE_LETTER','VERIFY_KYC','UNAUTHORIZED_ACCESS_ATTEMPT','KYC_SUBMISSION_FAILED','KYC_SUBMITTED','KYC_VERIFICATION_FAILED'
      ,'FINANCE_LETTER_SUBMISSION_FAILED','FINANCE_LETTER_SUBMITTED','FINANCE_LETTER_VERIFICATION_FAILED','FINANCE_LETTER_VERIFIED','FINANCE_LETTER_RESUBMITTED','KYC_RESUBMITTED','APPROVE','UNFREEZE_USER','EXTEND_DEADLINE','VIEW_UPDATE_FORM','ASSIGNED','PENDING','ALLOCATE','ALLOCATE_CHASSIS'
    ]
  },
  entity: {
    type: String,
    required: true,
    entity: {
    type: String,
    required: true,
    enum: [
      'User', 'Role', 'Permission', 'IP', 
      'Auth', 'System', 'RTO', 'Broker',
      'Branch', 'Employee'
    ]
  },
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  ip: {
    type: String,
    required: true
  },
  userAgent: String,
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'SUCCESS'
  },
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
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
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

AuditLogSchema.virtual('userDetails', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile' }
});

AuditLogSchema.virtual('targetUserDetails', {
  ref: 'User',
  localField: 'targetUser',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name email mobile' }
});

AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ entity: 1 });
AuditLogSchema.index({ entityId: 1 });
AuditLogSchema.index({ user: 1 });
AuditLogSchema.index({ targetUser: 1 });
AuditLogSchema.index({ status: 1 });
AuditLogSchema.index({ timestamp: -1 });

AuditLogSchema.pre('save', function(next) {
  if (!this.user && !this.entityId) {
    const err = new Error('Audit log requires either user or entityId');
    logger.error(err.message);
    return next(err);
  }
  next();
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);