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
            const messages = await Messages.find({ conversationId });
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await User.findById(message.senderId);
                return {
                    user: {
                        _id: user._id,
                        email: user.email,
                        fullname: user.fullname,
                        profile: user.profile
                    },
                    msgId: message._id,
                    type: message.type,
                    updatedAt: message.updatedAt,
                    message: message.message,
                    senderDeleteStatus: message.senderDeleteStatus,
                    receiverDeleteStatus: message.receiverDeleteStatus
                }
            }));
            res.status(200).json(await messageUserData);
        }
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const checkConversation = await Conversation.find(
                {
                    members: {
                        $all: [
                            req.query.senderId,
                            req.query.receiverId
                        ]
                    }
                }
            );
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
        console.log(req.files);
        console.log(req.body);

    try {
        const senderId = req.user._id;
        const { conversationId, message, receiverId = '', type } = req.body;
        console.log();
        
        let files = [];
        
        // Process uploaded files if they exist
        if (req.files && req.files.length > 0) {
            // Upload files to Cloudinary
            const uploadPromises = req.files.map(file => {
                return cloudinary.uploader.upload(file.path, {
                    resource_type: 'auto',
                    folder: 'chat_attachments'
                });
            });

            // Wait for all uploads to complete
            const cloudinaryResults = await Promise.all(uploadPromises);
            
            // Map results to files array
            files = cloudinaryResults.map(result => ({
                public_id: result.public_id,
                url: result.secure_url,
                fileType: determineFileType(result.resource_type),
                fileName: result.original_filename || `file-${Date.now()}`,
                fileSize: result.bytes
            }));
        }

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
            return res.status(200).json({ 
                success: true,
                message: 'Message sent successfully',
                data: newMessage
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
        res.status(200).json({ 
            success: true,
            message: 'Message sent successfully',
            data: newMessage
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
