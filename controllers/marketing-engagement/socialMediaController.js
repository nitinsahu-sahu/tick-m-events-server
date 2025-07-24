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


// exports.getSocialSharePage = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const post = await SocialMediaPost.findById(postId).populate('event');
//     if (!post) return res.status(404).send('Post not found');

//     const { description, reservationLink, hashtag, imageUrl, event } = post;
//     const eventName = event?.name || 'Amazing Event';
//     const eventDate = event?.date
//       ? new Date(event.date).toDateString()
//       : 'Coming Soon';
//     const fullDescription = `${description} - ${eventName} on ${eventDate}`;


//     const shareUrl =    `https://tick-m-events-server.onrender.com/api/v1/social-share/${postId}`;
//     const redirectUrl = `https://tick-m-events.vercel.app/our-event/${event._id}`;
//     // const shareUrl = `http://localhost:8000/api/v1/social-share/${postId}`;
//     // const redirectUrl = `http://localhost:3039/our-event/${event._id}`;

//     // Send clean template string
//     res.send(`<!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta property="og:title" content="${eventName}" />
//   <meta property="og:description" content="${fullDescription}" />
//   <meta property="og:image" content="${imageUrl}" />
//   <meta property="og:url" content="${shareUrl}" />
//   <meta property="og:type" content="website" />
//   <title>${eventName}</title>
// </head>
// <body>
//   <h1>Redirecting…</h1>
//   <script>
//     window.location.href = '${redirectUrl}';
//   </script>
// </body>
// </html>`);
//   } catch (error) {
//     console.error('getSocialSharePage error:', error);
//     res.status(500).send('Something went wrong');
//   }
// };

exports.getSocialSharePage = async (req, res) => {
  try {
    // Static data to test social share preview
    const eventName = "Test Event Title";
    const fullDescription = "This is a test description for the event preview.";
    const imageUrl = "https://via.placeholder.com/1200x630.png?text=Test+Image";
    const shareUrl = "https://tick-m-events-server.onrender.com/api/v1/social-share/static-test";
    const redirectUrl = "https://tick-m-events.vercel.app/our-event/static-test";

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta property="og:title" content="${eventName}" />
  <meta property="og:description" content="${fullDescription}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="website" />
  <title>${eventName}</title>
</head>
<body>
  <h1>Redirecting…</h1>
  <script>
    window.location.href = '${redirectUrl}';
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('getSocialSharePage error:', error);
    res.status(500).send('Something went wrong');
  }
};
