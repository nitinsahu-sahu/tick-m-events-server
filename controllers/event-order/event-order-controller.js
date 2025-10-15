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
      transactionId,
      ticketCode,
      qrCode: qrImage,
      deviceUsed,
      paymentStatus: "pending"
    });

    const savedOrder = await newOrder.save({ session });

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
          "https://sandbox.fapshi.com/initiate-pay",
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
        console.log(fapshiResponse);
        console.log(paymentUrl);

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

    // externalId = transactionId you sent when creating order
    if (!externalId) {
      return res.status(400).json({ message: "Missing externalId" });
    }

    // Find order by transactionId
    const order = await EventOrder.findOne({ transactionId: externalId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update payment status
    if (status === "SUCCESSFUL") {
      order.paymentStatus = "confirmed";
    } else if (status === "FAILED") {
      order.paymentStatus = "failed";
    } else {
      order.paymentStatus = "confirmed";
    }
    

    order.transactionId = transId || order.transactionId;
    await order.save();

    console.log(`Order ${order._id} updated to ${order.paymentStatus}`);

    // Respond so Fapshi knows we received the webhook
    res.status(200).json({ message: "Webhook processed" });

  } catch (err) {
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

// exports.getOrdersByUser = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid user ID" });
//     }

//     // 1. Get all orders for the user
//     const orders = await EventOrder.find({ userId, verifyEntry: false }).sort({ createdAt: -1 });

//     // 2. Extract all unique eventIds
//     const eventIds = [...new Set(orders.map(order => order.eventId))];

//     // 3. Fetch corresponding events
//     const events = await Event.find({ _id: { $in: eventIds } });
//     const eventMap = {};
//     events.forEach(event => {
//       eventMap[event._id.toString()] = event;
//     });

//     // 4. Fetch TicketConfiguration for those events
//     const ticketConfigs = await TicketConfiguration.find({ 
//       eventId: { $in: eventIds.map(id => id.toString()) } 
//     });

//     const configMap = {};
//     ticketConfigs.forEach(config => {
//       configMap[config.eventId] = {
//         refundPolicy: config.refundPolicy || null,
//         isRefundPolicyEnabled: config.isRefundPolicyEnabled || false
//       };
//     });

//     // 5. Enrich each order
//     const enrichedOrders = orders.map(order => {
//       const event = eventMap[order.eventId] || null;
//       const ticketConfig = configMap[order.eventId] || 
//       { refundPolicy: null, isRefundPolicyEnabled: false };
//       return {
//         ...order.toObject(),
//         payStatus: ticketConfig.payStatus,
//         eventDetails: event,
//         refundPolicy: ticketConfig.refundPolicy,
//         isRefundPolicyEnabled: ticketConfig.isRefundPolicyEnabled,
//         eventDate: event?.date ? new Date(event.date) : null,
//       };
//     }).sort((a, b) => {
//       if (!a.eventDate) return 1;
//       if (!b.eventDate) return -1;
//       return a.eventDate - b.eventDate;
//     });
//     res.status(200).json(enrichedOrders);
//   } catch (error) {
//     console.error("Error in getOrdersByUser:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };
exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // 1. Get all orders for the user
    const orders = await EventOrder.find({ userId, verifyEntry: false }).sort({ createdAt: -1 });

    // 2. Extract all unique eventIds
    const eventIds = [...new Set(orders.map(order => order.eventId))];

    // 4.5 Fetch CustomPhotoFrames for the events
    const photoFrames = await CustomPhotoFrame.find({ eventId: { $in: eventIds } });
    const photoFrameMap = {};
    photoFrames.forEach(frame => {
      photoFrameMap[frame.eventId.toString()] = frame;
    });

    // 3. Fetch corresponding events
    const events = await Event.find({ _id: { $in: eventIds } });
    const eventMap = {};
    events.forEach(event => {
      eventMap[event._id.toString()] = event;
    });

    // 4. Fetch TicketConfiguration for those events
    const ticketConfigs = await TicketConfiguration.find({ eventId: { $in: eventIds.map(id => id.toString()) } });

    const configMap = {};
    ticketConfigs.forEach(config => {
      configMap[config.eventId] = {
        refundPolicy: config.refundPolicy || null,
        isRefundPolicyEnabled: config.isRefundPolicyEnabled || false
      };
    });

    // 5. Enrich each order
    const enrichedOrders = orders.map(order => {
      const event = eventMap[order.eventId] || null;
      const ticketConfig = configMap[order.eventId] || { refundPolicy: null, isRefundPolicyEnabled: false };
      const photoFrame = photoFrameMap[order.eventId] || null;
      return {
        ...order.toObject(),
        eventDetails: event,
        refundPolicy: ticketConfig.refundPolicy,
        isRefundPolicyEnabled: ticketConfig.isRefundPolicyEnabled,
        eventDate: event?.date ? new Date(event.date) : null,
        customPhotoFrame: photoFrame
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
  const { eventName, date, time, category, location, description } = event
  const { _id, orderAddress, createdAt, tickets, totalAmount, paymentStatus, transactionId, paymentMethod } = order

  try {
    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);


    // Add a new page (A4 size: 595.28 x 841.89 points)
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();


    // Add header
    page.drawText('EVENT TICKET', {
      x: 50,
      y: height - 50,
      size: 24,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw divider line
    page.drawLine({
      start: { x: 50, y: height - 70 },
      end: { x: width - 50, y: height - 70 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    // Event details section
    let yPosition = height - 100;
    page.drawText('Event Details:', {
      x: 50,
      y: yPosition,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Populate event data (assuming order.eventId is populated)
    if (order.eventId) {
      page.drawText(`• Event: ${eventName || 'N/A'}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`• Date: ${date || 'N/A'}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`• Time: ${time || 'N/A'}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`• Category: ${category || 'N/A'}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`• Venue: ${location || 'N/A'}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;
    }

    // User details section
    page.drawText('Attendee Information:', {
      x: 50,
      y: yPosition,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Populate user data (assuming order.userId is populated)
    page.drawText(`• Name: ${orderAddress.name || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    page.drawText(`• Number: ${orderAddress.number || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(`• Gender: ${orderAddress.gender || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(`• Address: ${orderAddress.city || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    page.drawText(`• Age: ${orderAddress.age || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    page.drawText(`• Email: ${orderAddress.email || 'N/A'}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Order details section
    page.drawText('Order Information:', {
      x: 50,
      y: yPosition,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    page.drawText(`• Order ID: ${_id.toString()}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(`• Purchase Date: ${new Date(createdAt).toLocaleString()}`, {
      x: 60,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;


    // Draw table headers
    const headers = ['#item', 'Type', 'Qty', 'Unit Price', 'Total'];
    const columnWidths = [100, 150, 50, 80, 80];
    const startX = 50;
    // Table styling constants
    const TABLE_STYLE = {
      headerBgColor: rgb(0.9, 0.9, 0.9), // Light gray
      headerBorderColor: rgb(0.7, 0.7, 0.7),
      rowBgColor: '#3c74f0fc', // Very light gray
      textColor: rgb(0, 0, 0), // Black
      borderColor: '#3c74f0fc',
      rowHeight: 20,
      headerHeight: 22,
      padding: 5,
    };
    // Draw header row
    headers.forEach((header, i) => {
      const columnX = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);

      // Header background
      page.drawRectangle({
        x: columnX,
        y: yPosition - TABLE_STYLE.headerHeight + 10,
        width: columnWidths[i],
        height: TABLE_STYLE.headerHeight,
        color: TABLE_STYLE.headerBgColor,
        borderColor: TABLE_STYLE.headerBorderColor,
        borderWidth: 0.5,
      });

      // Header text
      page.drawText(header, {
        x: columnX + TABLE_STYLE.padding,
        y: yPosition,
        size: 10,
        font: boldFont,
        color: TABLE_STYLE.textColor,
      });
    });
    yPosition -= 10;

    // Draw header underline
    page.drawLine({
      start: { x: startX, y: yPosition - 5 },
      end: { x: startX + columnWidths.reduce((a, b) => a + b, 0), y: yPosition - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    // Draw ticket rows
    order.tickets.forEach((ticket, index) => {
      const rowData = [
        (index + 1).toString(), // Now starts at 1 instead of 0
        ticket.ticketType,
        ticket.quantity.toString(),
        `${(ticket.unitPrice).toFixed(2)} XAF`, // Assuming price is in cents
        `${(ticket.quantity * ticket.unitPrice).toFixed(2)} XAF`
      ];

      rowData.forEach((text, i) => {
        page.drawText(text, {
          x: startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0),
          y: yPosition,
          size: 10,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
      });

      yPosition -= 15;

      // Add row separator
      if (index < order.tickets.length - 1) {
        page.drawLine({
          start: { x: startX, y: yPosition - 5 },
          end: { x: startX + columnWidths.reduce((a, b) => a + b, 0), y: yPosition - 5 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yPosition -= 5;
      }
    });

    // Draw table bottom border
    page.drawLine({
      start: { x: startX, y: yPosition - 5 },
      end: { x: startX + columnWidths.reduce((a, b) => a + b, 0), y: yPosition - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    // Add total amount
    page.drawText(`Total Amount: ${(totalAmount).toFixed(2)} XAF`, {
      x: startX + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0),
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 30;

    // Order details section
    page.drawText(`Transaction No.: ${transactionId}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    page.drawText(`Payment Method: ${paymentMethod}`, {
      x: 50,
      y: yPosition,
      size: 10,

      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    // Add footer
    page.drawText('Thank you for your purchase!', {
      x: width / 2 - 100,
      y: 50,
      size: 14,
      font: font,
      color: rgb(0, 0, 0),
    });


    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generate pdf:', error.message);

  }
};

// Enhanced download handler
exports.downloadTicket = async (req, res) => {
  try {
    const order = await EventOrder.findById(req.params.orderId)
      .populate('userId', 'name email number gender') // Specify fields you need
      .exec();
    const event = await Event.findOne({ _id: order.eventId })
      .select('eventName _id date time category location description formate ') // Specify fields you need

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
  console.log(req.body);
  console.log(req.user._id);
  
  try {
    const { ticketCode, participantId, name } = req.body;

    // Check if at least one field is provided
    if (!ticketCode && !participantId && !name) {
      return res.status(404).json({
        message: "Please provide at least one data",
        flag: 'field'
      });
    }

    // Build query based on provided fields
    const query = {};
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

    // Check if event date and time have passed
    const eventDate = new Date(ticket.eventId.date);
    const eventTime = ticket.eventId.time.split(':');

    // Set the hours and minutes from the event time
    eventDate.setHours(parseInt(eventTime[0]));
    eventDate.setMinutes(parseInt(eventTime[1]));

    const currentDate = new Date();

    if (currentDate > eventDate) {
      return res.status(400).json({
        message: "Event has expired. Please purchase a ticket for the next event.",
        flag: 'expired',
        eventDetails: {
          name: ticket.eventId.eventName,
          date: ticket.eventId.date,
          time: ticket.eventId.time,
          location: ticket.eventId.location
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