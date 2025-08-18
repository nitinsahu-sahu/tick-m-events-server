const express = require('express');
const router = express.Router();
const { verifyToken, verifyOrganizer } = require('../../middleware/VerifyToken');

const { postPlaceABid } = require('../../controllers/event-request/place-a-bid-controller');

router.route('/place-a-bid')
    .post(verifyToken, verifyOrganizer, postPlaceABid)


module.exports = router;