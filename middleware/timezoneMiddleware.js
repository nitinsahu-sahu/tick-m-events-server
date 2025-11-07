const moment = require('moment-timezone');

module.exports = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    const convertDates = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(convertDates);
      } else if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
          if (obj[key] instanceof Date) {
            // 🧠 Log before and after conversion to verify it's working
            const original = obj[key];
            const converted = moment(original)
              .tz('Africa/Douala')
              .format('YYYY-MM-DD HH:mm:ss');
            
            newObj[key] = converted;
          } else {
            newObj[key] = convertDates(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    };

    const newData = convertDates(data);
    return originalJson.call(this, newData);
  };

  next();
};
