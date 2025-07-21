module.exports = function(req, res, next) {
  console.log('Test middleware working');
  next();
};