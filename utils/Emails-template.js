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

exports.createEmailVerificationTemplate = (otp,otpExpires, name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 30px;
        }
        .header {
          color: #2c3e50;
          text-align: center;
          margin-bottom: 25px;
        }
        .otp-code {
          background: #f8f9fa;
          letter-spacing: 5px;
          padding: 15px 10px;
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          color: #e74c3c;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #7f8c8d;
          text-align: center;
        }
        .warning {
          color: #e74c3c;
          font-size: 14px;
          margin: 15px 0;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Verify Your Email Address</h2>
        </div>
        
        <p>Hello ${name},</p>
        
        <p>Thank you for registering with us. To complete your email verification, please use the following One-Time Password (OTP):</p>
        
        <div class="otp-code">${otp}</div>
        
        <p class="warning">⚠️ This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
        
        <p>If you didn't request this verification, please ignore this email or contact our support team immediately.</p>
        
        <div class="footer">
          <p>Best regards,<br>The Support Team</p>
          <p>© ${new Date().getFullYear()} Tick-m Events. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};