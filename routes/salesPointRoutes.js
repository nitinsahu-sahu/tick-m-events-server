const express = require('express');
const router = express.Router();
const {
  createSalesPoints,
  getSalesPoints,
  updateSalesPoints,
  deleteSalesPoints
} = require('../controllers/event-details/salesPointController');

router.route('/:eventId/sales-points')
  .post( createSalesPoints)
  .get(getSalesPoints)
  .put( updateSalesPoints)
  .delete( deleteSalesPoints);

module.exports = router;