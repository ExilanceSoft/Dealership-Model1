const generateTrackingNumber = () => {
  const prefix = 'TR-';
  const randomString = Math.random().toString(36).substr(2, 8).toUpperCase();
  return prefix + randomString;
};

module.exports = {
  generateTrackingNumber
};
