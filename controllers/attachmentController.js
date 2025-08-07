const Attachment = require('../models/AttachmentModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Quotation = require('../models/QuotationModel');
const axios = require('axios');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const validator = require('validator');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `attch-${uniqueSuffix}${ext}`);
  }
});

// File filter configuration
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'video/mp4', 
    'video/quicktime', 
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Only images, videos and documents are allowed.`, 400), false);
  }
};

// Initialize multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit per file
    files: 10 // Max 10 files
  }
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 3 },
  { name: 'documents', maxCount: 3 }
]);

exports.uploadAttachmentFile = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size too large. Maximum 25MB per file allowed.', 413));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new AppError('Too many files uploaded. Maximum 10 files allowed.', 413));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('Unexpected file field', 400));
      }
      return next(new AppError(err.message, 400));
    }
    next();
  });
};

exports.createAttachment = async (req, res, next) => {
  try {
    const { title, description, isForAllModels, applicableModels, youtubeUrls, textContents } = req.body;

    if (!title) {
      return next(new AppError('Title is required', 400));
    }

    const attachmentData = {
      title,
      description: description || '',
      isForAllModels: isForAllModels === 'true' || isForAllModels === true,
      createdBy: req.user._id,
      attachments: []
    };

    if (!attachmentData.isForAllModels && applicableModels) {
      try {
        attachmentData.applicableModels = JSON.parse(applicableModels);
      } catch (err) {
        return next(new AppError('Invalid applicableModels format. Must be a JSON array.', 400));
      }
    }

    const processFiles = (files, type) => {
      if (files) {
        files.forEach(file => {
          attachmentData.attachments.push({
            type,
            url: `/uploads/attachments/${file.filename}`,
            thumbnail: type === 'image' ? `/uploads/attachments/${file.filename}` : null
          });
        });
      }
    };

    processFiles(req.files?.images, 'image');
    processFiles(req.files?.videos, 'video');
    processFiles(req.files?.documents, 'document');

    if (youtubeUrls) {
      try {
        const urls = JSON.parse(youtubeUrls);
        urls.forEach(url => {
          if (url) {
            const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|youtu\.be\/)([^"&?\/\s]{11}))/i);
            attachmentData.attachments.push({
              type: 'youtube',
              url,
              thumbnail: videoId ? `https://img.youtube.com/vi/${videoId[1]}/0.jpg` : null
            });
          }
        });
      } catch (err) {
        return next(new AppError('Invalid youtubeUrls format. Must be a JSON array.', 400));
      }
    }

    if (textContents) {
      try {
        const texts = JSON.parse(textContents);
        texts.forEach(text => {
          if (text) {
            attachmentData.attachments.push({
              type: 'text',
              content: text
            });
          }
        });
      } catch (err) {
        return next(new AppError('Invalid textContents format. Must be a JSON array.', 400));
      }
    }

    const attachment = await Attachment.create(attachmentData);
    
    res.status(201).json({
      status: 'success',
      data: { attachment }
    });
  } catch (err) {
    logger.error(`Attachment creation failed: ${err.message}`);
    next(err);
  }
};

exports.getAllAttachments = async (req, res, next) => {
  try {
    const attachments = await Attachment.find()
      .populate('createdBy', 'name email')
      .populate('applicableModels', 'model_name');

    res.status(200).json({
      status: 'success',
      data: { attachments }
    });
  } catch (err) {
    logger.error(`Error getting attachments: ${err.message}`);
    next(err);
  }
};

exports.getAttachmentsForModel = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    
    const attachments = await Attachment.find({
      $or: [
        { isForAllModels: true },
        { applicableModels: modelId }
      ]
    }).populate('createdBy', 'name email');

    res.status(200).json({
      status: 'success',
      data: { attachments }
    });
  } catch (err) {
    logger.error(`Error getting attachments for model: ${err.message}`);
    next(err);
  }
};

exports.getAttachmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attachment = await Attachment.findById(id)
      .populate('createdBy', 'name email')
      .populate('applicableModels', 'model_name');

    if (!attachment) {
      return next(new AppError('Attachment not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { attachment }
    });
  } catch (err) {
    logger.error(`Error getting attachment: ${err.message}`);
    next(err);
  }
};

exports.updateAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, isForAllModels, applicableModels, youtubeUrls, textContents } = req.body;

    const existingAttachment = await Attachment.findById(id);
    if (!existingAttachment) {
      return next(new AppError('Attachment not found', 404));
    }

    const updateData = {
      title: title || existingAttachment.title,
      description: description || existingAttachment.description,
      isForAllModels: isForAllModels === 'true' || isForAllModels === true,
      attachments: [...existingAttachment.attachments]
    };

    if (!updateData.isForAllModels) {
      try {
        updateData.applicableModels = applicableModels ? JSON.parse(applicableModels) : [];
      } catch (err) {
        return next(new AppError('Invalid applicableModels format', 400));
      }
    } else {
      updateData.applicableModels = [];
    }

    const processFiles = (files, type) => {
      if (files) {
        files.forEach(file => {
          updateData.attachments.push({
            type,
            url: `/uploads/attachments/${file.filename}`
          });
        });
      }
    };

    processFiles(req.files?.images, 'image');
    processFiles(req.files?.videos, 'video');
    processFiles(req.files?.documents, 'document');

    if (youtubeUrls) {
      try {
        const parsedYoutubeUrls = JSON.parse(youtubeUrls);
        parsedYoutubeUrls.forEach(url => {
          if (url) {
            const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|youtu\.be\/)([^"&?\/\s]{11}))/i);
            updateData.attachments.push({
              type: 'youtube',
              url,
              thumbnail: videoId ? `https://img.youtube.com/vi/${videoId[1]}/0.jpg` : null
            });
          }
        });
      } catch (err) {
        return next(new AppError('Invalid youtubeUrls format', 400));
      }
    }

    if (textContents) {
      try {
        const parsedTextContents = JSON.parse(textContents);
        parsedTextContents.forEach(text => {
          if (text) {
            updateData.attachments.push({
              type: 'text',
              content: text
            });
          }
        });
      } catch (err) {
        return next(new AppError('Invalid textContents format', 400));
      }
    }

    const updatedAttachment = await Attachment.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: { attachment: updatedAttachment }
    });
  } catch (err) {
    logger.error(`Error updating attachment: ${err.message}`);
    next(err);
  }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attachment = await Attachment.findById(id);
    
    if (!attachment) {
      return next(new AppError('Attachment not found', 404));
    }

    attachment.attachments.forEach(item => {
      if (item.type !== 'youtube' && item.type !== 'text' && item.url) {
        const filePath = path.join(__dirname, '../public', item.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    await Attachment.findByIdAndDelete(id);
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting attachment: ${err.message}`);
    next(err);
  }
};

exports.generateWhatsAppLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return next(new AppError('Quotation ID is required', 400));
    }

    const quotation = await Quotation.findById(id)
      .populate('customer', 'mobile1 mobile2')
      .populate('models.model_id')
      .populate('attachments');

    if (!quotation) {
      return next(new AppError('Quotation not found', 404));
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    let pdfUrl = quotation.pdfUrl;
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      pdfUrl = pdfUrl.startsWith('/') ? pdfUrl.substring(1) : pdfUrl;
      pdfUrl = `${baseUrl}/${pdfUrl}`;
    }

    const modelIds = quotation.models.map(m => m.model_id?._id).filter(id => id);

    const attachments = await Attachment.find({
      $or: [
        { isForAllModels: true },
        { applicableModels: { $in: modelIds } }
      ]
    });

    const formattedAttachments = attachments.map(att => ({
      id: att._id,
      title: att.title,
      description: att.description,
      items: att.attachments.map(item => ({
        type: item.type,
        url: item.type === 'youtube' ? item.url : `${baseUrl}${item.url}`,
        content: item.content,
        thumbnail: item.thumbnail
      }))
    }));

    const whatsappNumbers = [];
    if (quotation.customer?.mobile1) {
      whatsappNumbers.push(quotation.customer.mobile1.replace(/\D/g, ''));
    }
    if (quotation.customer?.mobile2) {
      whatsappNumbers.push(quotation.customer.mobile2.replace(/\D/g, ''));
    }

    res.status(200).json({
      status: 'success',
      data: {
        pdfUrl: pdfUrl || null,
        attachments: formattedAttachments,
        numbers: whatsappNumbers.filter(n => n.length >= 10),
        quotationNumber: quotation.quotation_number
      }
    });
  } catch (err) {
    logger.error(`Error generating WhatsApp link: ${err.message}`);
    next(err);
  }
};

const formatWhatsAppMessage = (quotation, selectedAttachments = []) => {
  let message = `📄 *Quotation Details* 📄\n\n`;
  message += `🔹 *Quotation Number:* ${quotation.quotation_number}\n`;
  message += `🔹 *Customer:* ${quotation.customer?.name || 'N/A'}\n`;
  message += `🔹 *Date:* ${new Date(quotation.createdAt).toLocaleDateString()}\n\n`;
  
  if (quotation.pdfUrl) {
    message += `📎 *PDF Document:* ${quotation.pdfUrl}\n\n`;
  }

  if (selectedAttachments.length > 0 && quotation.attachments?.length > 0) {
    message += `📌 *Attachments:*\n`;
    quotation.attachments.forEach(attachment => {
      if (selectedAttachments.includes(attachment._id.toString())) {
        message += `\n🔸 *${attachment.title}*`;
        if (attachment.description) message += ` - ${attachment.description}\n`;
        
        attachment.attachments.forEach(item => {
          switch(item.type) {
            case 'image': message += `🖼️ ${item.url}\n`; break;
            case 'video': message += `🎬 ${item.url}\n`; break;
            case 'document': message += `📄 ${item.url}\n`; break;
            case 'youtube': message += `▶️ ${item.url}\n`; break;
            case 'text': message += `📝 ${item.content}\n`; break;
          }
        });
      }
    });
  }

  return message;
};

exports.shareOnWhatsApp = async (req, res, next) => {
  try {
    const { quotationId, phoneNumber, attachmentIds = [] } = req.body;

    if (!quotationId || !phoneNumber) {
      return next(new AppError('Quotation ID and phone number are required', 400));
    }

    const quotation = await Quotation.findById(quotationId)
      .populate('customer')
      .populate('attachments');

    if (!quotation) {
      return next(new AppError('Quotation not found', 404));
    }

    const formattedNumber = phoneNumber.replace(/\D/g, '');
    if (formattedNumber.length < 10) {
      return next(new AppError('Invalid phone number', 400));
    }
    const whatsappNumber = formattedNumber.startsWith('91') ? formattedNumber : `91${formattedNumber}`;

    const message = formatWhatsAppMessage(quotation, attachmentIds);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: whatsappNumber,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_BUSINESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`WhatsApp message sent to ${whatsappNumber} for quotation ${quotationId}`);

    res.status(200).json({
      status: 'success',
      data: {
        messageId: response.data.messages[0].id,
        timestamp: response.data.messages[0].timestamp
      }
    });
  } catch (err) {
    logger.error(`Error sending WhatsApp message: ${err.message}`);
    
    if (err.response) {
      return next(new AppError(
        `WhatsApp API error: ${err.response.data.error?.message || 'Failed to send message'}`,
        err.response.status
      ));
    }
    
    next(err);
  }
};