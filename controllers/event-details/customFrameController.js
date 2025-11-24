const CustomPhotoFrame = require('../../models/event-details/CustomPhotoFrame');
const cloudinary = require('cloudinary').v2;

exports.saveEventFrame = async (req, res) => {
  try {
    const { eventId } = req.body;
    const file = req.files?.frame;

    // Basic validations
    if (!eventId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and frame image file are required',
      });
    }
    if (file.mimetype !== 'image/png') {
      return res.status(400).json({
        success: false,
        message: 'Only PNG images are allowed.',
      });
    }

    // Upload to Cloudinary
    let uploadResult;
    try {
      uploadResult = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'eventFrames',
        resource_type: 'image',
      });
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload frame image to Cloudinary',
      });
    }

    const frameUrl = uploadResult.secure_url;

    // Check for existing frame entry
    let frameDoc = await CustomPhotoFrame.findOne({ eventId });

    if (frameDoc) {
      const alreadyExists = frameDoc.frameUrls.includes(frameUrl);
      if (alreadyExists) {
        return res.status(409).json({
          success: false,
          message: 'This frame already exists for the selected event.',
        });
      }

      frameDoc.frameUrls.push(frameUrl);
      await frameDoc.save();

      return res.status(200).json({
        success: true,
        message: 'Frame added successfully.',
        data: frameDoc,
      });
    }

    // Create new document
    const newDoc = await CustomPhotoFrame.create({
      eventId,
      frameUrls: [frameUrl],
      uploadedBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Frame saved successfully for new event.',
      data: newDoc,
    });

  } catch (error) {
    console.error('Error saving event frame:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while saving frame.',
      error: error.message,
    });
  }
};

exports.getFramesByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const frames = await CustomPhotoFrame.find({ eventId });

    res.status(200).json({ success: true, data: frames });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch frames', error });
  }
};

exports.selectedFarme = async (req, res) => {
  const { eventId, selectedFrameUrl } = req.body;

  if (!eventId || !selectedFrameUrl) {
    return res.status(400).json({ message: 'EventId and selectedFrameUrl are required.' });
  }

  try {
    const updated = await CustomPhotoFrame.findOneAndUpdate(
      { eventId },
      { selectedFrameUrl },
      { new: true, upsert: true }  // create if doesn't exist
    );

    res.status(200).json({ message: 'Selected frame updated.', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating selected frame.' });
  }
};

exports.deleteFrame = async (req, res) => {
  try {
    const { eventId, frameUrl } = req.query;
 
    if (!eventId || !frameUrl) {
      return res.status(400).json({ message: 'Missing eventId or frameUrl' });
    }
 
    // Find the CustomPhotoFrame document by eventId
    const frameDoc = await CustomPhotoFrame.findOne({ eventId });
 
    if (!frameDoc) {
      return res.status(404).json({ message: 'Frame document not found for this event' });
    }
 
    // Remove the frame URL from frameUrls
    frameDoc.frameUrls = frameDoc.frameUrls.filter(url => url !== frameUrl);
 
    // If the deleted URL was the selectedFrameUrl, clear it or set a fallback
    if (frameDoc.selectedFrameUrl === frameUrl) {
      frameDoc.selectedFrameUrl = frameDoc.frameUrls[0] || null;
    }
 
    await frameDoc.save();
 
    res.status(200).json({
      message: 'Frame deleted successfully',
      updatedUrls: frameDoc.frameUrls,
      selectedFrameUrl: frameDoc.selectedFrameUrl,
    });
  } catch (error) {
    console.error('Delete frame error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};