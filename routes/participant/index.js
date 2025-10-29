const express = require('express');
const router = express.Router();
const { getOrderasPerEvent, getParticipantProfile,updateParticipantProfile } = require('../../controllers/participant/validation-at-entry');
const { verifyToken, verifyParticipant } = require('../../middleware/VerifyToken');

router.route('/entry-validation')
    .get(verifyToken, getOrderasPerEvent);

router.route('/profile')
    .get(verifyToken, verifyParticipant, getParticipantProfile);
router.route('/profile')
    .put(verifyToken, verifyParticipant, updateParticipantProfile);
module.exports = router;