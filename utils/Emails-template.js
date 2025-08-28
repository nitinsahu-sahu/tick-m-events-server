exports.createBidStatusEmailTemplate = async (projectDetails, bidDetails, status, reason = null, acceptedAmount = null) => {
  const statusColor = status === 'accepted' ? '#4CAF50' : '#F44336';
  const statusText = status === 'accepted' ? 'Accepted' : 'Rejected';
  
  // Format milestones as a table if they exist
  const milestonesTable = bidDetails.milestones && bidDetails.milestones.length > 0 ? `
    <h4 style="margin-top: 20px; margin-bottom: 10px;">Milestones:</h4>
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Description</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Amount</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${bidDetails.milestones.map(milestone => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${milestone.description || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${milestone.amount || '0'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bid Status Update</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f9f9f9;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border-radius: 8px; 
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background-color: #0B2E4C; 
          color: white; 
          padding: 25px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
        }
        .content { 
          padding: 30px; 
        }
        .status-banner {
          background-color: ${statusColor};
          color: white;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
          margin-bottom: 25px;
          font-weight: bold;
          font-size: 18px;
        }
        .details-card {
          background-color: #f8f9fa;
          border-left: 4px solid #0B2E4C;
          padding: 20px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .detail-row {
          display: flex;
          margin-bottom: 10px;
        }
        .detail-label {
          font-weight: bold;
          min-width: 140px;
          color: #555;
        }
        .detail-value {
          flex: 1;
        }
        .message-box {
          background-color: #fff8e1;
          border-left: 4px solid #ffc107;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .signature-box {
          background-color: #e8f5e9;
          border-left: 4px solid #4CAF50;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
          text-align: center;
        }
        .footer { 
          margin-top: 30px; 
          font-size: 0.9em; 
          color: #666; 
          text-align: center;
          padding: 20px;
          background-color: #f5f5f5;
          border-top: 1px solid #e0e0e0;
        }
        .action-button {
          display: inline-block;
          background-color: #0B2E4C;
          color: white;
          padding: 12px 25px;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 15px;
          font-weight: bold;
        }
        .milestone-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        .milestone-table th, .milestone-table td {
          padding: 10px;
          border: 1px solid #ddd;
          text-align: left;
        }
        .milestone-table th {
          background-color: #f2f2f2;
        }
        @media (max-width: 600px) {
          .content {
            padding: 20px;
          }
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            margin-bottom: 5px;
          }
          .milestone-table {
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bid Status Update</h1>
        </div>
        <div class="content">
          <div class="status-banner">
            Your bid has been ${statusText}
          </div>
          
          <p>Dear ${bidDetails.providerName},</p>
          
          <p>Your bid for the project <strong>${projectDetails.eventName}</strong> has been <strong>${statusText}</strong>.</p>
          
          <div class="details-card">
            <h3 style="margin-top: 0;">Project Details</h3>
            <div class="detail-row">
              <span class="detail-label">Event Name:</span>
              <span class="detail-value">${projectDetails.eventName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Date:</span>
              <span class="detail-value">${projectDetails.eventDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Time:</span>
              <span class="detail-value">${projectDetails.eventTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Location:</span>
              <span class="detail-value">${projectDetails.eventLocation}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">${projectDetails.catName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Client Name:</span>
              <span class="detail-value">${projectDetails.orgName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Client Email:</span>
              <span class="detail-value">${projectDetails.orgEmail}</span>
            </div>
          </div>
          
          <div class="details-card">
            <h3 style="margin-top: 0;">Bid Details</h3>
            <div class="detail-row">
              <span class="detail-label">Your Bid Amount:</span>
              <span class="detail-value">$${bidDetails.bidAmt}</span>
            </div>
            ${status === 'accepted' && acceptedAmount ? `
            <div class="detail-row">
              <span class="detail-label">Accepted Amount:</span>
              <span class="detail-value">$${acceptedAmount}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Delivery Time:</span>
              <span class="detail-value">${bidDetails.deliveryTime} ${bidDetails.deliveryUnit}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Your Proposal:</span>
              <span class="detail-value">${bidDetails.proposal || 'No proposal provided'}</span>
            </div>
          </div>
          
          ${bidDetails.milestones && bidDetails.milestones.length > 0 ? `
          <div class="details-card">
            <h3 style="margin-top: 0;">Milestones</h3>
            <table class="milestone-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                ${bidDetails.milestones.map(milestone => `
                  <tr>
                    <td>${milestone.milestorneName || 'N/A'}</td>
                    <td>${milestone.amount || '0'} </td>
                    <td>${milestone.currency || 'XAF'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          ${status === 'rejected' && reason ? `
          <div class="message-box">
            <h4 style="margin-top: 0;">Reason for Rejection:</h4>
            <p>${reason}</p>
          </div>
          ` : ''}
          
          ${projectDetails.isSigned ? `
          <div class="signature-box">
            <h4 style="margin-top: 0; color: #2e7d32;">✓ Contract Signed</h4>
            <p>The project contract has been officially signed and is now legally binding.</p>
          </div>
          ` : ''}
          
          ${status === 'accepted' ? `
          <p>Congratulations! The client has accepted your bid. Next steps:</p>
          <ol>
            <li>Review the project requirements</li>
            <li>Contact the client to discuss details</li>
            <li>Begin work as agreed upon</li>
          </ol>
          ` : `
          <p>Don't be discouraged! We encourage you to:</p>
          <ul>
            <li>Continue bidding on other projects</li>
            <li>Refine your proposal approach</li>
            <li>Enhance your portfolio with relevant work</li>
          </ul>
          `}
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/projects" class="action-button">
              View My Projects
            </a>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <div class="footer">
            <p>Thank you for using our platform,</p>
            <p><strong>The ${process.env.APP_NAME || 'Tick-m Events'} Team</strong></p>
            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Tick-m Events'}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

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

exports.createEmailVerificationTemplate = (otp, otpExpires, name) => {
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