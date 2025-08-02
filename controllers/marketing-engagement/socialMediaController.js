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
    const post = await SocialMediaPost.findById(postId);
    if (!post) {
      return res.status(404).send("Post not found");
    }
 
    const eventName = "Event"; // or fetch from related Event DB
    const hashtag = post.hashtag || "#TickMEvents";
    const description = `${post.description || "Don't miss out!"} | Reserve here: ${post.reservationLink || shareUrl} | ${post.hashtag || "#TickMEvents"}`;
    const imageUrl = post.imageUrl || "https://via.placeholder.com/1200x630.png?text=Default+Image";
    const shareUrl = `https://tick-m-events.vercel.app/post/${postId}`;
    const redirectUrl = post.reservationLink || shareUrl;
    const userAgent = req.get("User-Agent") || "";
    const isBot = /facebookexternalhit|twitterbot|linkedinbot|WhatsApp|Slackbot|Discordbot|Googlebot/i.test(userAgent);
    const metaTags = `
  <meta property="og:title" content="${eventName}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="website" />
 
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${eventName}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
`;
 
 
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${metaTags}
  <title>${eventName}</title>
</head>
<body>
  <h1>${eventName}</h1>
  <p>${description}</p>
  <img src="${imageUrl}" alt="Event Image" style="max-width:100%; height:auto;" />
  ${isBot ? "" : `<script>window.location.href = '${redirectUrl}';</script>`}
</body>
</html>`);
  } catch (error) {
    console.error('getSocialSharePage error:', error);
    res.status(500).send('Something went wrong');
  }
};



