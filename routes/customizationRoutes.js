const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const { deleteCustomization, updateCustomization, getCustomization, createCustomization } = require('../controllers/event-details/customizationController');

router.route('/:eventId/customization')
    .post( upload.single('logo'), createCustomization)
    .get(getCustomization)
    .put( upload.single('logo'), updateCustomization)
    .delete( deleteCustomization);

module.exports = router;