const express = require('express')
const router = express.Router()
const authController = require("../controllers/Auth")
const { verifyToken } = require('../middleware/VerifyToken')
const { signupValidation, loginValidation } = require('../validators/authValidator')
const validate = require('../middleware/validateRequest')

router
    .post("/signup", authController.signup)
    .patch("/:id", authController.updateUser)
    .get("/profile/:id", authController.getUserProfile)
    .get("/users/:role", authController.getOrganizer)
    .post('/login', validate(loginValidation), authController.login)
    .post("/verify-otp", authController.verifyOtp)
    .post("/resend-otp", authController.resendOtp)
    .post("/forgot-password", authController.forgotPassword)
    .post("/reset-password", authController.resetPassword)
    .get("/check-auth", verifyToken, authController.checkAuth)
    .get('/logout', authController.logout)


module.exports = router