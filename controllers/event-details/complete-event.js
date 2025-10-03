const cloudinary = require('cloudinary').v2;
const Event = require('../../models/event-details/Event');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Visibility = require('../../models/event-details/Visibility');
const TicketConfiguration = require('../../models/event-details/Ticket');
const mongoose = require('mongoose');
const Activity = require('../../models/activity/activity.modal');

// controllers/eventController.js
exports.createCompleteEvent = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      // Step 1: Event Information
      eventName, date, time, category, eventType, location, format, description,
      name, number, email, website, whatsapp, linkedin, facebook, tiktok,
      
      // Step 2: Ticket Configuration
      tickets, payStatus, purchaseDeadlineDate, isPurchaseDeadlineEnabled,
      paymentMethods, isRefundPolicyEnabled, fullRefundCheck, partialRefundCheck,
      noRefundAfterDateCheck, fullRefundDaysBefore, partialRefundPercent, noRefundDate,
      
      // Step 3: Customization
      frame, themeColor, customColor,
      
      // Step 4: Publication
      autoShareOnSocialMedia, status, customUrl, visibilityType, homepageHighlighting,
      
      // Step tracking
      currentStep,
      isDraft = false
    } = req.body;

    const { coverImage, portraitImage, eventLogo } = req.files || {};

    // Validate required fields based on current step
    if (currentStep >= 1) {
      if (!eventName || !date || !time || !category || !location || !description) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Please fill all required fields in Step 1"
        });
      }
    }

    let event;
    let ticketConfig;
    let customization;
    let publication;

    // STEP 1: Create Event and Organizer
    if (currentStep >= 1) {
      // Upload cover image
      if (!coverImage) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Please upload a cover image"
        });
      }

      const coverResult = await cloudinary.uploader.upload(coverImage.tempFilePath, {
        folder: 'event_cover_images',
        width: 1000,
        crop: "scale"
      });

      // Upload portrait image if provided
      let portraitImageData = {};
      if (portraitImage) {
        const portraitResult = await cloudinary.uploader.upload(portraitImage.tempFilePath, {
          folder: 'event_portrait_images',
          width: 500,
          height: 500,
          crop: "fill"
        });
        portraitImageData = {
          public_id: portraitResult.public_id,
          url: portraitResult.secure_url
        };
      }

      // Create event
      event = await Event.create([{
        eventName,
        date,
        time,
        category,
        eventType,
        coverImage: {
          public_id: coverResult.public_id,
          url: coverResult.secure_url
        },
        location,
        format,
        description,
        portraitImage: portraitImageData,
        createdBy: req.user._id,
        status: isDraft ? 'draft' : 'in_progress'
      }], { session });

      event = event[0];

      // Create organizer
      await Organizer.create([{
        name,
        number,
        email,
        website,
        socialMedia: {
          "whatsapp": whatsapp,
          "linkedin": linkedin,
          "facebook": facebook,
          "tiktok": tiktok
        },
        eventId: event._id
      }], { session });
    }

    // STEP 2: Create Ticket Configuration
    if (currentStep >= 2 && event) {
      const ticketList = JSON.parse(tickets || '[]');
      
      const formattedTickets = ticketList.map(ticket => ({
        ticketType: ticket.ticketType,
        id: ticket.id,
        price: ticket.price,
        totalTickets: ticket.totalTickets,
        description: ticket.description,
        isLimitedSeat: ticket.isLimitedSeat ?? true,
        isLinkPramotion: ticket.isLinkPramotion ?? false,
      }));

      const refundPolicy = {
        fullRefund: fullRefundCheck,
        fullRefundDaysBefore,
        partialRefund: partialRefundCheck,
        partialRefundPercent,
        noRefundAfterDate: noRefundAfterDateCheck,
        noRefundDate,
      };

      // Calculate total ticket quantity
      const ticketQuantity = formattedTickets.reduce((sum, ticket) => {
        const ticketCount = parseInt(ticket.totalTickets.replace(/,/g, ''), 10);
        return sum + (isNaN(ticketCount) ? 0 : ticketCount);
      }, 0);

      // Update event with ticket quantity and pay status
      await Event.findByIdAndUpdate(
        { _id: event._id },
        { ticketQuantity, payStatus },
        { session, new: true }
      );

      // Create ticket configuration
      ticketConfig = await TicketConfiguration.create([{
        eventId: event._id,
        tickets: formattedTickets,
        purchaseDeadlineDate,
        isPurchaseDeadlineEnabled,
        paymentMethods: JSON.parse(paymentMethods || '[]'),
        refundPolicy,
        isRefundPolicyEnabled,
        payStatus,
        createdBy: req.user._id,
      }], { session });

      ticketConfig = ticketConfig[0];
    }

    // STEP 3: Create Customization
    if (currentStep >= 3 && event && ticketConfig) {
      let logoData = {};
      
      if (eventLogo) {
        const logoResult = await cloudinary.uploader.upload(eventLogo.tempFilePath, {
          folder: 'event_logos',
          width: 500,
          crop: "scale"
        });
        logoData = {
          public_id: logoResult.public_id,
          url: logoResult.secure_url
        };
      }

      customization = await Customization.create([{
        frame,
        eventId: event._id,
        ticketCustomId: ticketConfig._id,
        themeColor,
        customColor,
        eventLogo: logoData
      }], { session });

      customization = customization[0];
    }

    // STEP 4: Create Publication & Finalize
    if (currentStep >= 4 && event && ticketConfig && customization) {
      publication = await Visibility.create([{
        eventId: event._id,
        ticketCustomId: ticketConfig._id,
        eventCustomizationId: customization._id,
        status: isDraft ? 'draft' : status,
        customUrl,
        promotionAndHighlight: {
          homepageHighlighting,
          autoShareOnSocialMedia
        },
        visibilityType
      }], { session });

      publication = publication[0];

      // Update event status to completed
      await Event.findByIdAndUpdate(
        { _id: event._id },
        { status: isDraft ? 'draft' : 'published' },
        { session }
      );

      // Log activity
      await Activity.create([{
        userId: req.user._id,
        activityType: 'event_created',
        description: `${req.user.email} created event "${event.eventName}"`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          params: req.params,
          body: {
            ...req.body,
            password: undefined,
            newPassword: undefined,
            confirmPassword: undefined
          },
          query: req.query
        }
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: getSuccessMessage(currentStep, isDraft),
      eventId: event?._id,
      ticketConfigId: ticketConfig?._id,
      eventCustomizationId: customization?._id,
      currentStep: Math.min(currentStep + 1, 4)
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error creating event:", error);
    
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function for success messages
const getSuccessMessage = (currentStep, isDraft) => {
  const messages = {
    1: "Event information saved successfully",
    2: "Ticket configuration saved successfully", 
    3: "Event customization saved successfully",
    4: isDraft ? "Event saved as draft successfully" : "Event published successfully"
  };
  return messages[currentStep] || "Progress saved successfully";
};