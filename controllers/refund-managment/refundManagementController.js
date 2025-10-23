const UserServiceRequest = require('../../models/profile-service-maagement/add-service');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

exports.submitRefundRequest = async (req, res) => {
  try {
    const { userId, orderId, reason, refundAmount: clientRefundAmount } = req.body;
 
    // 1. Validate Order and ownership
    const order = await EventOrder.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }
 
    const transactionId = order.transactionId;
     
    // 2. Validate Event
    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found' });
    }
 
    // 3. Prevent duplicate refund requests
    const existingRequest = await RefundRequest.findOne({
      transactionId,
      userId,
      orderId,
      refundStatus: { $ne: 'cancelled' }
    });
    if (existingRequest) {
      return res.status(400).json({ message: 'Refund already requested for this order' });
    }
 
    // 4. Determine refund amount dynamically
    const policy = order.refundPolicy || {};
    const today = new Date();
    const eventDate = new Date(event.date);
    let refundAmount = 0;
    let refundType = req.body.refundType || "manual";
 
    // ---- Case 1: Full refund up to X days before ----
    if (policy.fullRefund) {
      const fullRefundDaysBefore = parseInt(policy.fullRefundDaysBefore || "0");
      const daysBeforeEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
      if (daysBeforeEvent >= fullRefundDaysBefore) {
        refundAmount = order.totalAmount;
        refundType = "full";
      }
    }
 
    // ---- Case 2: Partial refund with fee ----
    else if (policy.partialRefund) {
      const feePercent = parseFloat(policy.partialRefundFeePercent || 0);
      const fee = (order.totalAmount * feePercent) / 100;
      refundAmount = order.totalAmount - fee;
      refundType = "partial";
    }
 
    // ---- Case 3: No refund after ticket purchase ----
    else if (policy.noRefundAfterPurchase) {
      refundAmount = 0;
      refundType = "none";
    }
 
    // ---- Case 4: No refund after a set date (your current scenario) ----
    else if (policy.noRefundAfterDate && policy.noRefundDate) {
      const noRefundDate = new Date(policy.noRefundDate);
      if (today <= noRefundDate) {
        refundAmount = order.totalAmount; // ✅ Full refund before cutoff date
        refundType = "dateBased";
      } else {
        refundAmount = 0; // After cutoff → no refund
        refundType = "none";
      }
    }
 
    // ---- Override with frontend value if explicitly provided ----
    if (clientRefundAmount && clientRefundAmount > 0) {
      refundAmount = clientRefundAmount;
    }
 
    // 5. Validate final refund amount
    if (typeof refundAmount !== 'number' || refundAmount <= 0 || refundAmount > order.totalAmount) {
      return res.status(400).json({ message: 'Invalid refund amount' });
    }
 
    // 6. Create refund request
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
 
    // Update order status
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

exports.updateRefundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundStatus, adminNotes,refundTransactionId} = req.body;
 
    // Validate input
    if (!refundStatus && adminNotes === undefined) {
      return res.status(400).json({ message: 'Please provide refundStatus or adminNotes' });
    }
 
    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      return res.status(404).json({ message: 'Refund request not found' });
    }
 
    // Update fields
    if (refundStatus) refundRequest.refundStatus = refundStatus;
    if (adminNotes !== undefined) refundRequest.adminNotes = adminNotes;
 
    if (refundTransactionId) refundRequest.refundTransactionId = refundTransactionId;
    
    refundRequest.updatedAt = new Date();
 
    await refundRequest.save();
 
    return res.status(200).json({
      message: 'Refund request updated successfully',
      refundRequest,
    });
  } catch (error) {  // 👈 use the same variable name inside
    console.error('Error updating refund request:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};