const Withdrawal = require('../../models/transaction-&-payment/Withdrawal');
const { v4: uuidv4 } = require('uuid');
const { createWithdrawalOTPTemplate } = require('../../utils/Emails-template');
const { sendMail } = require('../../utils/Emails');
const { generateOTP } = require('../../utils/GenerateOtp');
const  User=require('../../models/User');
const otpStore = new Map();
const verifiedUsers = new Map(); 

// Create Withdrawal Request
exports.createWithdrawal = async (req, res) => {
  try {
    const { userId, amount, payment } = req.body;

    if (!userId || !amount || !payment || !payment.paymentMethod || !payment.method || !payment.details) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // ✅ Check OTP verified
    if (!verifiedUsers.get(userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'User has not verified OTP'
      });
    }
    verifiedUsers.delete(userId.toString());

    // ✅ Get the last withdrawal ID and generate next
    const lastWithdrawal = await Withdrawal.findOne().sort({ createdAt: -1 });

    let nextNumber = 1;
    if (lastWithdrawal && lastWithdrawal.withdrawalId) {
      const match = lastWithdrawal.withdrawalId.match(/#WITH(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const withdrawalId = `#WITH${String(nextNumber).padStart(4, '0')}`; // e.g. #WITH0001

    const newWithdrawal = new Withdrawal({
      withdrawalId,
      userId,
      amount,
      payment,
      status: 'pending',
    });

    await newWithdrawal.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request created successfully',
      withdrawalId,
    });

  } catch (error) {
    console.error('Create Withdrawal Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: error.message
    });
  }
};
exports.sendWithdrawalOTP = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(404).json({ success: false, message: 'User not found or email missing' });
    }

    const otp = generateOTP();
    otpStore.set(user.email, otp);

    const subject = 'Your Withdrawal OTP Code';
    const htmlBody = createWithdrawalOTPTemplate(otp);

    await sendMail(user.email, subject, htmlBody);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email address.',
    });

  } catch (error) {
    console.error('Send OTP Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error.message,
    });
  }
};
exports.verifyWithdrawalOTP = async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({
      success: false,
      message: 'User ID and OTP are required',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(404).json({
        success: false,
        message: 'User not found or email missing',
      });
    }

    const storedOtp = otpStore.get(user.email);

    if (!storedOtp || storedOtp !== otp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP code',
      });
    }

    otpStore.delete(user.email);
    verifiedUsers.set(userId.toString(), true); // ✅ Mark verified

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error('OTP Verification Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during OTP verification',
    });
  }
};

// get all withdrawal requests
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });

    const formattedWithdrawals = withdrawals.map((w) => {
      const obj = w.toObject();

      // Optionally mask/remove sensitive payment info
      if (obj.payment?.details) {
        delete obj.payment.details; // Remove full card details
      }

      // Reorder keys manually
      return {
        _id: obj._id,
        withdrawalId: obj.withdrawalId,
        userId: obj.userId,
        amount: obj.amount,
        payment: obj.payment,
        withdrawalCode: obj.withdrawalCode,
        status: obj.status,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        __v: obj.__v
      };
    });

    res.status(200).json({
      success: true,
      data: formattedWithdrawals
    });
  } catch (error) {
    console.error('Get All Withdrawals Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve withdrawals',
      error: error.message
    });
  }
};



