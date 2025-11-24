const Logo = require('../../../models/admin-payment/customization/logo');
const cloudinary = require('cloudinary').v2;

exports.uploadLogo = async (req, res) => {

  try {
    const { name, link } = req.body;
    const uploadedBy = req.user._id;

    // Validation
    if (!name || !link) {
      return res.status(400).json({
        success: false,
        message: 'Logo name and link are required'
      });
    }

    if (!req.files || !req.files.logo) {
      return res.status(400).json({
        success: false,
        message: 'Logo image is required'
      });
    }

    const logoFile = req.files.logo;

    // Validate file type
    const allowedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedFormats.includes(logoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Only PNG, JPEG, JPG, SVG, and WebP are allowed'
      });
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (logoFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 2MB'
      });
    }

    // Upload to Cloudinary with logo-specific settings
    // Upload image to Cloudinary with error handling
    let uploadResult;
    try {
      uploadResult = await cloudinary.uploader.upload(logoFile.tempFilePath, {
        folder: 'company-logos',
        transformation: [
          { width: 500, height: 500, crop: 'limit', quality: 'auto' },
          { format: 'auto' }
        ],
        allowed_formats: ['png', 'jpg', 'jpeg', 'svg'],
        crop: "scale"
      });
    } catch (uploadError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: "Failed to upload cover image",
        error: uploadError.message
      });
    }

    // Check if logo with same name already exists for this user
    const existingLogo = await Logo.findOne({
      name,
      uploadedBy
    });

    if (existingLogo) {
      // Delete the uploaded image from Cloudinary since we won't use it
      await cloudinary.uploader.destroy(uploadResult.public_id);

      return res.status(400).json({
        success: false,
        message: 'You already have a logo with this name'
      });
    }

    // Create logo record
    const logo = await Logo.create({
      name,
      link,
      uploadedBy,
      image: {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height
      }
    });

    // Populate user details if needed
    await logo.populate('uploadedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Logo uploaded successfully',
      logo: {
        _id: logo._id,
        name: logo.name,
        image: logo.image,
        link: logo.link,
        isActive: logo.isActive,
        uploadedBy: logo.uploadedBy,
        createdAt: logo.createdAt
      }
    });

  } catch (error) {
    console.error('Logo upload error:', error);

    // Handle specific errors
    if (error.message === 'Invalid image file') {
      return res.status(400).json({
        success: false,
        message: 'Invalid image file. Please upload a valid image.'
      });
    }

    // Handle Cloudinary errors
    if (error.message.includes('Cloudinary')) {
      return res.status(500).json({
        success: false,
        message: 'Error uploading image to cloud storage'
      });
    }

    // Handle duplicate entry
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Logo with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while uploading logo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getLogos = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    const filter = activeOnly === 'true' ? { isActive: true } : {};

    const logos = await Logo.find(filter)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: logos.length,
      logos
    });

  } catch (error) {
    console.error('Get logos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching logos'
    });
  }
};

exports.getLogo = async (req, res) => {
  try {
    const logo = await Logo.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .select('-__v');

    if (!logo) {
      return res.status(404).json({
        success: false,
        message: 'Logo not found'
      });
    }

    res.status(200).json({
      success: true,
      logo
    });

  } catch (error) {
    console.error('Get logo error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid logo ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching logo'
    });
  }
};

exports.updateLogo = async (req, res) => {
  try {
    const { name, link, isActive } = req.body;
    const logoId = req.params.id;

    const logo = await Logo.findById(logoId);
    if (!logo) {
      return res.status(404).json({
        success: false,
        message: 'Logo not found'
      });
    }

    // Check if user owns the logo or is admin
    if (logo.uploadedBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this logo'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (link) updateData.link = link;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    // Handle logo image update if a new file is provided
    if (req.files && req.files.logo) {
      const logoFile = req.files.logo;

      // Validate file type
      const allowedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!allowedFormats.includes(logoFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file format. Only PNG, JPEG, JPG, SVG, and WebP are allowed'
        });
      }

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (logoFile.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 2MB'
        });
      }

      // Upload new image to Cloudinary
      let uploadResult;
      try {
        uploadResult = await cloudinary.uploader.upload(logoFile.tempFilePath, {
          folder: 'company-logos',
          transformation: [
            { width: 500, height: 500, crop: 'limit', quality: 'auto' },
            { format: 'auto' }
          ],
          allowed_formats: ['png', 'jpg', 'jpeg', 'svg'],
          crop: "scale"
        });
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload new logo image",
          error: uploadError.message
        });
      }

      // Delete old image from Cloudinary
      try {
        await cloudinary.uploader.destroy(logo.image.public_id);
      } catch (deleteError) {
        console.error('Error deleting old logo from Cloudinary:', deleteError);
        // Continue with update even if old image deletion fails
      }

      // Add new image data to update
      updateData.image = {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height
      };
    }

    // Check for duplicate name if name is being updated
    if (name && name !== logo.name) {
      const existingLogo = await Logo.findOne({
        name,
        uploadedBy: req.user._id,
        _id: { $ne: logoId } // Exclude current logo from duplicate check
      });

      if (existingLogo) {
        // If we uploaded a new image but found a duplicate, delete the new image
        if (updateData.image) {
          try {
            await cloudinary.uploader.destroy(updateData.image.public_id);
          } catch (deleteError) {
            console.error('Error cleaning up uploaded image after duplicate check:', deleteError);
          }
        }

        return res.status(400).json({
          success: false,
          message: 'You already have a logo with this name'
        });
      }
    }

    const updatedLogo = await Logo.findByIdAndUpdate(
      logoId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    // Populate user details
    await updatedLogo.populate('uploadedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Logo updated successfully',
      logo: updatedLogo
    });

  } catch (error) {
    console.error('Update logo error:', error);

    // Handle specific errors
    if (error.message === 'Invalid image file') {
      return res.status(400).json({
        success: false,
        message: 'Invalid image file. Please upload a valid image.'
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid logo ID'
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Logo with this name already exists'
      });
    }

    // Handle Cloudinary errors
    if (error.message.includes('Cloudinary')) {
      return res.status(500).json({
        success: false,
        message: 'Error uploading image to cloud storage'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating logo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.deleteLogo = async (req, res) => {

  try {
    const logo = await Logo.findById(req.params.id);

    if (!logo) {
      return res.status(404).json({
        success: false,
        message: 'Logo not found'
      });
    }

    // Check if user owns the logo or is admin
    if (logo.uploadedBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this logo'
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(logo.image.public_id);

    // Delete from database
    await Logo.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Logo deleted successfully'
    });

  } catch (error) {

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid logo ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting logo'
    });
  }
};