const UserServiceRequest = require('../../models/profile-service-maagement/add-service');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
 
exports.submitRefundRequest = async (req, res) => {
  try {
    const { userId, orderId, reason, refundAmount } = req.body;
 
    // Validate Order and ownership
    const order = await EventOrder.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }
 
    // Validate Event
    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found' });
    }
 
    const existingRequest = await RefundRequest.findOne({ userId, orderId, refundStatus: { $ne: 'cancelled' }});
    if (existingRequest) {
      return res.status(400).json({ message: 'Refund already requested for this order' });
    }
 
    // Validate refundAmount
    if (typeof refundAmount !== 'number' || refundAmount <= 0 || refundAmount > order.totalAmount) {
      return res.status(400).json({ message: 'Invalid refund amount' });
    }
 
    // Create refund request
    const newRequest = new RefundRequest({
      userId,
      eventId: order.eventId,
      orderId,
      tickets: order.tickets,
      totalAmount: order.totalAmount,
      refundAmount,
      paymentMethod: order.paymentMethod,
      refundPolicy: order.refundPolicy,
      eventDate: event.date,
      reason,
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
  const pdfDoc = await PDFDocument.create();
 
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
 
  // Create an A4 size page (595.28 x 841.89 points)
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
 
  // Helper to capitalize first letter
  const capitalizeFirstLetter = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
 
  // Start y position from top of the page
  let yPosition = height - 50;
 
  // Header
  page.drawText('INVOICE', {
    x: 50,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;
 
  page.drawText(`Invoice for Order ID: ${order._id}`, {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 20;
 
  page.drawText(`Event: ${capitalizeFirstLetter(event.eventName)}`, {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 20;
 
  page.drawText(`Event Date: ${new Date(event.date).toLocaleDateString()}`, {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;
 
  // Table Headers & styling
  const headers = ['#Item', 'Ticket Type', 'Quantity', 'Unit Price', 'Total Price'];
  const columnWidths = [60, 180, 60, 90, 90];
  const startX = 50;
 
  // Draw header background rectangle
  page.drawRectangle({
    x: startX,
    y: yPosition - 15,
    width: columnWidths.reduce((a, b) => a + b, 0),
    height: 20,
    color: rgb(0.9, 0.9, 0.9),
  });
 
  // Draw header texts
  headers.forEach((header, i) => {
    const colX = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
    page.drawText(header, {
      x: colX + 5,
      y: yPosition - 10,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  });
 
  yPosition -= 35;
 
  // Draw rows for tickets
  order.tickets.forEach((ticket, index) => {
    const rowHeight = 20;
    const colXPositions = columnWidths.reduce((acc, w, i) => {
      acc.push(startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0));
      return acc;
    }, []);
 
    // Draw row background for alternating rows
    if (index % 2 === 0) {
      page.drawRectangle({
        x: startX,
        y: yPosition - rowHeight + 5,
        width: columnWidths.reduce((a, b) => a + b, 0),
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.95),
      });
    }
 
    // Prepare row data
    const rowData = [
      (index + 1).toString(),
      capitalizeFirstLetter(ticket.ticketType),
      ticket.quantity.toString(),
      `XAF ${ticket.unitPrice.toFixed(2)}`,
      `XAF ${(ticket.unitPrice * ticket.quantity).toFixed(2)}`,
    ];
 
    // Draw row text
    rowData.forEach((text, i) => {
      page.drawText(text, {
        x: colXPositions[i] + 5,
        y: yPosition - 15,
        size: 12,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    });
 
    yPosition -= rowHeight;
  });
 
  yPosition -= 10;
 
  // Draw total amount line
  page.drawText(`Total Amount: XAF ${order.totalAmount.toFixed(2)}`, {
    x: startX + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0),
    y: yPosition - 10,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
 
  yPosition -= 40;
 
  // Payment Method uppercase
  page.drawText(`Payment Method: ${order.paymentMethod.toUpperCase()}`, {
    x: startX,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
 
  yPosition -= 20;
 
  // Footer
  page.drawText('Thank you for your business!', {
    x: width / 2 - 100,
    y: 50,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
 
  // Return the PDF bytes
  return await pdfDoc.save();
};
 
exports.downloadInvoice = async (req, res) => {
  const orderId = req.params.id;
  console.log("Invoice download requested for orderId:", orderId);
 
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
 