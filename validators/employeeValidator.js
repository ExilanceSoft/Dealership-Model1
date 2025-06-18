const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

exports.createEmployeeValidator = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters'),
  
  body('branch')
    .notEmpty().withMessage('Branch is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid branch ID'),
  
  body('role')
    .notEmpty().withMessage('Role is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid role ID'),
  
  body('contact_info.phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number format'),
  
  body('contact_info.email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  
  body('address.street')
    .trim()
    .notEmpty().withMessage('Street address is required'),
  
  body('address.city')
    .trim()
    .notEmpty().withMessage('City is required'),
  
  body('address.state')
    .trim()
    .notEmpty().withMessage('State is required'),
  
  body('address.pincode')
    .trim()
    .notEmpty().withMessage('Pincode is required')
    .matches(/^[1-9][0-9]{5}$/).withMessage('Invalid pincode format'),
  
  body('joining_date')
    .optional()
    .isISO8601().withMessage('Invalid date format (YYYY-MM-DD)')
    .toDate(),
  
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).withMessage('Invalid status')
];

exports.updateEmployeeValidator = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid employee ID'),
  
  body('full_name')
    .optional()
    .trim()
    .notEmpty().withMessage('Full name cannot be empty')
    .isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters'),
  
  body('branch')
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid branch ID'),
  
  body('role')
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid role ID'),
  
  body('contact_info.phone')
    .optional()
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number format'),
  
  body('contact_info.email')
    .optional()
    .isEmail().withMessage('Invalid email format'),
  
  body('address.street')
    .optional()
    .trim()
    .notEmpty().withMessage('Street address cannot be empty'),
  
  body('address.city')
    .optional()
    .trim()
    .notEmpty().withMessage('City cannot be empty'),
  
  body('address.state')
    .optional()
    .trim()
    .notEmpty().withMessage('State cannot be empty'),
  
  body('address.pincode')
    .optional()
    .trim()
    .matches(/^[1-9][0-9]{5}$/).withMessage('Invalid pincode format'),
  
  body('joining_date')
    .optional()
    .isISO8601().withMessage('Invalid date format (YYYY-MM-DD)')
    .toDate(),
  
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).withMessage('Invalid status')
];