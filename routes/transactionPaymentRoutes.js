const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/VerifyToken");
const { createWithdrawal, getAllWithdrawals, sendWithdrawalOTP, getWithdrawalsRefundInvoice, getWithdrawalInvoice, verifyWithdrawalOTP, processPayout, getUserWithdrawals } = require("../controllers/transaction-payment/withdrawalController");

router.post("/withdrawals", verifyToken, createWithdrawal);
router.post("/send-otp", sendWithdrawalOTP);
router.post("/verify-otp-code", verifyWithdrawalOTP);
router.get("/get-withdrawals", getAllWithdrawals);
router.post('/withdrawals/:id/payout', processPayout);
router.get("/get-user-withdrawals", verifyToken, getUserWithdrawals);
router.get("/get-refund-and-withdrawals", verifyToken, getWithdrawalsRefundInvoice);
router.get("/withdrawals/invoice/:transId", verifyToken, getWithdrawalInvoice);

module.exports = router;