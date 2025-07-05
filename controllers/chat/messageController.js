const Messages = require('../../models/chat/chat.schema')
const User = require('../../models/User')
const Conversation = require('../../models/chat/conv.schema')

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
    try {
        const senderId = req.user._id
        const { conversationId, message, receiverId = '', type } = req.body;
     console.log('>>',req.body);
     
        if (conversationId === 'new' && receiverId) {
            const newCoversation = new Conversation(
                {
                    members: [senderId, receiverId],
                    receiverId,
                    senderId
                }
            );
            await newCoversation.save();
            const newMessage = new Messages(
                {
                    conversationId: newCoversation._id,
                    receiverId,
                    senderId,
                    message,
                    type
                }
            );
            await newMessage.save();
            return res.status(200).send('Message sent successfully');
        } else if (!conversationId && !receiverId) {
            return res.status(400).send({ errors: 'Please fill all required fields' })
        }
        const newMessage = new Messages(
            {
                conversationId, senderId, message, type, receiverId
            }
        );
        await newMessage.save();
        res.status(200).send('Message sent successfully');
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
}
