const express = require("express")
const serviceRequestController = require("../controllers/service-request/service-request-controller")
const { verifyToken } = require("../middleware/VerifyToken")
const router = express.Router()

router
    .post('/', verifyToken, serviceRequestController.createServiceRequest)
    .get('/userId', verifyToken, serviceRequestController.getServiceRequestsByUserId)
    .get('/', serviceRequestController.getAllServiceRequests)
    .get('/:id', serviceRequestController.getServiceRequestById)
    .patch('/:id', serviceRequestController.updateServiceRequest)
    .delete('/:id', serviceRequestController.deleteServiceRequest)
module.exports = router