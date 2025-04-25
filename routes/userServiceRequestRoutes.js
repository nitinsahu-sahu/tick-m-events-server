const express = require("express")
const userServiceRequestController = require("../controllers/profile-service-management/userServiceRequestController")
const { verifyToken } = require("../middleware/VerifyToken")
const router = express.Router()

router
    .post('/', verifyToken, userServiceRequestController.createServiceRequest)
    .get('/', userServiceRequestController.getAllServiceRequests)
    .patch('/:id', userServiceRequestController.updateUserServiceRequest)
    .delete('/:id', userServiceRequestController.deleteServiceRequest)
module.exports = router