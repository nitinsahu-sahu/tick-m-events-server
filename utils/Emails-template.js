exports.createOrderEmailTemplate = async (order, userEmail, event) => {

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0B2E4C; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .ticket-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .ticket-table th { background-color: #f2f2f2; text-align: left; padding: 10px; }
        .ticket-table td { padding: 10px; border-bottom: 1px solid #ddd; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #666; }
        .qr-code { width: 100px; height: 100px; border: 1px solid #ddd; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Event Ticket Order Details</h1>
        </div>
        <div class="content">
          <p>Dear ${order?.orderAddress?.name},</p>
          <p>Thank you for your purchase! Here are your order details:</p>
           <h3>Event Information</h3>
           <p style="text-transform:capitalize"><strong>Event Name:</strong> ${event?.eventName}</p>
           <p><strong>Date:</strong> ${event?.date}</p>
           <p><strong>Time:</strong> ${event?.time}</p>
           <p><strong>Location:</strong> ${event?.location}</p>
          <h3>Order Summary</h3>
          <table class="ticket-table">
            <thead>
              <tr>
                <th>Ticket Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.tickets.map(ticket => `
                <tr>
                  <td>${ticket.ticketType}</td>
                  <td>${ticket.quantity}</td>
                  <td>${ticket.unitPrice}</td>
                  <td>${ticket.quantity * ticket.unitPrice}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p><strong>Total Amount:</strong> ${order.totalAmount}</p>
          <p><strong>Transaction ID:</strong> ${order.transactionId}</p>
          <p><strong>Ticket Code:</strong> ${order.ticketCode}</p>
          
          ${order.qrCode ? `
            <div style="margin: 20px 0;">
              <p><strong>Your QR Code:</strong></p>
              <img src="${order.qrCode}" alt="QR Code" class="qr-code"/>
            </div>
          ` : ''}
          
          <p>We look forward to seeing you at the event!</p>
          
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>Thank you,</p>
            <p>The Event Team</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

exports.createWithdrawalOTPTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Withdrawal Verification Code</h2>
      <p>Hello,</p>
      <p>Your OTP code for withdrawal is:</p>
      <h3 style="color: #007bff;">${otp}</h3>
      <p>This code is valid for 10 minutes.</p>
      <br/>
      <p>Thank you,<br/>Support Team</p>
    </div>
  `;
};