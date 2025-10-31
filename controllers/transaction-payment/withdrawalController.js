const Withdrawal = require('../../models/transaction-&-payment/Withdrawal');
const { v4: uuidv4 } = require('uuid');
const { createWithdrawalOTPTemplate } = require('../../utils/Emails-template');
const { sendMail } = require('../../utils/Emails');
const { generateOTP } = require('../../utils/GenerateOtp');
const User = require('../../models/User');
const otpStore = new Map();
const verifiedUsers = new Map();
const axios = require('axios');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const Refund =require('../../models/refund-managment/RefundRequest');

// Create Withdrawal Request
exports.createWithdrawal = async (req, res) => {
  try {
    const { userId, amount, payment, eventId, balance } = req.body;

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
      eventId, balance,
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
    const withdrawals = await Withdrawal.find().sort({ createdAt: -1 }).populate('userId', 'name');

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
        userId: obj.userId?._id,
        user: obj.userId?.name || 'Unknown User',
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

exports.processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] processPayout called with id: ${id}`);

    // 1. Fetch withdrawal from DB
    const withdrawal = await Withdrawal.findById(id);
    console.log('[DEBUG] Withdrawal fetched from DB:', withdrawal);

    if (!withdrawal) {
      console.warn('[DEBUG] Withdrawal not found for id:', id);
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      console.warn('[DEBUG] Withdrawal is not pending. Current status:', withdrawal.status);
      return res.status(400).json({ success: false, message: 'Withdrawal is not pending' });
    }

    const user = await User.findById(withdrawal.userId).select("name email");
    const userName = user?.name || 'Unknown User';
    const userEmail = user?.email || 'noreply@example.com';
    const mobileNumber = withdrawal.payment?.details?.mobileNumber;
    const method = withdrawal.payment?.method;

    console.log('[DEBUG] Payment details:', { mobileNumber, method, userName });

    if (!mobileNumber || !method) {
      console.error('[DEBUG] Invalid payment details:', withdrawal.payment);
      return res.status(400).json({ success: false, message: 'Invalid payment details' });
    }

    const mapMedium = (method) => {
      if (!method) return 'mobile money';
      switch (method.toLowerCase()) {
        case 'mobile_money':
          return 'mobile money';
        case 'orange_money':
          return 'orange money';
        default:
          return method; // fallback if already in correct format
      }
    };

    const medium = mapMedium(withdrawal.payment?.paymentMethod);

    // 2. Send payout request to Fapshi
    console.log('[DEBUG] Sending payout request to Fapshi with data:', {
      amount: withdrawal.amount,
      phone: mobileNumber,
      medium,
      name: userName,
      email: userEmail,
      userId: withdrawal.userId,
      externalId: withdrawal.withdrawalId.replace(/[^a-zA-Z0-9]/g, ''), // removes #
      message: 'User Withdrawal Payout'
    });

    const response = await axios.post('https://sandbox.fapshi.com/payout', {
      amount: withdrawal.amount,
      phone: mobileNumber,
      medium,
      name: userName,
      email: 'noreply@example.com', // replace with actual email if available
      userId: withdrawal.userId,
      externalId: withdrawal.withdrawalId.replace(/[^a-zA-Z0-9]/g, ''), // removes #
      message: 'User Withdrawal Payout'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.FAPSHI_API_KEY,
        'apiuser': process.env.FAPSHI_API_USER
      }
    });

    console.log('[DEBUG] Fapshi API Response:', response.data);
    const { transId, dateInitiated } = response.data;
    // 3. If successful, update withdrawal status
    withdrawal.status = 'approved';
    withdrawal.transId = transId;
    withdrawal.dateInitiated = new Date(dateInitiated);
    await withdrawal.save();
    console.log('[DEBUG] Withdrawal updated to approved in DB.');

    res.status(200).json({
      success: true,
      message: 'Payout successful and withdrawal updated.',
      fapshiResponse: response.data
    });

  } catch (error) {
    console.error('Fapshi Payout Error:', error.message);

    let fapshiErrorMessage = 'Payout failed';

    if (error.response) {
      console.error('[DEBUG] Fapshi Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });

      // Try to extract the Fapshi message
      fapshiErrorMessage = error.response.data?.message ||
        error.response.data?.data?.message || // Some APIs wrap error in data.message
        'Payout failed';
    } else if (error.request) {
      console.error('[DEBUG] No response received from Fapshi:', error.request);
      fapshiErrorMessage = 'No response received from payout provider.';
    } else {
      console.error('[DEBUG] Error setting up Fapshi request:', error.message);
    }

    res.status(500).json({
      success: false,
      message: fapshiErrorMessage,
      error: error.message
    });
  }

}

exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name'); // to get user name

    const formattedWithdrawals = withdrawals.map((w) => {
      const obj = w.toObject();

      // Remove sensitive payment details if present
      if (obj.payment?.details) {
        delete obj.payment.details;
      }

      return {
        _id: obj._id,
        withdrawalId: obj.withdrawalId,
        eventId: obj.eventId,
        userId: obj.userId?._id,
        user: obj.userId?.name || 'Unknown User',
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
    console.error('Get User Withdrawals Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user withdrawals',
      error: error.message
    });
  }
};

exports.getWithdrawalsRefundInvoice = async (req, res) => {
  try {
    const userId = req.user?._id;
 
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
 
    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name'); // get user name
 
    const formattedWithdrawals = withdrawals.map((w) => {
      const obj = w.toObject();
 
      // Remove sensitive payment details
      if (obj.payment?.details) {
        delete obj.payment.details;
      }
 
      return {
        _id: obj._id,
        withdrawalId: obj.withdrawalId,
        userId: obj.userId?._id,
        eventId: obj.eventId,
        user: obj.userId?.name || 'Unknown User',
        amount: obj.amount,
        payment: obj.payment,
        status: obj.status,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        transId: obj.transId, // include transId for invoice download
      };
    });
 
    res.status(200).json({
      success: true,
      data: formattedWithdrawals,
    });
  } catch (error) {
    console.error('Get User Withdrawals Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user withdrawals',
      error: error.message,
    });
  }
};
 
exports.getWithdrawalInvoice = async (req, res) => {
  try {
    const { transId } = req.params;
 
    // Fetch withdrawal and populate user & event
    const withdrawal = await Withdrawal.findOne({ transId })
      .populate('userId', 'name email')
      .populate('eventId', 'eventName');
 
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
    if (withdrawal.status.toLowerCase() !== 'approved')
      return res.status(403).json({ message: 'Invoice can only be downloaded for approved withdrawals' });
 
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]); // Increased height for better layout
    const { width, height } = page.getSize();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
 
    // Colors
    const primaryColor = rgb(0.2, 0.4, 0.6); // Blue color for headers
    const secondaryColor = rgb(0.3, 0.3, 0.3); // Dark gray for text
    const accentColor = rgb(0.9, 0.9, 0.9); // Light gray for backgrounds
 
    // Header Section
    page.drawText('WITHDRAWAL INVOICE', {
      x: 50,
      y: height - 60,
      size: 24,
      font: boldFont,
      color: primaryColor,
    });
 
    // Company/Platform Info
    page.drawText('Tick-M-Event', {
      x: width - 200,
      y: height - 60,
      size: 14,
      font: boldFont,
      color: secondaryColor,
    });
 
    page.drawText('https://tick-m.cloud', {
      x: width - 200,
      y: height - 80,
      size: 10,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Invoice Details Section
    let currentY = height - 120;
 
    // Invoice header box
    page.drawRectangle({
      x: 50,
      y: currentY - 5,
      width: width - 100,
      height: 80,
      color: accentColor,
      opacity: 0.3,
    });
 
    // Invoice Number
    page.drawText('Invoice Number:', {
      x: 60,
      y: currentY,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(`INV-${withdrawal.transId}`, {
      x: 180,
      y: currentY,
      size: 12,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Invoice Date
    page.drawText('Invoice Date:', {
      x: 60,
      y: currentY - 25,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(new Date(withdrawal.dateInitiated).toLocaleDateString(), {
      x: 180,
      y: currentY - 25,
      size: 12,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Status
    page.drawText('Status:', {
      x: width - 200,
      y: currentY,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(withdrawal.status.toUpperCase(), {
      x: width - 120,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0.5, 0), // Green color for status
    });
 
    currentY -= 100;
 
    // User Information Section
    page.drawText('USER INFORMATION', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 30;
 
    const userInfo = [
      ['User Name', withdrawal.userId?.name || 'Unknown'],
      ['Email Address', withdrawal.userId?.email || 'N/A'],
      ['Event', withdrawal.eventId?.eventName || 'N/A'],
    ];
 
    userInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 60,
        y: currentY,
        size: 12,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(value, {
        x: 200,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
      currentY -= 25;
    });
 
    currentY -= 20;
 
    // Transaction Details Section
    page.drawText('TRANSACTION DETAILS', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 30;
 
    const transactionInfo = [
      ['Withdrawal ID', withdrawal.withdrawalId],
      ['Transaction ID', withdrawal.transId],
      ['Payment Method', `${withdrawal.payment.paymentMethod.toUpperCase()} (${withdrawal.payment.method})`],
    ];
 
    transactionInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 60,
        y: currentY,
        size: 12,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(value, {
        x: 200,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
      currentY -= 25;
    });
 
    currentY -= 30;
 
    // Amounts Section with table-like layout
    page.drawText('AMOUNT SUMMARY', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 40;
 
    // Table header background
    page.drawRectangle({
      x: 50,
      y: currentY,
      width: width - 100,
      height: 25,
      color: primaryColor,
      opacity: 0.8,
    });
 
    // Table headers
    page.drawText('Description', {
      x: 60,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1), // White text
    });
 
    page.drawText('Amount (XAF)', {
      x: width - 150,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1), // White text
    });
 
    currentY -= 30;
 
    // Amount rows with alternating background
    const amountData = [
      { description: 'Total Available Balance', amount: withdrawal.balance },
      { description: 'Withdrawal Amount', amount: -withdrawal.amount },
      { description: 'Remaining Balance', amount: withdrawal.balance - withdrawal.amount },
    ];
 
    amountData.forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: currentY - 5,
          width: width - 100,
          height: 30,
          color: accentColor,
          opacity: 0.2,
        });
      }
 
      page.drawText(item.description, {
        x: 60,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
 
      const amountText = `${item.amount.toLocaleString()} XAF`;
      page.drawText(amountText, {
        x: width - 150,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
 
      currentY -= 30;
    });
 
    currentY -= 40;
 
    // Total row
    page.drawRectangle({
      x: 50,
      y: currentY - 5,
      width: width - 100,
      height: 35,
      color: primaryColor,
      opacity: 0.3,
    });
 
    page.drawText('TOTAL WITHDRAWN:', {
      x: 60,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });
 
    page.drawText(`${withdrawal.amount.toLocaleString()} XAF`, {
      x: width - 150,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 60;
 
    // Footer Section
    page.drawText('Terms & Conditions:', {
      x: 50,
      y: currentY,
      size: 10,
      font: boldFont,
      color: secondaryColor,
    });
 
    page.drawText('This is an automated invoice for withdrawal transaction. Please contact support for any discrepancies.', {
      x: 50,
      y: currentY - 15,
      size: 8,
      font: regularFont,
      color: secondaryColor,
      maxWidth: width - 100,
      lineHeight: 10,
    });
 
    // Generated timestamp
    page.drawText(`Generated on: ${new Date().toLocaleString()}`, {
      x: 50,
      y: 30,
      size: 8,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });
 
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Withdrawal-Invoice-${withdrawal.transId}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ message: 'Failed to generate invoice', error: error.message });
  }
};

exports.getRefundRefundedData= async (req, res) => {
  try {
    const { eventId } = req.query; // pass eventId as query param
    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }
 
    const refunds = await Refund.find({ eventId, refundStatus: "refunded" })
      .sort({ createdAt: -1 })
      .populate("userId", "name email"); // optional: populate user info
 
    const formatted = refunds.map(r => ({
      _id: r._id,
      transId: r.transactionId,
      eventId: r.eventId,
      amount: r.refundAmount,
      payment: {
        paymentMethod: r.paymentMethod,
        method: r.paymentMethod, // optional
      },
      status: r.refundStatus,
      createdAt: r.createdAt,
    }));
 
    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching refunds:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRefundInvoice = async (req, res) => {
  try {
    const { transId } = req.params;
 
    // Find the refunded transaction with populated data
    const refund = await Refund.findOne({ transactionId: transId, refundStatus: "refunded" })
      .populate("userId", "name email")
      .populate("eventId", "eventName")
      .populate("orderId", "createdAt paymentMethod");
 
    if (!refund) {
      return res.status(404).json({ message: "Refund transaction not found or not refunded yet" });
    }
 
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]); // Same dimensions as withdrawal invoice
    const { width, height } = page.getSize();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
 
    // Colors - Same as withdrawal invoice
    const primaryColor = rgb(0.2, 0.4, 0.6); // Blue color for headers
    const secondaryColor = rgb(0.3, 0.3, 0.3); // Dark gray for text
    const accentColor = rgb(0.9, 0.9, 0.9); // Light gray for backgrounds
 
    // Header Section
    page.drawText('REFUND INVOICE', {
      x: 50,
      y: height - 60,
      size: 24,
      font: boldFont,
      color: primaryColor,
    });
 
    // Company/Platform Info
    page.drawText('Tick-M-Event', {
      x: width - 200,
      y: height - 60,
      size: 14,
      font: boldFont,
      color: secondaryColor,
    });
 
    page.drawText('https://tick-m.cloud', {
      x: width - 200,
      y: height - 80,
      size: 10,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Invoice Details Section
    let currentY = height - 120;
 
    // Invoice header box
    page.drawRectangle({
      x: 50,
      y: currentY - 5,
      width: width - 100,
      height: 80,
      color: accentColor,
      opacity: 0.3,
    });
 
    // Invoice Number
    page.drawText('Invoice Number:', {
      x: 60,
      y: currentY,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(`REF-INV-${refund.transactionId}`, {
      x: 180,
      y: currentY,
      size: 12,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Refund Date
    page.drawText('Refund Date:', {
      x: 60,
      y: currentY - 25,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(new Date(refund.updatedAt).toLocaleDateString(), {
      x: 180,
      y: currentY - 25,
      size: 12,
      font: regularFont,
      color: secondaryColor,
    });
 
    // Status
    page.drawText('Status:', {
      x: width - 200,
      y: currentY,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(refund.refundStatus.toUpperCase(), {
      x: width - 120,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0.5, 0), // Green color for status
    });
 
    // Refund Type
    page.drawText('Refund Type:', {
      x: width - 200,
      y: currentY - 25,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
    page.drawText(refund.refundType?.toUpperCase() || 'FULL', {
      x: width - 120,
      y: currentY - 25,
      size: 12,
      font: regularFont,
      color: secondaryColor,
    });
 
    currentY -= 100;
 
    // User Information Section
    page.drawText('USER INFORMATION', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 30;
 
    const userInfo = [
      ['User Name', refund.userId?.name || 'Unknown'],
      ['Email Address', refund.userId?.email || 'N/A'],
      ['Event', refund.eventId?.eventName || 'N/A'],
    ];
 
    userInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 60,
        y: currentY,
        size: 12,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(value, {
        x: 200,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
      currentY -= 25;
    });
 
    currentY -= 20;
 
    // Transaction Details Section
    page.drawText('TRANSACTION DETAILS', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 30;
 
    const transactionInfo = [
      ['Refund ID', refund.refundTransactionId],
      ['Original Order ID', refund.transactionId || 'N/A'],
      ['Payment Method', refund.paymentMethod?.toUpperCase() || 'N/A'],
    ];
 
    transactionInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 60,
        y: currentY,
        size: 12,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(value, {
        x: 200,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
      currentY -= 25;
    });
 
    // Refund Reason
    page.drawText('Refund Reason:', {
      x: 60,
      y: currentY,
      size: 12,
      font: boldFont,
      color: secondaryColor,
    });
   
    // Handle long reasons with text wrapping
    if (refund.reason && refund.reason.length > 50) {
      const lines = [];
      let currentLine = '';
      refund.reason.split(' ').forEach(word => {
        if ((currentLine + word).length > 50) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine += (currentLine ? ' ' : '') + word;
        }
      });
      lines.push(currentLine);
     
      lines.forEach((line, index) => {
        page.drawText(index === 0 ? line : line, {
          x: 200,
          y: currentY - (index * 15),
          size: 10,
          font: regularFont,
          color: secondaryColor,
        });
      });
      currentY -= (lines.length * 15);
    } else {
      page.drawText(refund.reason || 'N/A', {
        x: 200,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
      currentY -= 25;
    }
 
    currentY -= 20;
 
    // Tickets Refunded Section
    page.drawText('TICKETS REFUNDED', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 40;
 
    // Table header background
    page.drawRectangle({
      x: 50,
      y: currentY,
      width: width - 100,
      height: 25,
      color: primaryColor,
      opacity: 0.8,
    });
 
    // Table headers
    page.drawText('Ticket Type', {
      x: 60,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1), // White text
    });
 
    page.drawText('Qty', {
      x: width - 200,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
 
    page.drawText('Unit Price', {
      x: width - 150,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
 
    page.drawText('Total', {
      x: width - 80,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
 
    currentY -= 30;
 
    // Ticket rows with alternating background
    refund.tickets.forEach((ticket, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: currentY - 5,
          width: width - 100,
          height: 30,
          color: accentColor,
          opacity: 0.2,
        });
      }
 
      const unitPrice = ticket.unitPrice || ticket.price || 0;
      const quantity = ticket.quantity || 1;
      const ticketTotal = unitPrice * quantity;
 
      page.drawText(ticket.ticketType || 'General Ticket', {
        x: 60,
        y: currentY,
        size: 10,
        font: regularFont,
        color: secondaryColor,
      });
 
      page.drawText(quantity.toString(), {
        x: width - 200,
        y: currentY,
        size: 10,
        font: regularFont,
        color: secondaryColor,
      });
 
      page.drawText(`${unitPrice.toLocaleString()} XAF`, {
        x: width - 150,
        y: currentY,
        size: 10,
        font: regularFont,
        color: secondaryColor,
      });
 
      page.drawText(`${ticketTotal.toLocaleString()} XAF`, {
        x: width - 80,
        y: currentY,
        size: 10,
        font: regularFont,
        color: secondaryColor,
      });
 
      currentY -= 30;
    });
 
    currentY -= 30;
 
    // Amounts Section with table-like layout
    page.drawText('REFUND SUMMARY', {
      x: 50,
      y: currentY,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 40;
 
    // Table header background
    page.drawRectangle({
      x: 50,
      y: currentY,
      width: width - 100,
      height: 25,
      color: primaryColor,
      opacity: 0.8,
    });
 
    // Table headers
    page.drawText('Description', {
      x: 60,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1), // White text
    });
 
    page.drawText('Amount (XAF)', {
      x: width - 150,
      y: currentY + 7,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1), // White text
    });
 
    currentY -= 30;
 
    // Amount rows with alternating background
    const amountData = [
      { description: 'Original Order Total', amount: refund.totalAmount },
      { description: 'Refund Amount', amount: -refund.refundAmount },
      { description: 'Processing Fee', amount: refund.totalAmount - refund.refundAmount },
    ];
 
    amountData.forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: currentY - 5,
          width: width - 100,
          height: 30,
          color: accentColor,
          opacity: 0.2,
        });
      }
 
      page.drawText(item.description, {
        x: 60,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
 
      const amountText = item.amount >= 0 ?
        `${item.amount.toLocaleString()} XAF` :
        `-${Math.abs(item.amount).toLocaleString()} XAF`;
     
      page.drawText(amountText, {
        x: width - 150,
        y: currentY,
        size: 12,
        font: regularFont,
        color: secondaryColor,
      });
 
      currentY -= 30;
    });
 
    currentY -= 40;
 
    // Total row
    page.drawRectangle({
      x: 50,
      y: currentY - 5,
      width: width - 100,
      height: 35,
      color: primaryColor,
      opacity: 0.3,
    });
 
    page.drawText('TOTAL REFUNDED:', {
      x: 60,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });
 
    page.drawText(`${refund.refundAmount.toLocaleString()} XAF`, {
      x: width - 150,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });
 
    currentY -= 60;
 
    // Footer Section
    page.drawText('Terms & Conditions:', {
      x: 50,
      y: currentY,
      size: 10,
      font: boldFont,
      color: secondaryColor,
    });
 
    page.drawText('This is an automated invoice for refund transaction. The refund amount will be credited to your original payment method within 3-5 business days.', {
      x: 50,
      y: currentY - 15,
      size: 8,
      font: regularFont,
      color: secondaryColor,
      maxWidth: width - 100,
      lineHeight: 10,
    });
 
    // Generated timestamp
    page.drawText(`Generated on: ${new Date().toLocaleString()}`, {
      x: 50,
      y: 30,
      size: 8,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });
 
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Refund-Invoice-${refund.transactionId}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Refund invoice generation error:', error);
    res.status(500).json({ message: 'Failed to generate refund invoice', error: error.message });
  }
};
