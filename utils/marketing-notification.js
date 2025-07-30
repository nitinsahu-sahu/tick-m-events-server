const { sendMail } = require('./Emails');

const sendBulkEmails = async (users, subject, message, cta, eventDetails, template = 'default') => {
    try {
        for (const user of users) {
            const { email, name = 'there' } = user;

            if (!email) {
                console.warn('User missing email, skipping:', user);
                continue;
            }

            const formattedDate = new Date(eventDetails.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const formattedTime = new Date(eventDetails.date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            let htmlContent;

            switch (template) {
                case 'interested-participants':
                    htmlContent = `
                        <p>Hi <strong>${name}</strong>,</p>
                        <p>We noticed you showed interest in <strong>${eventDetails.name}</strong> but haven't booked yet.</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${formattedTime}</p>
                        <p><strong>Location:</strong> ${eventDetails.location}</p>
                        <br/>
                        <p>${message}</p>
                        ${cta ? `<p><a href="${cta.url || '#'}" style="padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">${cta.text || 'Book Now'}</a></p>` : ''}
                        <p>Cheers,<br/>Tick-M Events Team</p>
                    `;
                    break;

                case 'default':
                default:
                    htmlContent = `
                        <p>Hi <strong>${name}</strong>,</p>
                        <p>You're invited to <strong>${eventDetails.name}</strong>!</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Location:</strong> ${eventDetails.location}</p>
                        <p><strong>Time:</strong> ${formattedTime}</p>
                        <br/>
                        <p>${message}</p>
                        ${cta ? `<p><a href="${cta.url || '#'}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">${cta.text || cta}</a></p>` : ''}
                        <p>Warm regards,<br/>Tick-M Events Team</p>
                    `;
                    break;
            }

            const to = name ? `${name} <${email}>` : email;
            await sendMail(to, subject, htmlContent);
        }

        return true;
    } catch (error) {
        console.error('Error in sendBulkEmails:', error);
        throw error;
    }
};

module.exports = {
    sendMail,
    sendBulkEmails,
};
