const SocialMediaPost = require('../../models/marketing-engagement/social-media-post');
const cloudinary = require('cloudinary').v2;

exports.createSocialMediaPost = async (req, res) => {
  try {
    const { eventId, platform, description, reservationLink, hashtag } = req.body;
    const imageFile = req.files?.image;  // expecting file upload in req.files.image

    if (!imageFile) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // Upload image to Cloudinary in folder "eventPost"
    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinary.uploader.upload(imageFile.tempFilePath, {
        folder: "eventPost",
        resource_type: "auto",
      });
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({ message: "Failed to upload image", error: uploadError.message });
    }
    const post = await SocialMediaPost.create({
      event: eventId,
      createdBy: req.user._id,
      platform,
      description,
      reservationLink,
      hashtag,
      imageUrl: cloudinaryResult.secure_url,

    });

    res.status(201).json({ message: 'Post saved successfully', post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save post', error: err.message });
  }
};

exports.getSocialSharePage = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = {
      eventName: "Amazing Event 2025",
      description: "Join us for an unforgettable experience! Get your tickets now!",
      imageUrl: "https://res.cloudinary.com/dm624gcgg/image/upload/v1753272264/eventPost/zzhowyjob3xadnure9n1.jpg",
      shareUrl: `https://tick-m-events.verel.app/post/${postId}`,
      redirectUrl: "https://tick-m-events.vercel.app/our-event"
    };

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta property="og:title" content="${post.eventName}" />
  <meta property="og:description" content="${post.description}" />
  <meta property="og:image" content="${post.imageUrl}" />
  <meta property="og:url" content="${post.shareUrl}" />
  <meta property="og:type" content="website" />
  <title>${post.eventName}</title>
</head>
<body>
  <h1>Redirecting…</h1>
  <script>
    window.location.href = '${post.redirectUrl}';
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('getSocialSharePage error:', error);
    res.status(500).send('Something went wrong');
  }
};
