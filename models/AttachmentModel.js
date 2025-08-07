const mongoose = require('mongoose');
const validator = require('validator');
const path = require('path');
const fs = require('fs');

const attachmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  attachments: [{
    type: {
      type: String,
      required: [true, 'Attachment type is required'],
      enum: {
        values: ['image', 'video', 'youtube', 'document', 'text'],
        message: 'Invalid attachment type'
      }
    },
    url: {
      type: String,
      validate: {
        validator: function(v) {
          if (this.type === 'youtube') {
            return validator.isURL(v, { protocols: ['http','https'], require_protocol: true });
          }
          return true;
        },
        message: 'Invalid URL format'
      }
    },
    content: {
      type: String,
      required: function() {
        return this.type === 'text';
      },
      maxlength: [1000, 'Text content cannot exceed 1000 characters']
    },
    thumbnail: String
  }],
  isForAllModels: {
    type: Boolean,
    default: true
  },
  applicableModels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    validate: {
      validator: function(v) {
        return !this.isForAllModels || v.length === 0;
      },
      message: 'Cannot specify models when isForAllModels is true'
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

attachmentSchema.index({ title: 'text' });
attachmentSchema.index({ isForAllModels: 1 });
attachmentSchema.index({ applicableModels: 1 });
attachmentSchema.index({ createdBy: 1 });

attachmentSchema.pre('validate', function(next) {
  if (this.attachments.length === 0) {
    this.invalidate('attachments', 'At least one attachment is required');
  }
  next();
});

attachmentSchema.pre('remove', async function(next) {
  try {
    this.attachments.forEach(item => {
      if (item.url && !item.url.startsWith('http')) {
        const filePath = path.join(__dirname, '../public', item.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Attachment', attachmentSchema);