const ExpenseAccount = require('../models/expenseAccountModel');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Create a new expense account
exports.createExpenseAccount = async (req, res, next) => {
  try {
    const { name } = req.body;

    // Validate input
    if (!name) {
      return next(new AppError('Expense account name is required', 400));
    }

    const existingAccount = await ExpenseAccount.findOne({ name });
    if (existingAccount) {
      return next(new AppError('Expense account with this name already exists', 400));
    }

    const expenseAccount = await ExpenseAccount.create({
      name,
      createdBy: req.user.id 
    });


    const populatedAccount = await ExpenseAccount.findById(expenseAccount._id)
      .populate('createdByDetails', 'name email');


    res.status(201).json({
      status: 'success',
      data: {
        expenseAccount: populatedAccount
      }
    });
  } catch (err) {
    logger.error(`Error creating expense account: ${err.message}`);
    next(err);
  }
};


exports.getAllExpenseAccounts = async (req, res, next) => {
  try {
    const filter = {};
    
   
    if (req.query.status && ['active', 'inactive'].includes(req.query.status.toLowerCase())) {
      filter.status = req.query.status.toLowerCase();
    }
    

    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' }; // Case-insensitive search
    }

   
    const expenseAccounts = await ExpenseAccount.find(filter)
      .populate('createdByDetails', 'name email')
      .sort({ name: 1 }); 

  
    res.status(200).json({
      status: 'success',
      results: expenseAccounts.length,
      data: {
        expenseAccounts
      }
    });
  } catch (err) {
    logger.error(`Error getting expense accounts: ${err.message}`);
    next(err);
  }
};

// Get single expense account by ID
exports.getExpenseAccountById = async (req, res, next) => {
  try {
    const expenseAccount = await ExpenseAccount.findById(req.params.id)
      .populate('createdByDetails', 'name email');

    // Check if expense account exists
    if (!expenseAccount) {
      return next(new AppError('No expense account found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        expenseAccount
      }
    });
  } catch (err) {
    logger.error(`Error getting expense account: ${err.message}`);
    next(err);
  }
};

// Update an expense account
exports.updateExpenseAccount = async (req, res, next) => {
  try {
    const { name, status } = req.body;

    // Check if name is being updated and if it already exists
    if (name) {
      const existingAccount = await ExpenseAccount.findOne({ name, _id: { $ne: req.params.id } });
      if (existingAccount) {
        return next(new AppError('Expense account with this name already exists', 400));
      }
    }

    // Update expense account details
    const updatedExpenseAccount = await ExpenseAccount.findByIdAndUpdate(
      req.params.id,
      {
        name,
        status
      },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    )
    .populate('createdByDetails', 'name email');

    // Check if expense account exists
    if (!updatedExpenseAccount) {
      return next(new AppError('No expense account found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        expenseAccount: updatedExpenseAccount
      }
    });
  } catch (err) {
    logger.error(`Error updating expense account: ${err.message}`);
    next(err);
  }
};

// Update expense account status only
exports.updateExpenseAccountStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
      return next(new AppError('Status must be either "active" or "inactive"', 400));
    }

    // Update status
    const updatedExpenseAccount = await ExpenseAccount.findByIdAndUpdate(
      req.params.id,
      { status: status.toLowerCase() },
      {
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    // Check if expense account exists
    if (!updatedExpenseAccount) {
      return next(new AppError('No expense account found with that ID', 404));
    }

    // Return success response
    res.status(200).json({
      status: 'success',
      data: {
        expenseAccount: updatedExpenseAccount
      }
    });
  } catch (err) {
    logger.error(`Error updating expense account status: ${err.message}`);
    next(err);
  }
};

// Delete an expense account
exports.deleteExpenseAccount = async (req, res, next) => {
  try {
    const expenseAccount = await ExpenseAccount.findByIdAndDelete(req.params.id);

    // Check if expense account exists
    if (!expenseAccount) {
      return next(new AppError('No expense account found with that ID', 404));
    }

    // Return success response (no content)
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    logger.error(`Error deleting expense account: ${err.message}`);
    next(err);
  }
};