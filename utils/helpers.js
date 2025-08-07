exports.sanitizeQueryParams = (param) => {
  if (!param) return '';
  return param.toString().replace(/[^\w\s-]/gi, '');
};

exports.handleCastError = (err, res) => {
  return res.status(400).json({
    success: false,
    message: `Invalid ${err.path}: ${err.value}`
  });
};

exports.handleDuplicateKeyError = (err, res) => {
  const field = Object.keys(err.keyValue)[0];
  return res.status(400).json({
    success: false,
    message: `${field} '${err.keyValue[field]}' already exists`
  });
};

exports.handleValidationError = (err, res) => {
  const messages = Object.values(err.errors).map(val => val.message);
  return res.status(400).json({
    success: false,
    message: `Validation error: ${messages.join(', ')}`
  });
};