const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-adminsdk.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
} else {
    
  console.log('ℹ️ [Firebase Admin] Firebase Admin already initialized.');
}

try {
  const messaging = admin.messaging();
  if (typeof messaging.sendMulticast === 'function') {
    console.log('✅ [Firebase Admin] FCM sendMulticast is available.');
  } else {
    console.error('❌ [Firebase Admin] FCM sendMulticast is NOT available!');
  }
} catch (error) {
  console.error('🔥 [Firebase Admin] Error accessing messaging:', error);
}

module.exports = admin;

