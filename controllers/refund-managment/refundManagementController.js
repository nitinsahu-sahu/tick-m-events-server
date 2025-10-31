const UserServiceRequest = require('../../models/profile-service-maagement/add-service');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const path = require("path");
const fs = require("fs");
const fontkit = require('@pdf-lib/fontkit'); // Required for proper font handling

const { sendRefundEmail } = require("../../utils/Emails-template");


exports.submitRefundRequest = async (req, res) => {
  try {
    const { userId, orderId, reason, refundAmount: clientRefundAmount } = req.body;

    // 1️⃣ Validate Order and Ownership
    const order = await EventOrder.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    const transactionId = order.transactionId;

    // 2️⃣ Validate Event
    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found' });
    }

    // ✅ 2.1 Check Event's Available Balance
    if (!event.availableBalance || event.availableBalance <= 0) {
      return res.status(400).json({
        message: "Refund cannot be requested because the event's available balance is zero.",
      });
    }

    // If refund amount provided by client, validate against event balance
    if (clientRefundAmount && clientRefundAmount > event.availableBalance) {
      return res.status(400).json({
        message: "Insufficient organizer balance to process the refund.",
      });
    }

    // 3️⃣ Check if a refund request already exists
    let existingRequest = await RefundRequest.findOne({
      transactionId,
      userId,
      orderId,
    });

    // 4️⃣ Calculate refund amount dynamically
    const policy = order.refundPolicy || {};
    const today = new Date();
    const eventDate = new Date(event.date);
    let refundAmount = 0;
    let refundType = req.body.refundType || "manual";

    if (policy.fullRefund) {
      const fullRefundDaysBefore = parseInt(policy.fullRefundDaysBefore || "0");
      const daysBeforeEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
      if (daysBeforeEvent >= fullRefundDaysBefore) {
        refundAmount = order.totalAmount;
        refundType = "full";
      }
    } else if (policy.partialRefund) {
      const feePercent = parseFloat(policy.partialRefundFeePercent || 0);
      const fee = (order.totalAmount * feePercent) / 100;
      refundAmount = order.totalAmount - fee;
      refundType = "partial";
    } else if (policy.noRefundAfterPurchase) {
      refundAmount = 0;
      refundType = "none";
    } else if (policy.noRefundAfterDate && policy.noRefundDate) {
      const noRefundDate = new Date(policy.noRefundDate);
      if (today <= noRefundDate) {
        refundAmount = order.totalAmount;
        refundType = "dateBased";
      } else {
        refundAmount = 0;
        refundType = "none";
      }
    }

    if (clientRefundAmount && clientRefundAmount > 0) {
      refundAmount = clientRefundAmount;
    }

    if (typeof refundAmount !== 'number' || refundAmount <= 0 || refundAmount > order.totalAmount) {
      return res.status(400).json({ message: 'Invalid refund amount' });
    }

    // 5️⃣ If refund already exists, update it instead of creating a new one
    if (existingRequest) {
      // Only allow re-request if previous was rejected or cancelled
      if (!['rejected', 'cancelled'].includes(existingRequest.refundStatus)) {
        return res.status(400).json({
          message: `Refund is already ${existingRequest.refundStatus}. Cannot re-request.`,
        });
      }

      existingRequest.refundStatus = 'pending';
      existingRequest.reason = reason || existingRequest.reason;
      existingRequest.refundAmount = refundAmount;
      existingRequest.refundType = refundType;
      existingRequest.adminNotes = ''; // clear old rejection notes
      existingRequest.updatedAt = new Date();

      await existingRequest.save();

      // Update order status
      order.refundStatus = 'requestedRefund';
      await order.save({ validateModifiedOnly: true });

      return res.status(200).json({
        message: 'Refund request re-submitted successfully',
        request: existingRequest,
      });
    }

    // 6️⃣ Otherwise, create a new refund request (first time only)
    const newRequest = new RefundRequest({
      transactionId,
      userId,
      eventId: order.eventId,
      orderId,
      tickets: order.tickets,
      totalAmount: order.totalAmount,
      refundAmount,
      paymentMethod: order.paymentMethod,
      refundPolicy: policy,
      eventDate: event.date,
      reason,
      refundType,
      refundStatus: 'pending',
    });

    await newRequest.save();

    order.refundStatus = 'requestedRefund';
    await order.save();

    return res.status(201).json({
      message: 'Refund request submitted successfully',
      request: newRequest,
    });

  } catch (error) {
    console.error("Refund request error:", error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRefundsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const userRefunds = await RefundRequest.find({ userId });

    res.status(200).json(userRefunds);
  } catch (error) {
    console.error("Error fetching refund requests:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.refundRequestCancel = async (req, res) => {
  const { orderId } = req.body;
  try {
    const refund = await RefundRequest.findOne({ orderId }).populate('eventId');

    if (!refund) {
      return res.status(404).json({ message: 'Refund request not found' });
    }

    const eventDate = new Date(refund.eventId.date);
    const now = new Date();

    if (eventDate <= now) {
      return res.status(400).json({ message: 'Cannot cancel refund for expired event.' });
    }

    refund.refundStatus = 'cancelled';
    await refund.save();
    await EventOrder.findByIdAndUpdate(orderId, { refundStatus: 'none' });
    res.json({ message: 'Refund request cancelled successfully.' });
  } catch (error) {
    console.error('Cancel refund error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const generateInvoicePDF = async ({ order, event }) => {
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

    // Header with background
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: primaryColor,
    });

    // Add Logo at the top left of the header
    try {
      const logoPath = path.join(__dirname, '../../assets/logo-mobile.png');
      const logoImage = await pdfDoc.embedPng(fs.readFileSync(logoPath));

      const logoWidth = 50;
      const logoHeight = 50;

      const logoX = 50;
      const logoY = height - 50 - logoHeight / 2;

      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (logoError) {
      console.warn('Could not load logo, continuing without it:', logoError.message);
    }

    // Invoice Title
    page.drawText('INVOICE', {
      x: width / 2 - 40,
      y: height - 50,
      size: 24,
      font: titleFont,
      color: rgb(1, 1, 1),
    });

    // Invoice Number and Status
    page.drawText(`Invoice #: ${_id.toString().substring(0, 12)}...`, {
      x: width - 200,
      y: height - 80,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Status: ${paymentStatus.toUpperCase()}`, {
      x: width - 200,
      y: height - 95,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    let yPosition = height - 130;

    // Invoice Details Section
    const drawInvoiceSection = (title, content, startY) => {
      let currentY = startY;
      currentY -= 20;

      // Section title
      page.drawText(title, {
        x: 50,
        y: currentY,
        size: 16,
        font: boldFont,
        color: primaryColor,
      });
      currentY -= 25;

      // Calculate section height
      const sectionHeight = (content.length * 20) + 30;

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

      // Content
      content.forEach(item => {
        if (item.label && item.value) {
          page.drawText(item.label, {
            x: 55,
            y: currentY,
            size: 11,
            font: boldFont,
            color: textColor,
          });

          page.drawText(item.value, {
            x: 200,
            y: currentY,
            size: 11,
            font: regularFont,
            color: textColor,
          });
        }
        currentY -= 20;
      });

      return currentY - 10;
    };

    // Event Details (Simplified for invoice)
    const eventDetails = [
      { label: 'Event:', value: eventName || 'N/A' },
      { label: 'Date:', value: date || 'N/A' },
      { label: 'Time:', value: time || 'N/A' },
      { label: 'Venue:', value: location || 'N/A' },
    ];

    yPosition = drawInvoiceSection('Event Information', eventDetails, yPosition);

    // Billing Information
    const billingDetails = [
      { label: 'Invoice Date:', value: new Date(createdAt).toLocaleDateString() },
      { label: 'Transaction ID:', value: transactionId || 'N/A' },
      { label: 'Payment Method:', value: paymentMethod ? paymentMethod.replace('_', ' ').toUpperCase() : 'N/A' },
    ];

    // Add customer information if available
    if (orderAddress?.name || userId?.name) {
      billingDetails.unshift({
        label: 'Customer:',
        value: orderAddress?.name || userId?.name || 'N/A'
      });
    }

    yPosition = drawInvoiceSection('Billing Information', billingDetails, yPosition);

    // Items Table (Tickets)
    const drawItemsTable = (headers, columnWidths, data, startY) => {
      let currentY = startY;
      currentY -= 20;

      // Table title
      page.drawText('Items', {
        x: 50,
        y: currentY,
        size: 16,
        font: boldFont,
        color: primaryColor,
      });
      currentY -= 25;

      const tableStartX = 50;
      const totalTableWidth = columnWidths.reduce((a, b) => a + b, 0);

      // Table header background
      page.drawRectangle({
        x: tableStartX,
        y: currentY - 25,
        width: totalTableWidth,
        height: 25,
        color: primaryColor,
      });

      // Header text
      headers.forEach((header, i) => {
        const columnX = tableStartX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        page.drawText(header, {
          x: columnX + 10,
          y: currentY - 15,
          size: 11,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
      });

      currentY -= 30;

      // Data rows
      data.forEach((item, index) => {
        const rowColor = index % 2 === 0 ? rgb(1, 1, 1) : secondaryColor;

        page.drawRectangle({
          x: tableStartX,
          y: currentY - 20,
          width: totalTableWidth,
          height: 20,
          color: rowColor,
        });

        item.forEach((text, i) => {
          const columnX = tableStartX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
          page.drawText(text, {
            x: columnX + 10,
            y: currentY - 12,
            size: 10,
            font: regularFont,
            color: textColor,
          });
        });

        currentY -= 22;
      });

      return currentY - 15;
    };

    // Items Table Data
    const itemHeaders = ['Description', 'Quantity', 'Unit Price', 'Amount'];
    const itemColumnWidths = [250, 80, 100, 100];

    const itemData = [];
    let subtotal = 0;

    tickets.forEach((ticket) => {
      const ticketTotal = ticket.quantity * ticket.unitPrice;
      subtotal += ticketTotal;

      itemData.push([
        `Ticket: ${ticket.ticketType}`,
        ticket.quantity.toString(),
        `${ticket.unitPrice.toFixed(0)} XAF`,
        `${ticketTotal.toFixed(0)} XAF`
      ]);
    });

    yPosition = drawItemsTable(itemHeaders, itemColumnWidths, itemData, yPosition);

    // Total Section
    yPosition -= 20;
    const totalSectionX = 50 + itemColumnWidths.slice(0, 2).reduce((a, b) => a + b, 0);
    const totalSectionWidth = itemColumnWidths.slice(2).reduce((a, b) => a + b, 0);

    // Subtotal
    page.drawText('Subtotal:', {
      x: totalSectionX + 10,
      y: yPosition,
      size: 11,
      font: boldFont,
      color: textColor,
    });

    page.drawText(`${subtotal.toFixed(0)} XAF`, {
      x: totalSectionX + itemColumnWidths[2] + 10,
      y: yPosition,
      size: 11,
      font: regularFont,
      color: textColor,
    });

    yPosition -= 20;

    // Total
    page.drawRectangle({
      x: totalSectionX,
      y: yPosition - 25,
      width: totalSectionWidth,
      height: 25,
      color: primaryColor,
    });

    page.drawText('TOTAL:', {
      x: totalSectionX + 10,
      y: yPosition - 15,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    page.drawText(`${totalAmount.toFixed(0)} XAF`, {
      x: totalSectionX + itemColumnWidths[2] + 10,
      y: yPosition - 15,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // Footer
    page.drawText('Thank you for your business!', {
      x: width / 2 - 80,
      y: 60,
      size: 10,
      font: regularFont,
      color: textColor,
    });

    page.drawText(`Invoice generated on: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 40,
      size: 8,
      font: regularFont,
      color: textColor,
    });

    // Terms and Conditions
    page.drawText('Terms & Conditions: This is an automated invoice. Please contact support for any discrepancies.', {
      x: 50,
      y: 20,
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
// const generateInvoicePDF = async ({ order, event }) => {
//   const pdfDoc = await PDFDocument.create();

//   const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
//   const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

//   // Create an A4 size page (595.28 x 841.89 points)
//   const page = pdfDoc.addPage([595.28, 841.89]);
//   const { width, height } = page.getSize();

//   // Helper to capitalize first letter
//   const capitalizeFirstLetter = (str) => {
//     if (!str) return '';
//     return str.charAt(0).toUpperCase() + str.slice(1);
//   };

//   // Start y position from top of the page
//   let yPosition = height - 50;

//   // Header
//   page.drawText('INVOICE', {
//     x: 50,
//     y: yPosition,
//     size: 24,
//     font: boldFont,
//     color: rgb(0, 0, 0),
//   });
//   yPosition -= 30;

//   page.drawText(`Invoice for Order ID: ${order._id}`, {
//     x: 50,
//     y: yPosition,
//     size: 12,
//     font: helveticaFont,
//     color: rgb(0, 0, 0),
//   });
//   yPosition -= 20;

//   page.drawText(`Event: ${capitalizeFirstLetter(event.eventName)}`, {
//     x: 50,
//     y: yPosition,
//     size: 12,
//     font: helveticaFont,
//     color: rgb(0, 0, 0),
//   });
//   yPosition -= 20;

//   page.drawText(`Event Date: ${new Date(event.date).toLocaleDateString()}`, {
//     x: 50,
//     y: yPosition,
//     size: 12,
//     font: helveticaFont,
//     color: rgb(0, 0, 0),
//   });
//   yPosition -= 30;

//   // Table Headers & styling
//   const headers = ['#Item', 'Ticket Type', 'Quantity', 'Unit Price', 'Total Price'];
//   const columnWidths = [60, 180, 60, 90, 90];
//   const startX = 50;

//   // Draw header background rectangle
//   page.drawRectangle({
//     x: startX,
//     y: yPosition - 15,
//     width: columnWidths.reduce((a, b) => a + b, 0),
//     height: 20,
//     color: rgb(0.9, 0.9, 0.9),
//   });

//   // Draw header texts
//   headers.forEach((header, i) => {
//     const colX = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
//     page.drawText(header, {
//       x: colX + 5,
//       y: yPosition - 10,
//       size: 12,
//       font: boldFont,
//       color: rgb(0, 0, 0),
//     });
//   });

//   yPosition -= 35;

//   // Draw rows for tickets
//   order.tickets.forEach((ticket, index) => {
//     const rowHeight = 20;
//     const colXPositions = columnWidths.reduce((acc, w, i) => {
//       acc.push(startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0));
//       return acc;
//     }, []);

//     // Draw row background for alternating rows
//     if (index % 2 === 0) {
//       page.drawRectangle({
//         x: startX,
//         y: yPosition - rowHeight + 5,
//         width: columnWidths.reduce((a, b) => a + b, 0),
//         height: rowHeight,
//         color: rgb(0.95, 0.95, 0.95),
//       });
//     }

//     // Prepare row data
//     const rowData = [
//       (index + 1).toString(),
//       capitalizeFirstLetter(ticket.ticketType),
//       ticket.quantity.toString(),
//       `XAF ${ticket.unitPrice.toFixed(2)}`,
//       `XAF ${(ticket.unitPrice * ticket.quantity).toFixed(2)}`,
//     ];

//     // Draw row text
//     rowData.forEach((text, i) => {
//       page.drawText(text, {
//         x: colXPositions[i] + 5,
//         y: yPosition - 15,
//         size: 12,
//         font: helveticaFont,
//         color: rgb(0, 0, 0),
//       });
//     });

//     yPosition -= rowHeight;
//   });

//   yPosition -= 10;

//   // Draw total amount line
//   page.drawText(`Total Amount: XAF ${order.totalAmount.toFixed(2)}`, {
//     x: startX + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0),
//     y: yPosition - 10,
//     size: 14,
//     font: boldFont,
//     color: rgb(0, 0, 0),
//   });

//   yPosition -= 40;

//   // Payment Method uppercase
//   page.drawText(`Payment Method: ${order.paymentMethod.toUpperCase()}`, {
//     x: startX,
//     y: yPosition,
//     size: 12,
//     font: helveticaFont,
//     color: rgb(0, 0, 0),
//   });

//   yPosition -= 20;

//   // Footer
//   page.drawText('Thank you for your business!', {
//     x: width / 2 - 100,
//     y: 50,
//     size: 14,
//     font: boldFont,
//     color: rgb(0, 0, 0),
//   });

//   // Return the PDF bytes
//   return await pdfDoc.save();
// };

exports.downloadInvoice = async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await EventOrder.findById(orderId)
      .populate('userId', 'name email number gender')
      .exec();
    console.log("Fetched order:", order);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const event = await Event.findById(order.eventId)
      .select('eventName _id date time category location description formate');
    console.log("Fetched event:", event);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Add a basic test if the function exists
    if (typeof generateInvoicePDF !== "function") {
      console.error("generateInvoicePDF is not defined or not a function");
      return res.status(500).json({ message: 'Invoice generator not found' });
    }

    const pdfBytes = await generateInvoicePDF({ order, event });
    console.log("PDF generated successfully");

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order._id}.pdf`
    );

    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download Invoice Error:', error);
    res.status(500).json({
      message: 'Error generating invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.refReqApproveDeny = async (req, res) => {
  const refundReqId = req.params.id;
  const { status, adminNotes } = req.body; // status: 'approve' or 'deny'

  try {
    // Validate input
    if (!refundReqId) {
      return res.status(400).json({
        success: false,
        message: 'Refund request ID is required'
      });
    }

    if (!status || !['processed', 'deny'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status is required and must be either "approve" or "deny"'
      });
    }

    // Find the refund request
    const refundRequest = await RefundRequest.findById(refundReqId)
      .populate('userId', 'name email')
      .populate('eventId', 'title organizerId')
      .populate('orderId');

    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }

    // Check if refund request is already processed
    if (refundRequest.refundStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Refund request has already been ${refundRequest.refundStatus}`
      });
    }

    // Prepare update data based on status
    let updateData = {};

    if (status === 'processed') {
      updateData = {
        refundStatus: 'processed',
        isAdminForwrd: true,
        adminActionAt: new Date(),
        adminNotes: adminNotes || ''
      };
    } else if (status === 'deny') {
      updateData = {
        refundStatus: 'rejected',
        adminActionAt: new Date(),
        adminNotes: adminNotes || 'Refund request denied by organizer...'
      };
    }

    // Update refund request
    const updatedRefundRequest = await RefundRequest.findByIdAndUpdate(
      refundReqId,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'name email')
      .populate('eventId', 'title')
      .populate('orderId');

    // If approved, you might want to trigger additional actions
    // if (status === 'approve') {
    //   await handleApprovedRefund(updatedRefundRequest);
    // }

    // If denied, you might want to notify the user
    // if (status === 'deny') {
    //   await handleDeniedRefund(updatedRefundRequest);
    // }

    res.status(200).json({
      success: true,
      message: `Refund request ${status === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: updatedRefundRequest
    });

  } catch (error) {
    console.error('Error processing refund request:', error);

    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid refund request ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while processing refund request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getAdminForwardedRefunds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter - only get records where isAdminForwrd is true
    const filter = { isAdminForwrd: true };

    // Optional status filter
    if (status && status !== 'all') {
      filter.refundStatus = status;
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const refundRequests = await RefundRequest.find(filter)
      .populate('userId', 'name email avatar number')
      .populate('eventId', 'title image date venue organizerId')
      .populate('orderId', 'orderNumber totalAmount paymentMethod createdAt')
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const total = await RefundRequest.countDocuments(filter);

    // Format response data
    const formattedData = refundRequests.map(request => ({
      _id: request._id,
      user: {
        _id: request.userId._id,
        name: request.userId.name,
        email: request.userId.email,
        avatar: request.userId.avatar,
        phone: request.userId.number
      },
      event: {
        _id: request.eventId._id,
        title: request.eventId.title,
        image: request.eventId.image,
        date: request.eventId.date,
        venue: request.eventId.venue,
        organizerId: request.eventId.organizerId
      },
      order: {
        _id: request.orderId._id,
        orderNumber: request.orderId.orderNumber,
        totalAmount: request.orderId.totalAmount,
        paymentMethod: request.orderId.paymentMethod,
        createdAt: request.orderId.createdAt
      },
      tickets: request.tickets,
      transactionId: request.transactionId,
      totalAmount: request.totalAmount,
      refundAmount: request.refundAmount,
      paymentMethod: request.paymentMethod,
      reason: request.reason,
      refundPolicy: request.refundPolicy,
      eventDate: request.eventDate,
      refundStatus: request.refundStatus,
      isAdminForwrd: request.isAdminForwrd,
      adminNotes: request.adminNotes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Admin forwarded refund requests retrieved successfully',
      formattedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      filters: {
        status: status || 'all',
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error fetching admin forwarded refunds:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching refund requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Notification helper function
const sendRefundNotification = async (refundRequest, action) => {
  try {
    // Implement your notification logic here
    // This could be email, push notification, in-app notification, etc.

    const user = refundRequest.userId;
    const event = refundRequest.eventId;

    const message = action === 'approved'
      ? `Your refund request for "${event.title}" has been approved. Amount: ${refundRequest.refundAmount}`
      : `Your refund request for "${event.title}" has been denied.`;

    console.log(`Notification sent to ${user.email}: ${message}`);

    // Example email sending (pseudo-code)
    // await emailService.sendRefundNotification(user.email, message, action);

  } catch (error) {
    console.error('Error sending refund notification:', error);
  }
};

// Optional: Get refund request details
exports.getRefundRequest = async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id)
      .populate('userId', 'name email avatar')
      .populate('eventId', 'title image date venue')
      .populate('orderId', 'orderNumber totalAmount paymentStatus');

    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: refundRequest
    });

  } catch (error) {
    console.error('Error fetching refund request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const generateRefundInvoice = async (refundRequest, user, order, refundTransactionId) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const primaryColor = rgb(0.07, 0.18, 0.29);
    const secondaryColor = rgb(0.12, 0.56, 0.80);
    const successColor = rgb(0.20, 0.63, 0.33);

    // HEADER
    page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: primaryColor });
    page.drawText("TICK-M-EVENT", { x: 50, y: height - 60, size: 24, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText("Refund Invoice", { x: 50, y: height - 90, size: 18, font: boldFont, color: rgb(1, 1, 1) });

    let y = height - 160;

    // INVOICE IDENTIFIERS
    page.drawText(`Refund ID: ${refundRequest._id}`, { x: 50, y, size: 10, font: boldFont, color: primaryColor });
    y -= 15;
    page.drawText(`Transaction ID: ${refundRequest.refundTransactionId || refundTransactionId || "N/A"}`, {
      x: 50, y, size: 10, font, color: primaryColor
    });
    y -= 15;
    page.drawText(`Order ID: ${refundRequest.orderId?._id || "N/A"}`, { x: 50, y, size: 10, font, color: primaryColor });
    y -= 15;
    page.drawText(`Event ID: ${refundRequest.eventId || "N/A"}`, { x: 50, y, size: 10, font, color: primaryColor });
    y -= 15;
    page.drawText(`Payment Method: ${refundRequest.paymentMethod || "N/A"}`, { x: 50, y, size: 10, font, color: primaryColor });
    y -= 15;
    page.drawText(`Refund Date: ${new Date(refundRequest.updatedAt).toLocaleString()}`, {
      x: 50, y, size: 10, font, color: primaryColor
    });

    // CUSTOMER SECTION
    y -= 40;
    const left = 50;
    const right = 300;

    page.drawText("CUSTOMER INFORMATION", { x: left, y, size: 12, font: boldFont, color: secondaryColor });
    y -= 20;

    const customerInfo = [
      ["Name", user.name || "N/A"],
      ["Email", user.email],
      ["Phone", user.number || user.phone || "N/A"],
      ["User ID", user._id]
    ];

    customerInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, { x: left, y, size: 10, font: boldFont, color: primaryColor });
      page.drawText(value.toString(), { x: left + 100, y, size: 10, font });
      y -= 15;
    });

    // REFUND DETAILS
    y -= 30;
    page.drawText("REFUND DETAILS", { x: left, y, size: 14, font: boldFont, color: secondaryColor });
    y -= 25;

    const items = [
      ["Original Payment Amount", `${refundRequest.totalAmount || order?.totalAmount || 0} XAF`],
      ["Refund Amount", `${refundRequest.refundAmount || 0} XAF`],
      ["Processing Fee", `${(refundRequest.totalAmount || 0) - (refundRequest.refundAmount || 0)} XAF`],
      ["Refund Reason", refundRequest.reason || "N/A"],
      ["Admin Notes", refundRequest.adminNotes || "N/A"]
    ];

    items.forEach(([desc, value]) => {
      page.drawText(desc, { x: left, y, size: 10, font });
      page.drawText(value.toString(), { x: right + 50, y, size: 10, font });
      y -= 15;
    });

    // TOTAL
    y -= 25;
    page.drawText("TOTAL REFUND AMOUNT:", { x: left, y, size: 12, font: boldFont, color: primaryColor });
    page.drawText(`${refundRequest.refundAmount || 0} XAF`, {
      x: right + 50, y, size: 12, font: boldFont, color: successColor
    });

    // SAVE PDF
    const pdfBytes = await pdfDoc.save();
    const invoicesDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const invoicePath = path.join(invoicesDir, `refund_invoice_${refundRequest._id}.pdf`);
    fs.writeFileSync(invoicePath, pdfBytes);

    return invoicePath;
  } catch (err) {
    console.error("PDF generation error:", err);
    return null;
  }
};


exports.updateRefundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundStatus, adminNotes, refundTransactionId } = req.body;

    const refundRequest = await RefundRequest.findById(id).populate("userId").populate("orderId");
    if (!refundRequest) return res.status(404).json({ message: "Refund request not found" });

    if (refundStatus) refundRequest.refundStatus = refundStatus;
    if (adminNotes !== undefined) refundRequest.adminNotes = adminNotes;
    if (refundTransactionId) refundRequest.refundTransactionId = refundTransactionId;
    refundRequest.updatedAt = new Date();
    await refundRequest.save();

    let attachmentPath = null;
    if (refundStatus === "refunded") {
      attachmentPath = await generateRefundInvoice(refundRequest, refundRequest.userId, refundRequest.orderId, refundTransactionId);
    }

    if (refundStatus === "refunded" || refundStatus === "rejected") {

      await sendRefundEmail(refundRequest.userId, refundRequest, refundStatus, refundTransactionId, attachmentPath);
    }

    return res.status(200).json({
      message: "Refund request updated successfully",
      refundRequest,
    });
  } catch (err) {
    console.error("Error updating refund:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};