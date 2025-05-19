const { v4: uuidv4 } = require('uuid');
const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const TicketConfiguration = require('../../models/event-details/Ticket');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit'); // Required for proper font handling
const mongoose = require("mongoose");
const { sendMail } = require('../../utils/Emails');
const { createOrderEmailTemplate } = require('../../utils/Emails-template');

// Create a new order
exports.createOrder = async (req, res) => {
  const uuidToNumeric = (uuid) => parseInt(uuid.replace(/\D/g, '').slice(0, 10), 10);
  const transactionId = uuidToNumeric(uuidv4());

  try {
    const { eventId, orderAddress, tickets, totalAmount, paymentMethod } = req.body;
    const ticketList = JSON.parse(tickets);
    const parsedOrderAddress = JSON.parse(orderAddress);
    const userEmail = parsedOrderAddress.email; // Extract email from order address

    // Validate required fields
    if (!eventId || !orderAddress || !totalAmount || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate tickets array
    if (!Array.isArray(ticketList.tickets) || ticketList.tickets.length === 0) {
      return res.status(400).json({ message: 'At least one ticket is required' });
    }

    // Start a transaction session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // First find the ticket configuration for this event
      const ticketConfig = await TicketConfiguration.findOne({
        eventId: eventId
      }).session(session);

      if (!ticketConfig) {
        throw new Error(`No ticket configuration found for event ID: ${eventId}`);
      }

      // Process each ticket in the order
      for (const orderedTicket of ticketList.tickets) {
        const ticketType = ticketConfig.tickets.find(
          t => t.id === orderedTicket.ticketId || t._id.toString() === orderedTicket.ticketId
        );

        if (!ticketType) {
          throw new Error(`Ticket type not found for ID: ${orderedTicket.ticketId}`);
        }

        const availableTickets = parseInt(ticketType.totalTickets || "0");
        const orderedQuantity = parseInt(orderedTicket.quantity || "0");

        if (availableTickets < orderedQuantity) {
          throw new Error(`Not enough tickets available for ${ticketType.ticketType}`);
        }

        ticketType.totalTickets = (availableTickets - orderedQuantity).toString();
      }

      await ticketConfig.save({ session });

      // Create the new order
      const newOrder = new EventOrder({
        eventId,
        userId: req.user._id,
        orderAddress: parsedOrderAddress,
        tickets: ticketList.tickets,
        totalAmount,
        paymentMethod,
        transactionId
      });

      const savedOrder = await newOrder.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Send confirmation email
      try {
        const emailHtml = createOrderEmailTemplate(savedOrder, userEmail);
        // Await the sendMail function directly
        await sendMail(
          userEmail,
          'Your Ticket Purchase Confirmation',
          emailHtml
        );

        console.log('Email sent successfully');
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the order if email fails
      }

      res.status(201).json({
        success: true,
        savedOrder,
        message: "Tickets booked successfully"
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing order',
      error: error.message
    });
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

// Get orders by user ID
exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const orders = await EventOrder.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
    const { page = 1, limit = 10 } = req.query;
    const orders = await EventOrder.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('userId', 'name email');

    const count = await EventOrder.countDocuments();

    res.json({
      orders,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page)
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};