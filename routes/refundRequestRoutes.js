const express = require("express");
const { submitRefundRequest,getRefundsByUser,refundRequestCancel, downloadInvoice,refReqApproveDeny,getAdminForwardedRefunds } = require("../controllers/refund-managment/refundManagementController");
const { verifyToken } = require("../middleware/VerifyToken");
const router = express.Router();


router.route('/refund-request').post(verifyToken, submitRefundRequest);
router.route('/user/:userId').get(getRefundsByUser);
router.route('/cancel').patch(refundRequestCancel);
router.route('/invoice/:id').get(downloadInvoice);
router.route('/:id/action').put(refReqApproveDeny);
router.route('/').get(getAdminForwardedRefunds);



module.exports = router;