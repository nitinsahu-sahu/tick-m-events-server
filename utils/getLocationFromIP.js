const axios = require('axios');

const getLocationFromIP = async (ip) => {
  if (!ip || ip === '::1') return 'localhost';

  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`);
    if (data.status === 'success') {
      return `${data.city}, ${data.regionName}, ${data.country}`;
    }
    return 'Unknown Location';
  } catch (err) {
    console.error('IP location fetch failed:', err.message);
    return 'Unknown Location';
  }
};

module.exports = getLocationFromIP;
