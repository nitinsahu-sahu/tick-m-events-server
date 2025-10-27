const Verification = require('../../models/profile-service-maagement/Verification');
const User = require('../../models/User');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { createEmailVerificationTemplate } = require('../../utils/Emails-template');
const { sendMail } = require('../../utils/Emails');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const mongoose = require("mongoose")

exports.sendEmailOtp = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Save OTP to verification record
        await Verification.findOneAndUpdate(
            { userId },
            { emailOtp: otp, emailOtpExpires: otpExpires },
            { upsert: true, new: true }
        );

        try {
            const emailHtml = await createEmailVerificationTemplate(otp, otpExpires, user.name);
            await sendMail(
                user.email,
                'Email Confirmation',
                emailHtml
            );
            res.status(200).json({
                success: true,
                message: 'OTP sent to your email'
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }


    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user._id;

        const verification = await Verification.findOne({ userId });

        if (!verification) {
            return res.status(400).json({ success: false, message: 'No verification record found' });
        }

        if (verification.emailOtp !== otp || verification.emailOtpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        verification.emailVerified = true;
        verification.emailOtp = undefined;
        verification.emailOtpExpires = undefined;
        await verification.save();

        res.status(200).json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
};

exports.getVerificationStatus = async (req, res) => {
    try {
        const userId = req.user._id;

        const verification = await Verification.findOne({ userId })
            .select('emailVerified whatsappVerified identityVerified paymentVerified identityDocuments.status')
            .lean();

        if (!verification) {
            return res.status(200).json({
                emailVerified: false,
                whatsappVerified: false,
                identityVerified: false,
                paymentVerified: false
            });
        }

        res.status(200).json({
            emailVerified: verification.emailVerified || false,
            whatsappVerified: verification.whatsappVerified || false,
            identityVerified: verification.identityVerified || false,
            paymentVerified: verification.paymentVerified || false,
            identityStatus: verification.identityDocuments?.[0]?.status || 'not-submitted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch verification status',
            error: error.message
        });
    }
};

exports.sendWhatsAppOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const userId = req.user._id;
        // Validate phone number
        if (!phoneNumber.match(/^\+\d{10,15}$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Use +1234567890'
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        // Save OTP to DB
        await Verification.findOneAndUpdate(
            { userId },
            { whatsappOtp: otp, whatsappOtpExpires: otpExpires, whatsappNumber: phoneNumber },
            { upsert: true, new: true }
        );

        const otpWhatsapp = await client.messages
            .create({
                from: `whatsapp:+14155238886`,
                contentSid: process.env.TWILIO_CONTENT_SID,
                contentVariables: JSON.stringify({ "1": otp }),
                to: `whatsapp:${phoneNumber}`
            })

        res.status(200).json({
            success: true,
            message: 'OTP sent to WhatsApp'
        });

    } catch (error) {
        console.error('Twilio Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP. Ensure your Twilio WhatsApp number is configured correctly.',
            error: error.message
        });
    }
};

exports.verifyWhatsAppOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user._id;

        const verification = await Verification.findOne({ userId });
        if (!verification) {
            return res.status(400).json({
                success: false,
                message: 'No verification record found'
            });
        }

        // Check if OTP matches and isn't expired
        if (verification.whatsappOtp !== otp || verification.whatsappOtpExpires < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Update verification status
        verification.whatsappVerified = true;
        verification.whatsappOtp = undefined;
        verification.whatsappOtpExpires = undefined;
        await verification.save();

        // Update user's phone number
        await User.findByIdAndUpdate(userId, {
            phoneNumber: verification.whatsappNumber
        });

        res.status(200).json({
            success: true,
            message: 'WhatsApp number verified successfully'
        });

    } catch (error) {
        console.error('WhatsApp verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify WhatsApp OTP',
            error: error.message
        });
    }
};

exports.verifyIdentity = async (req, res) => {
    const { identity } = req.files;
    const { type } = req.body;

    try {
        if (!identity) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user._id;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(identity.tempFilePath, {
            folder: 'identity_documents',
            resource_type: 'auto'
        });

        // Find existing verification record
        const verification = await Verification.findOne({ userId });

        // If no existing record, create new
        if (!verification) {
            const newVerification = await Verification.create({
                userId,
                identityDocuments: [{
                    type,
                    url: result.secure_url,
                    public_id: result.public_id,
                    status: 'pending'
                }]
            });

            return res.status(200).json({
                success: true,
                message: 'Identity document submitted for verification',
                data: newVerification
            });
        }

        // If existing record found
        if (verification.identityDocuments && verification.identityDocuments.length > 0) {
            // Delete previous file from Cloudinary if exists
            const previousDoc = verification.identityDocuments[0];
            if (previousDoc.public_id) {
                try {
                    await cloudinary.uploader.destroy(previousDoc.public_id);
                } catch (cloudinaryError) {
                    console.error('Error deleting old file from Cloudinary:', cloudinaryError);
                }
            }

            // Update existing document (first in array)
            verification.identityDocuments[0] = {
                type,
                url: result.secure_url,
                public_id: result.public_id,
                status: 'pending',
                uploadedAt: new Date()
            };
        } else {
            // Add new document if none existed
            verification.identityDocuments.push({
                url: result.secure_url,
                public_id: result.public_id,
                status: 'pending',
                type,
            });
        }

        // Reset verification status
        verification.identityVerified = false;
        await verification.save();

        res.status(200).json({
            success: true,
            message: 'Identity document resubmitted for verification',
            data: verification
        });

    } catch (error) {
        console.error('Identity verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload identity',
            error: error.message
        });
    }
};

// Admin endpoint to approve identity
exports.approveIdentity = async (req, res) => {
    try {
        const { userId } = req.params;

        // Start a transaction to ensure both updates succeed or fail together
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Update verification status
            const verification = await Verification.findOneAndUpdate(
                { userId },
                {
                    identityVerified: true,
                    $set: { 'identityDocuments.$[].status': 'approved' }
                },
                { new: true, session } // Include session in the operation
            );

            if (!verification) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: 'Verification record not found'
                });
            }

            // 2. Update user's isVerified status
            const user = await User.findByIdAndUpdate(
                userId,
                { isVerified: true },
                { new: true, session } // Include session in the operation
            );

            if (!user) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Commit the transaction if both operations succeeded
            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: 'Identity approved and user verification updated successfully',
                data: {
                    verification,
                    user
                }
            });

        } catch (error) {
            // If any error occurs, abort the transaction
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Approval failed',
            error: error.message
        });
    }
};

// Admin endpoint to reject identity
//get all kyc data
exports.getAllVerifications = async (req, res) => {
    try {
        const verifications = await Verification.find()
            .populate('userId', 'name email') // joins user info
            .lean();

        const formatted = verifications.map(v => ({
            _id: v._id,
            user: {
                _id: v.userId._id,
                name: v.userId.name,
                email: v.userId.email
            },
            emailVerified: v.emailVerified,
            whatsappVerified: v.whatsappVerified,
            whatsappNumber: v.whatsappNumber,
            identityVerified: v.identityVerified,
            paymentVerified: v.paymentVerified,
            identityDocuments: v.identityDocuments.map(doc => ({
                url: doc.url,
                public_id: doc.public_id,
                type: doc.type,
                status: doc.status,
                uploadedAt: doc.uploadedAt
            })),
            lastUpdated: v.lastUpdated,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        console.error('Failed to get verification records:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching verification data',
            error: error.message
        });
    }
};

exports.rejectIdentity = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const verification = await Verification.findOne({ userId });

        if (!verification) {
            return res.status(404).json({ success: false, message: 'Verification record not found' });
        }

        // Update all identity documents to rejected + set rejectionReason
        verification.identityDocuments.forEach((doc) => {
            doc.status = 'rejected';
            doc.rejectionReason = reason;
        });

        await verification.save();

        // TODO: Send notification to user about rejection with reason

        res.status(200).json({
            success: true,
            message: 'Identity rejected',
            data: verification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Rejection failed',
            error: error.message
        });
    }
};