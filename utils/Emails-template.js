// Evemnt create HTML email template
exports.createOrderEmailTemplate = async (order, userEmail) => {
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
          
          <h3>Event Information</h3>
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
