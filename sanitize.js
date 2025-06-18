function sanitize(req, res, next) {
  try {
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const newObj = Array.isArray(obj) ? [] : {};
      
      for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Handle MongoDB operator sanitization
          if (/^\$/.test(key) || /\./.test(key)) {
            const newKey = key.replace(/^\$+/g, '').replace(/\./g, '_');
            newObj[newKey] = sanitizeValue(obj[key]);
          } else {
            newObj[key] = sanitizeValue(obj[key]);
          }
        }
      }
      return newObj;
    };

    const sanitizeValue = (value) => {
      if (typeof value === 'object' && value !== null) {
        return sanitizeObject(value);
      }
      return value;
    };

    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = sanitize;