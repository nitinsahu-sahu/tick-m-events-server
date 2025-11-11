const { v4: uuidv4 } = require('uuid');
const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const TicketConfiguration = require('../../models/event-details/Ticket');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit'); // Required for proper font handling
const mongoose = require("mongoose");
const { sendMail } = require('../../utils/Emails');
const { createOrderEmailTemplate } = require('../../utils/Emails-template');
const QRCode = require('qrcode');
const TicketType = require("../../models/TicketType");
const CustomPhotoFrame = require('../../models/event-details/CustomPhotoFrame');
const RefundRequest = require("../../models/refund-managment/RefundRequest");
const User = require("../../models/User");
const axios = require("axios");
const RewardTransaction = require("../../models/RewardTrans");
const fs = require('fs');
const path = require('path');

// Get Validated tickets
exports.fetchUserValidatedTickets = async (req, res) => {
  try {

    if (!req.user._id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const tickets = await EventOrder.find({
      verifyEntry: true,  // Only validated tickets
      userId: req.user._id      // Filter by specific user
    })
      .sort({ createdAt: -1 })  // Newest first
      .populate({
        path: 'eventId',
        select: 'eventName date time location',  // Include event details
        model: 'Event'
      })
      .lean();

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No validated tickets found yet..'
      });
    }

    // Format response
    const formattedTickets = tickets.map(ticket => ({
      ticketId: ticket._id,
      event: {
        name: ticket.eventId?.eventName || 'N/A',
        date: ticket.eventId?.date || 'N/A',
        time: ticket.eventId?.time || 'N/A',
        venue: ticket.eventId?.location || 'N/A'
      },
      validatedAt: ticket.updatedAt // When verifyEntry was set to true
    }));

    res.status(200).json({
      success: true,
      count: formattedTickets.length,
      tickets: formattedTickets
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { eventId, orderAddress, tickets, totalAmount, paymentMethod, participantDetails, deviceUsed } = req.body;

    // Validation
    if (!eventId || !orderAddress || totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (Number(totalAmount) > 0 && !paymentMethod) {
      return res.status(400).json({ message: "Payment method is required for paid events" });
    }

    // Parse inputs
    const ticketList = JSON.parse(tickets);
    const parsedOrderAddress = typeof orderAddress === "string" ? JSON.parse(orderAddress) : orderAddress;
    const parsedParticipants = typeof participantDetails === "string" ? JSON.parse(participantDetails) : participantDetails;
    const userEmail = parsedOrderAddress.email;

    if (!Array.isArray(ticketList?.tickets) || ticketList.tickets.length === 0) {
      return res.status(400).json({ message: 'At least one ticket is required' });
    }

    // Generate unique IDs
    const uuidToNumeric = (uuid) => parseInt(uuid.replace(/\D/g, '').slice(0, 10), 10);
    const uuidToSixNumeric = (uuid) => parseInt(uuid.replace(/\D/g, '').slice(0, 6), 10);
    const transactionId = uuidToNumeric(uuidv4());
    const ticketCode = uuidToSixNumeric(uuidv4());
    const qrImage = await QRCode.toDataURL(`${process.env.ADMIN_ORIGIN}/ticket-purchase-process/${ticketCode}`);

    session.startTransaction();

    // 1. Update event's sold tickets count
    const totalSoldTickets = ticketList.tickets.reduce((sum, ticket) => {
      return sum + (Number(ticket.quantity) || 0);
    }, 0);

    await Event.findByIdAndUpdate(
      eventId,
      { $inc: { soldTicket: totalSoldTickets } },
      { new: true, session }
    );

    // 2. Update ticket configuration
    const ticketConfig = await TicketConfiguration.findOne({ eventId: eventId }).session(session);
    if (!ticketConfig) {
      throw new Error(`No ticket configuration found for event ID: ${eventId}`);
    }

    // Process each ticket in ticket configuration
    for (const orderedTicket of ticketList.tickets) {
      const ticketType = ticketConfig.tickets.find(
        t => t.id.toString() === orderedTicket.ticketId.toString()
      );

      if (!ticketType) {
        throw new Error(`Ticket type not found for ID: ${orderedTicket.ticketId}`);
      }

      const availableTickets = Number(ticketType.totalTickets) || 0;
      const orderedQuantity = Number(orderedTicket.quantity) || 0;

      ticketType.totalTickets = (availableTickets - orderedQuantity).toString();
    }

    // 3. Update individual ticket types
    for (const orderedTicket of ticketList.tickets) {
      const orderedQuantity = Number(orderedTicket.quantity) || 0;

      const updatedTicket = await TicketType.findByIdAndUpdate(
        orderedTicket.ticketId,
        { $inc: { sold: orderedQuantity } },
        { new: true, session }
      );

      if (!updatedTicket) {
        throw new Error(`TicketType not found with ID: ${orderedTicket.ticketId}`);
      }
    }

    await ticketConfig.save({ session });

    // 4. Create the order
    const newOrder = new EventOrder({
      eventId,
      userId: req.user._id,
      orderAddress: parsedOrderAddress,
      participantDetails: parsedParticipants,
      tickets: ticketList.tickets,
      totalAmount,
      paymentMethod,
      transactionId:"",
      ticketCode,
      qrCode: qrImage,
      fapshiExternalId: transactionId.toString(),
      deviceUsed,
      paymentStatus: "pending"
    });

    const savedOrder = await newOrder.save({ session });

    // Check if first purchase
    // const ticketCount = await EventOrder.countDocuments({ userId: req.user._id });

    // if (ticketCount === 1) {
    //   const user = await User.findById(req.user._id);
    //   await User.findByIdAndUpdate(req.user._id, {
    //       $inc: { rewardPoints: 100 },
    //     });
    //   if (user.referredBy) {
    //     await User.findByIdAndUpdate(user.referredBy, {
    //       $inc: { rewardPoints: 100 },
    //       $inc: { referralCount: 1 },
    //     });
    //   }
    // }

    // 5. Send confirmation email (non-critical, don't fail transaction)
    const sendEmailAsync = async () => {
      try {
        const event = await Event.findById(eventId).select('eventName date time location');
        const emailHtml = await createOrderEmailTemplate(savedOrder, userEmail, event);
        await sendMail(userEmail, 'Your Ticket Purchase Confirmation', emailHtml);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    };

    // 6. Add loyalty points (within transaction)
    const points = Math.floor(totalAmount / 100);
    if (points > 0) {
      await RewardTransaction.create(
        [{
          userId: req.user._id,
          points,
          type: "credit",
          reason: "Ticket Purchase",
          reference: eventId,
          referenceModel: "Order",
        }],
        { session }
      );
    }

    // 7. Handle payment methods
    let paymentUrl = null;

    if (paymentMethod === "cash" || Number(totalAmount) === 0) {

      // Cash payment - commit transaction immediately
      await session.commitTransaction();

      // Send email after transaction commit for cash payments
      sendEmailAsync();

      return res.status(201).json({
        success: true,
        savedOrder,
        message: "Cash order created successfully",
      });
    } else {
      // Online payment - prepare Fapshi payload but don't call API within transaction
      const fapshiPayload = {
        amount: Number(totalAmount),
        email: userEmail,
        redirectUrl: `${process.env.FRONTEND_URL}/ticket-purchase-process?orderId=${savedOrder._id}&status=success`,
        userId: req.user._id.toString(),
        externalId: transactionId,
        message: `Ticket purchase for event ${eventId}`,
      };

      // Commit transaction first before external API call
      await session.commitTransaction();

      // Then call Fapshi API
      try {
        const fapshiResponse = await axios.post(
          `${process.env.FAPSHI_BASE_URL}/initiate-pay`,
          fapshiPayload,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.FAPSHI_API_KEY,
              apiuser: process.env.FAPSHI_API_USER,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        paymentUrl = fapshiResponse.data?.link;

      } catch (fapshiError) {
        console.error("Fapshi API error:", fapshiError.message);

        // Update order status to failed for online payment
        await EventOrder.findByIdAndUpdate(savedOrder._id, {
          paymentStatus: "failed",
          errorMessage: fapshiError.response?.data?.message || "Payment gateway error"
        });

        return res.status(500).json({
          success: false,
          message: "Payment gateway error",
          error: fapshiError.response?.data || fapshiError.message,
        });
      }

      // Send email for online payment after successful API call
      sendEmailAsync();

      return res.status(201).json({
        success: true,
        savedOrder,
        paymentUrl,
        message: "Order created successfully. Redirect to payment.",
      });
    }

  } catch (error) {
    // Transaction error handling
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Error in createOrder:", error);

    // Specific error handling
    if (error.message.includes('Ticket type not found')) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket selection",
        error: error.message,
      });
    }

    if (error.message.includes('not enough tickets')) {
      return res.status(400).json({
        success: false,
        message: "Insufficient tickets available",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

exports.fapshiWebhook = async (req, res) => {
  try {
    const { externalId, status, transId } = req.body;

    if (!externalId) {
      return res.status(400).json({ message: "Missing externalId" });
    }

    // Find order by transactionId
    const order = await EventOrder.findOne({
      $or: [
        { transactionId: externalId },
        { fapshiExternalId: externalId },
        { transactionId: transId }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Store original payment status for comparison
    const originalStatus = order.paymentStatus;

    // Update payment status
    if (status === "SUCCESSFUL") {
      order.paymentStatus = "confirmed";
    } else if (status === "FAILED") {
      order.paymentStatus = "failed";
    } else {
      order.paymentStatus = "pending";
    }

    order.transactionId = transId || order.transactionId;

    await order.save();

    console.log(`Order ${order._id} updated to ${order.paymentStatus}`);

    // Reward logic with better logging
    if (status === "SUCCESSFUL") {
      const userId = order.userId;

      if (userId) {
        // Check if order was already confirmed (duplicate webhook)
        if (originalStatus === "confirmed") {
          console.log(`🔄 Order ${order._id} was already confirmed, no reward given.`);
        } else {
          // Check if this is the user's first confirmed order
          const previousOrders = await EventOrder.find({
            userId,
            paymentStatus: "confirmed",
            _id: { $ne: order._id }
          });

          if (previousOrders.length === 0) {
            // Credit 100 points for first purchase
            const rewardTx = new RewardTransaction({
              userId,
              points: 100,
              type: "credit",
              reason: "First Purchase Bonus",
              reference: order._id,
              referenceModel: "Order",
              status: "available",
            });

            await rewardTx.save();
            console.log(`🎉 100 reward points credited to user ${userId} for first purchase.`);
          } else {
            console.log(`ℹ️ User ${userId} already has ${previousOrders.length} previous confirmed orders, no bonus awarded.`);
          }
        }
      }
    } else {
      console.log(`❌ Payment status: ${status}, no reward given.`);
    }

    res.status(200).json({ message: "Webhook processed" });

  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const order = await EventOrder.findById(id).populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // 1. Get all orders for the user
    const orders = await EventOrder.find({ userId, verifyEntry: false }).sort({ createdAt: -1 });

    // 2. Extract all unique eventIds and orderIds
    const eventIds = [...new Set(orders.map(order => order.eventId))];
    const orderIds = orders.map(order => order._id);

    // 3. Fetch refund requests for this user
    const refundRequests = await RefundRequest.find({
      userId,
      orderId: { $in: orderIds }
    }).sort({ createdAt: -1 });

    // Create a map of refund requests by orderId
    const refundRequestMap = {};
    refundRequests.forEach(refund => {
      refundRequestMap[refund.orderId.toString()] = refund;
    });

    // 4. Fetch CustomPhotoFrames for the events
    const photoFrames = await CustomPhotoFrame.find({ eventId: { $in: eventIds } });
    const photoFrameMap = {};
    photoFrames.forEach(frame => {
      photoFrameMap[frame.eventId.toString()] = frame;
    });

    // 5. Fetch corresponding events
    const events = await Event.find({ _id: { $in: eventIds } });
    const eventMap = {};
    events.forEach(event => {
      eventMap[event._id.toString()] = event;
    });

    // 6. Fetch TicketConfiguration for those events
    const ticketConfigs = await TicketConfiguration.find({
      eventId: { $in: eventIds.map(id => id.toString()) }
    });

    const configMap = {};
    ticketConfigs.forEach(config => {
      configMap[config.eventId] = {
        refundPolicy: config.refundPolicy || null,
        isRefundPolicyEnabled: config.isRefundPolicyEnabled || false
      };
    });

    // 7. Enrich each order with all related data including refund requests
    const enrichedOrders = orders.map(order => {
      const event = eventMap[order.eventId] || null;
      const ticketConfig = configMap[order.eventId] || {
        refundPolicy: null,
        isRefundPolicyEnabled: false
      };
      const photoFrame = photoFrameMap[order.eventId] || null;
      const refundRequest = refundRequestMap[order._id.toString()] || null;

      return {
        ...order.toObject(),
        eventDetails: event,
        refundPolicy: ticketConfig.refundPolicy,
        isRefundPolicyEnabled: ticketConfig.isRefundPolicyEnabled,
        eventDate: event?.date ? new Date(event.date) : null,
        customPhotoFrame: photoFrame,
        refundRequest: refundRequest ? {
          _id: refundRequest._id,
          refundStatus: refundRequest.refundStatus,
          refundAmount: refundRequest.refundAmount,
          totalAmount: refundRequest.totalAmount,
          reason: refundRequest.reason,
          adminNotes: refundRequest.adminNotes,
          isAdminForwrd: refundRequest.isAdminForwrd,
          refundTransactionId: refundRequest.refundTransactionId,
          createdAt: refundRequest.createdAt,
          updatedAt: refundRequest.updatedAt
        } : null
      };
    }).sort((a, b) => {
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return a.eventDate - b.eventDate;
    });

    res.status(200).json(enrichedOrders);
  } catch (error) {
    console.error("Error in getOrdersByUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const generateTicketPDF = async ({ order, event }) => {
  const { eventName, date, time, category, location, description } = event;
  const {
    _id,
    orderAddress,
    createdAt,
    tickets,
    totalAmount,
    paymentStatus,
    transactionId,
    paymentMethod,
    participantDetails,
    userId,
    ticketCode,
    qrCode
  } = order;

  try {
    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a new page (A4 size: 595.28 x 841.89 points)
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // Colors
    const primaryColor = rgb(0.2, 0.4, 0.8); // Blue theme
    const secondaryColor = rgb(0.95, 0.95, 0.95); // Light gray
    const textColor = rgb(0, 0, 0);

    // Header with background - Reduced height
    page.drawRectangle({
      x: 0,
      y: height - 80, // Reduced from 100 to 80
      width: width,
      height: 80,
      color: primaryColor,
    });

    // Add Logo at the top right of the header
    try {
      const logoPath = path.join(__dirname, '../../assets/logo-mobile.png');
      const logoImage = await pdfDoc.embedPng(fs.readFileSync(logoPath));

      // Fixed logo dimensions as requested
      const logoWidth = 50;
      const logoHeight = 50;

      // Position logo at top left of header with some margin
      const logoX = 50; // Left aligned with 50px margin
      const logoY = height - 40 - logoHeight / 2; // Vertically centered in header

      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (logoError) {
      console.warn('Could not load logo, continuing without it:', logoError.message);
    }

    // Event Ticket Title - Adjusted to accommodate logo on right
    page.drawText('EVENT TICKET', {
      x: width / 2 - 70, // Centered, but logo will be on right
      y: height - 40, // Adjusted position
      size: 20, // Reduced from 24 to 20
      font: titleFont,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Status: ${paymentStatus.toUpperCase()}`, {
      x: width - 120,
      y: height - 65, // Adjusted position
      size: 10, // Reduced from 12 to 10
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // Ticket Code
    page.drawText(`Ticket Code: ${ticketCode}`, {
      x: 50,
      y: height - 65, // Adjusted position
      size: 10, // Reduced from 12 to 10
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    let yPosition = height - 100; // Adjusted starting position

    // Compact section drawer
    const drawCompactSection = (title, content, startY) => {
      let currentY = startY;

      // Reduced top margin
      currentY -= 15;

      // Section title with smaller font
      page.drawText(title, {
        x: 50,
        y: currentY,
        size: 14, // Reduced from 16 to 14
        font: boldFont,
        color: primaryColor,
      });
      currentY -= 22; // Reduced from 30 to 22

      // Calculate section height with reduced padding
      const sectionHeight = (content.length * 20) + 30; // Reduced padding

      // Section background
      page.drawRectangle({
        x: 45,
        y: currentY - sectionHeight + 15,
        width: width - 90,
        height: sectionHeight,
        color: secondaryColor,
        borderColor: primaryColor,
        borderWidth: 0.5,
      });

      // Content with smaller fonts
      content.forEach(item => {
        if (item.label && item.value) {
          page.drawText(item.label, {
            x: 55,
            y: currentY,
            size: 10, // Reduced from 12 to 10
            font: boldFont,
            color: textColor,
          });

          page.drawText(item.value, {
            x: 180, // Adjusted position
            y: currentY,
            size: 10, // Reduced from 12 to 10
            font: regularFont,
            color: textColor,
          });
        }

        currentY -= 20; // Reduced from 25 to 20
      });

      return currentY - 8; // Reduced bottom margin
    };

    // Event Details Section - Compact version
    const eventDetails = [
      { label: 'Event Name:', value: eventName || 'N/A' },
      { label: 'Date:', value: date || 'N/A' },
      { label: 'Time:', value: time || 'N/A' },
      { label: 'Venue:', value: location || 'N/A' },
      { label: 'Category:', value: category || 'N/A' },
    ];

    yPosition = drawCompactSection('Event Details', eventDetails, yPosition);

    // Compact table drawer function
    const drawCompactTable = (title, headers, columnWidths, data, startY) => {
      let currentY = startY;
      currentY -= 20;
      // Section title
      page.drawText(title, {
        x: 50,
        y: currentY,
        size: 14, // Reduced from 16 to 14
        font: boldFont,
        color: primaryColor,
      });
      currentY -= 20; // Reduced from 30 to 20

      const tableStartX = 50;

      // Table header background - reduced height
      page.drawRectangle({
        x: tableStartX,
        y: currentY - 20, // Reduced height
        width: columnWidths.reduce((a, b) => a + b, 0),
        height: 20, // Reduced from 25 to 20
        color: primaryColor,
      });

      // Header text - smaller font
      headers.forEach((header, i) => {
        const columnX = tableStartX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        page.drawText(header, {
          x: columnX + 8, // Reduced padding
          y: currentY - 12, // Adjusted position
          size: 9, // Reduced from 11 to 9
          font: boldFont,
          color: rgb(1, 1, 1),
        });
      });

      currentY -= 25; // Reduced from 35 to 25

      // Data rows
      data.forEach((item, index) => {
        const rowColor = index % 2 === 0 ? rgb(1, 1, 1) : secondaryColor;

        page.drawRectangle({
          x: tableStartX,
          y: currentY - 16, // Reduced height
          width: columnWidths.reduce((a, b) => a + b, 0),
          height: 16, // Reduced from 20 to 16
          color: rowColor,
        });

        item.forEach((text, i) => {
          const columnX = tableStartX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
          page.drawText(text, {
            x: columnX + 8, // Reduced padding
            y: currentY - 10, // Adjusted position
            size: 8, // Reduced from 10 to 8
            font: regularFont,
            color: textColor,
          });
        });

        currentY -= 18; // Reduced from 25 to 18
      });

      return currentY - 10; // Reduced bottom margin
    };

    // Attendee Information Section in Compact Table
    const attendeeHeaders = ['#', 'Name', 'Age', 'Gender'];
    const attendeeColumnWidths = [40, 220, 50, 90]; // Adjusted widths

    const attendeeData = [];
    if (participantDetails && participantDetails.length > 0) {
      participantDetails.forEach((participant, index) => {
        attendeeData.push([
          (index + 1).toString(),
          participant.name || 'N/A',
          participant.age || 'N/A',
          participant.gender || 'N/A'
        ]);
      });
    } else {
      // Fallback data
      attendeeData.push([
        '1',
        orderAddress?.name || userId?.name || 'N/A',
        orderAddress?.age || 'N/A',
        orderAddress?.gender || userId?.gender || 'N/A'
      ]);
    }

    yPosition = drawCompactTable('Attendee Information', attendeeHeaders, attendeeColumnWidths, attendeeData, yPosition);

    // Order Information Section - Compact version
    const orderDetails = [
      { label: 'Order ID:', value: _id.toString().substring(0, 12) + '...' }, // Truncated ID
      { label: 'Purchase Date:', value: new Date(createdAt).toLocaleDateString() }, // Date only
      { label: 'Transaction ID:', value: transactionId || 'N/A' },
      { label: 'Payment Method:', value: paymentMethod ? paymentMethod.replace('_', ' ').toUpperCase() : 'N/A' },
      { label: 'Status:', value: paymentStatus.toUpperCase() },
    ];

    yPosition = drawCompactSection('Order Information', orderDetails, yPosition);

    // Tickets Table Section - Compact version
    const ticketHeaders = ['Ticket Type', 'Qty', 'Unit Price', 'Total'];
    const ticketColumnWidths = [180, 50, 90, 90]; // Adjusted widths

    const ticketData = [];
    tickets.forEach((ticket) => {
      ticketData.push([
        ticket.ticketType,
        ticket.quantity.toString(),
        `${ticket.unitPrice.toFixed(0)} XAF`, // Removed decimals
        `${(ticket.quantity * ticket.unitPrice).toFixed(0)} XAF` // Removed decimals
      ]);
    });

    yPosition = drawCompactTable('Ticket Details', ticketHeaders, ticketColumnWidths, ticketData, yPosition);

    // Total amount - compact version
    yPosition -= 5;
    page.drawRectangle({
      x: 50 + ticketColumnWidths.slice(0, 2).reduce((a, b) => a + b, 0),
      y: yPosition - 20,
      width: ticketColumnWidths.slice(2).reduce((a, b) => a + b, 0),
      height: 20,
      color: primaryColor,
    });

    page.drawText('TOTAL:', {
      x: 50 + ticketColumnWidths.slice(0, 2).reduce((a, b) => a + b, 0) + 8,
      y: yPosition - 12,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    page.drawText(`${totalAmount.toFixed(0)} XAF`, {
      x: 50 + ticketColumnWidths.slice(0, 3).reduce((a, b) => a + b, 0) + 8,
      y: yPosition - 12,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // QR Code Section - Fixed positioning at bottom right
    if (qrCode && qrCode.startsWith('data:image')) {
      try {
        // Extract base64 data from data URL
        const base64Data = qrCode.split(',')[1];
        const qrImage = await pdfDoc.embedPng(Buffer.from(base64Data, 'base64'));

        // Fixed QR code size and position
        const qrSize = 100; // Fixed size
        const qrX = width - qrSize - 50; // Right aligned with margin
        const qrY = 80; // Fixed position from bottom (above footer)

        // Draw QR code
        page.drawImage(qrImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        });

        // QR code label
        page.drawText('Scan for Entry', {
          x: qrX + qrSize / 2 - 25,
          y: qrY + qrSize + 5,
          size: 8,
          font: boldFont,
          color: primaryColor,
        });

        // Draw border around QR code
        page.drawRectangle({
          x: qrX - 2,
          y: qrY - 2,
          width: qrSize + 4,
          height: qrSize + 4,
          borderColor: primaryColor,
          borderWidth: 1,
        });
      } catch (qrError) {
        console.error('Error embedding QR code:', qrError);
      }
    }

    // Compact Footer
    page.drawText('Thank you for your purchase! Present this ticket at the entrance.', {
      x: width / 2 - 180,
      y: 40,
      size: 9,
      font: regularFont,
      color: textColor,
    });

    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 40,
      size: 7,
      font: regularFont,
      color: textColor,
    });

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating PDF:', error.message);
    throw error;
  }
};

// Enhanced download handler
exports.downloadTicket = async (req, res) => {
  try {
    const order = await EventOrder.findById(req.params.orderId)
      .populate('userId', 'name email number gender') // Specify fields you need
      .exec();
    const event = await Event.findOne({ _id: order.eventId })
      .select('eventName _id date time location description formate ') // Specify fields you need


    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const pdfBytes = await generateTicketPDF({ order, event });

    // Verify PDF was generated properly
    if (!pdfBytes || !(pdfBytes instanceof Uint8Array)) {
      throw new Error('Invalid PDF generated');
    }

    // Set proper headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket-${order._id}.pdf`);

    // Send as buffer
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({
      message: 'Error generating ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update order payment status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const validStatuses = ['pending', 'completed', 'failed'];
    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const updateData = {};
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (transactionId) updateData.transactionId = transactionId;

    const updatedOrder = await EventOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    // Get all orders with all fields
    const allOrders = await EventOrder.find();

    // Get only verified orders with specific fields
    const verifiedOrders = await EventOrder.find({ verifyEntry: true })
      .populate('userId', 'name')
      .lean(); // Convert to plain JavaScript object
    const filteredOrders = verifiedOrders.map(order => ({
      name: order.userId.name,
      ticketType: order.tickets[0]?.ticketType || 'N/A',
      entryTime: order.entryTime || null,
      verifyEntry: order.verifyEntry
    }));
    res.status(200).json({
      success: true,
      allOrders,
      verifiedOrders: filteredOrders,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

//verify event
exports.verifyTicket = async (req, res) => {
  try {
    const { ticketCode, participantId, name, eventId } = req.body;
    // Check if at least one field is provided
    if (!ticketCode && !participantId && !name) {
      return res.status(404).json({
        message: "Please provide at least one data",
        flag: 'field'
      });
    }

    // Check if eventId is provided
    if (!eventId) {
      return res.status(400).json({
        message: "Event ID is required",
        flag: 'invalid'
      });
    }

    // Build query based on provided fields
    const query = { eventId };
    if (ticketCode) query.ticketCode = ticketCode;
    if (participantId) query.userId = participantId;
    if (name) query.name = name;

    // Find ticket in database
    const ticket = await EventOrder.findOne(query)
      .select('userId _id eventId tickets verifyEntry entryTime participantDetails paymentStatus')
      .populate('userId', 'name email')
      .populate({
        path: 'eventId',
        select: 'eventName date time location',
        model: 'Event'
      })
      .lean();

    if (!ticket) {
      return res.status(404).json({ message: "Invalid ticket", flag: 'invalid' });
    }

    if (ticket.verifyEntry) {
      return res.status(404).json({ message: "Ticket already used", flag: 'already' });
    }

    // Create event datetime object
    const eventDate = new Date(ticket.eventId.date);
    const eventTime = ticket.eventId.time.split(':');

    // Set the hours and minutes from the event time
    eventDate.setHours(parseInt(eventTime[0]));
    eventDate.setMinutes(parseInt(eventTime[1]));
    eventDate.setSeconds(0);
    eventDate.setMilliseconds(0);

    const currentDate = new Date();

    // Calculate time window (2 hours before to 2 hours after event time)
    const entryStartTime = new Date(eventDate);
    entryStartTime.setHours(entryStartTime.getHours() - 2);

    const entryEndTime = new Date(eventDate);
    entryEndTime.setHours(entryEndTime.getHours() + 2);

    // Check if current time is within the allowed entry window
    if (currentDate < entryStartTime) {
      return res.status(400).json({
        message: "Entry not allowed yet. You can enter from 2 hours before the event time.",
        flag: 'too_early',
        eventDetails: {
          name: ticket.eventId.eventName,
          date: ticket.eventId.date,
          time: ticket.eventId.time,
          location: ticket.eventId.location,
          entryStartTime: entryStartTime.toISOString(),
          entryEndTime: entryEndTime.toISOString()
        }
      });
    }

    if (currentDate > entryEndTime) {
      return res.status(400).json({
        message: "Entry time has expired. Entry is only allowed up to 2 hours after the event time.",
        flag: 'expired',
        eventDetails: {
          name: ticket.eventId.eventName,
          date: ticket.eventId.date,
          time: ticket.eventId.time,
          location: ticket.eventId.location,
          entryStartTime: entryStartTime.toISOString(),
          entryEndTime: entryEndTime.toISOString()
        }
      });
    }

    return res.status(200).json({
      message: "Access granted, Welcome",
      ticket,
      eventName: ticket.eventId.eventName,
      flag: 'granted'
    });

  } catch (err) {
    console.error("Error verifying ticket:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateOrderVerifyEntryStatus = async (req, res) => {
  try {
    const { entryTime, verifyEntry } = req.body;
    const { ticketCode, participantId, name } = req.body.verifyData;

    // Check if at least one identifier is provided
    if (!ticketCode && !participantId && !name) {
      return res.status(400).json({
        message: "Please provide at least one identifier (ticketCode, participantId, or name)"
      });
    }

    // Check if verifyEntry is provided
    if (typeof verifyEntry !== 'boolean') {
      return res.status(400).json({
        message: "Please provide a valid verifyEntry status (true/false)"
      });
    }

    let updatedOrder;

    if (participantId || name) {

      // const filter = { ticketCode };
      const filter = {};
      // if (participantId) filter["participantDetails._id"] = participantId;
      // if (name) filter["participantDetails.name"] = name;
      if (ticketCode) filter.ticketCode = ticketCode;
      if (participantId) filter["participantDetails._id"] = participantId;
      if (name) filter["participantDetails.name"] = name;

      updatedOrder = await EventOrder.findOneAndUpdate(
        filter,
        {
          $set: {
            "participantDetails.$.validation": verifyEntry,
            "participantDetails.$.entryTime": entryTime
          }
        },
        { new: true }
      )
        ;
    } else {
      // ✅ Update order-level verification
      updatedOrder = await EventOrder.findOneAndUpdate(
        { ticketCode },
        { $set: { verifyEntry: verifyEntry, entryTime: entryTime } },
        { new: true }
      );
    }

    if (!updatedOrder) {
      return res.status(404).json({
        message: "No matching order/participant found with the provided identifiers"
      });
    }

    res.status(200).json({
      message: "Entry status updated successfully",
      data: {
        ticketCode: updatedOrder.ticketCode,
        verifyEntry: updatedOrder.verifyEntry,
        entryTime: updatedOrder.entryTime,
        participantDetails: updatedOrder.participantDetails // includes updated participant
      }
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.getPurchseTicketUserList = async (req, res) => {
  try {
    const organizerId = req.user._id;

    // First, find all events created by this organizer
    const events = await mongoose.model('Event').find({
      createdBy: organizerId,
      isDelete: false
    }).select('_id eventName');

    if (!events.length) {
      return res.status(200).json({
        success: true,
        message: 'No events found for this organizer',
        data: []
      });
    }

    const eventIds = events.map(event => event._id);

    // Then find all orders for these events, populating user details
    const orders = await mongoose.model('EventOrder').find({
      eventId: { $in: eventIds }
    })
      .populate({
        path: 'userId',
        select: '_id name email avatar' // Select the user fields you need
      })
      .select('eventId userId tickets totalAmount paymentStatus createdAt verifyEntry entryTime');

    if (!orders.length) {
      return res.status(200).json({
        success: true,
        message: 'No ticket purchases found for your events',
        data: []
      });
    }

    // Transform the data to include event details with user information
    const result = orders.map(order => {
      const event = events.find(e => e._id.toString() === order.eventId.toString());
      return {
        eventId: order.eventId,
        eventName: event ? event.eventName : 'Unknown Event',
        user: {
          id: order.userId._id,
          name: `${order.userId.name}`,
          email: order.userId.email,
          phone: order.userId.phoneNumber,
          avatar: order.userId.avatar
        },
        tickets: order.tickets,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Ticket purchase user list retrieved successfully',
      result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }

    const order = await EventOrder.findOne({ transactionId }).populate('eventId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const event = order.eventId;

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(require('@pdf-lib/fontkit'));
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;

    let yPosition = height - 50;

    // Header
    page.drawText('Invoice', { x: 50, y: yPosition, size: 20, font, color: rgb(0, 0, 0) });
    yPosition -= 40;

    // Order info
    page.drawText(`Invoice ID: ${order.transactionId}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Date: ${order.createdAt.toLocaleDateString()}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Customer Email: ${order.orderAddress.email}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Payment Method: ${order.paymentMethod}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Payment Status: ${order.paymentStatus || 'Pending'}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 30;

    // Event info
    page.drawText(`Event: ${event.eventName}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Date: ${event.date}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 20;
    page.drawText(`Location: ${event.location}`, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 40;

    // Draw table headers
    const tableX = 50;
    let tableY = yPosition;
    const colWidths = [250, 70, 100]; // Ticket Type, Qty, Price
    const rowHeight = 20;

    // Draw header background rectangle
    page.drawRectangle({
      x: tableX,
      y: tableY - rowHeight,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Header titles
    page.drawText('Ticket Type', { x: tableX + 5, y: tableY - 15, size: fontSize, font, color: rgb(0, 0, 0) });
    page.drawText('Quantity', { x: tableX + colWidths[0] + 5, y: tableY - 15, size: fontSize, font, color: rgb(0, 0, 0) });
    page.drawText('Price (XAF)', { x: tableX + colWidths[0] + colWidths[1] + 5, y: tableY - 15, size: fontSize, font, color: rgb(0, 0, 0) });

    tableY -= rowHeight;

    // Draw table rows for tickets
    order.tickets.forEach(ticket => {
      // Draw ticket type
      page.drawText(ticket.ticketType || 'N/A', { x: tableX + 5, y: tableY - 15, size: fontSize, font });
      // Draw quantity
      page.drawText(ticket.quantity.toString(), { x: tableX + colWidths[0] + 5, y: tableY - 15, size: fontSize, font });
      // Draw price (unitPrice * quantity)
      const totalPrice = (ticket.unitPrice || 0) * (ticket.quantity || 1);
      page.drawText(totalPrice.toLocaleString(), { x: tableX + colWidths[0] + colWidths[1] + 5, y: tableY - 15, size: fontSize, font });

      // Draw horizontal line after row
      page.drawLine({
        start: { x: tableX, y: tableY - rowHeight },
        end: { x: tableX + colWidths.reduce((a, b) => a + b, 0), y: tableY - rowHeight },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });

      tableY -= rowHeight;
    });

    // Draw vertical lines (columns)
    let xPos = tableX;
    colWidths.forEach(width => {
      page.drawLine({
        start: { x: xPos, y: yPosition },
        end: { x: xPos, y: tableY },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      xPos += width;
    });
    // Last vertical line at the end of the table
    page.drawLine({
      start: { x: xPos, y: yPosition },
      end: { x: xPos, y: tableY },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    yPosition = tableY - 30;

    // Total
    page.drawText(`Total Amount: ${order.totalAmount?.toLocaleString()} XAF`, { x: 50, y: yPosition, size: 14, font });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.transactionId}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ message: 'Error generating invoice PDF', error: error.message });
  }
};

exports.transferTicket = async (req, res) => {
  try {
    const { orderId, beneficiaryId } = req.body;
    const loggedInUserId = req.user._id;

    if (!orderId || !beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: "Order ID and Beneficiary ID are required",
      });
    }

    // 0️⃣ Check if a refund already exists for this order
    const existingRefund = await RefundRequest.findOne({
      orderId,
      userId: loggedInUserId,
      refundStatus: { $in: ["pending", "approved"] }, // pending or approved
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: "⚠️ You have already requested a refund for this ticket. Please cancel the refund before sharing the ticket.",
      });
    }

    // 1️⃣ Check beneficiary exists
    const beneficiary = await User.findOne({ __id: beneficiaryId, role: "participant" });
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: "Beneficiary not found or not a participant",
      });
    }

    // 2️⃣ Find sender order
    const senderOrder = await EventOrder.findOne({
      _id: orderId,
      userId: loggedInUserId,
    });

    if (!senderOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found for this user",
      });
    }

    // 3️⃣ Transfer entire order to beneficiary
    senderOrder.userId = beneficiary._id;
    senderOrder.updatedAt = new Date();
    await senderOrder.save();

    return res.status(200).json({
      success: true,
      message: "Tickets transferred successfully",
      updatedOrder: senderOrder,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};