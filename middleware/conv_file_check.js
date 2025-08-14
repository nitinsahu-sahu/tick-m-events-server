const multer = require('multer');

// Configure Multer to use memory storage
exports.uploadCov = multer({
    storage: multer.memoryStorage(), // Files will be in memory as Buffer
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
        files: 10 // Maximum 10 files per message
    }
});