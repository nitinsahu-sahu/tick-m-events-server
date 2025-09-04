const Messages = require('../../models/chat/chat.schema')
const User = require('../../models/User')
const Conversation = require('../../models/chat/conv.schema')
const cloudinary = require('cloudinary').v2;

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
exports.msgByConversationId = async (req, res) => {
  try {
    const checkMessages = async (conversationId) => {
      const messages = await Messages.find({ conversationId }).sort({ createdAt: 1 });
      const messageUserData = Promise.all(messages.map(async (message) => {
        const user = await User.findById(message.senderId);
        return {
          user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            profile: user.avatar
          },
          msgId: message._id,
          type: message.type,
          updatedAt: message.updatedAt,
          message: message.message,
          files: message.files,
          senderDeleteStatus: message.senderDeleteStatus,
          receiverDeleteStatus: message.receiverDeleteStatus
        }
      }));
      res.status(200).json(await messageUserData);
    }
    
    const conversationId = req.params.conversationId;
    if (conversationId === 'new') {
      const checkConversation = await Conversation.find({
        members: {
          $all: [
            req.query.senderId,
            req.query.receiverId
          ]
        }
      });
      
      if (checkConversation.length > 0) {
        checkMessages(checkConversation[0]._id);
      } else {
        return res.status(200).json([])
      }
    } else {
      checkMessages(conversationId);
    }
  } catch (error) {
    res.status(400).send({ errors: error.message });
  }
}

exports.sendMessage = async (req, res) => {
    try {
        const senderId = req.user._id;
        const { conversationId, message, receiverId = '', type,files } = req.body;
        

        // Determine message type
        let finalType = type;
        if (!finalType) {
            if (message && files.length) {
                finalType = 'mixed';
            } else if (files.length) {
                finalType = 'file';
            } else {
                finalType = 'text';
            }
        }

        // Handle new conversation case
        if (conversationId === 'new' && receiverId) {
            const newConversation = new Conversation({
                members: [senderId, receiverId],
                receiverId,
                senderId
            });
            await newConversation.save();

            const newMessage = new Messages({
                conversationId: newConversation._id,
                receiverId,
                senderId,
                message,
                files,
                type: finalType
            });

            await newMessage.save();

            // Populate user data for response
            const user = await User.findById(senderId);
            const messageWithUser = {
                ...newMessage.toObject(),
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    profile: user.avatar
                }
            };

            return res.status(200).json({
                success: true,
                message: 'Message sent successfully',
                data: messageWithUser,
                conversationId: newConversation._id
            });
        }
        else if (!conversationId && !receiverId) {
            return res.status(400).json({
                success: false,
                error: 'Please fill all required fields'
            });
        }

        // Handle existing conversation case
        const newMessage = new Messages({
            conversationId,
            senderId,
            message,
            files,
            type: finalType,
            receiverId
        });

        await newMessage.save();

        // Populate user data for response
        const user = await User.findById(senderId);
        const messageWithUser = {
            ...newMessage.toObject(),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                profile: user.avatar
            }
        };

        res.status(200).json({
            success: true,
            message: 'Message sent successfully',
            data: messageWithUser
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Helper function to determine file type from Cloudinary resource_type
function determineFileType(resourceType) {
    switch (resourceType) {
        case 'image': return 'image';
        case 'video': return 'video';
        case 'raw': return 'document';
        default: return 'document';
    }
}

exports.uploadsFile = async (req, res) => {
console.log(req.files);

    try {

        const files = req.files?.file;

        if (!files) {
            return res.status(400).json({
                success: false,
                message: "Please upload file..."
            });
        }
        const result = await cloudinary.uploader.upload(files.tempFilePath, {
            folder: 'msg_Files',
            crop: "scale"
        });

        res.status(200).send(result);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
}
