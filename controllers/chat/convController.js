const User = require('../../models/User')
const Conversation = require('../../models/chat/conv.schema')

exports.conversationByuserId = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.query.userId; // Get the other user's ID from query params

        if (!otherUserId) {
            return res.status(400).send({ errors: "Other user ID is required" });
        }

        // Find conversation where both users are members
        const conversation = await Conversation.findOne({
            members: { $all: [currentUserId, otherUserId] }
        });

        if (!conversation) {
            return res.status(200).json(null); // or return an empty object if preferred
        }

        const otherUser = await User.findById(otherUserId);

        const conversationData = {
            user: {
                receiverId: otherUser._id,
                email: otherUser.email,
                name: otherUser.name,
                avatar: otherUser.avatar
            },
            conversationId: conversation._id
        };

        res.status(200).json(conversationData);
    } catch (error) {
        res.status(400).send({ errors: error.message });
    }
}

exports.conversation = async (req, res) => {
    try {
        const { conversationId, receiverId } = req.body;
        const senderId = req.user._id
        if (conversationId === 'new' && receiverId) {
            const newCoversation = new Conversation(
                {
                    members: [senderId, receiverId],
                    receiverId,
                    senderId
                }
            );
            await newCoversation.save().then(() => {
                res.status(200).send('Conversation created successfully');
            }).catch(() => {
                res.status(400).send('Server error');
            })
        }
    } catch (error) {
        res.status(400).send({ errors: error.message });
    }
}

exports.conversationByLoginUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const conversations = await Conversation.find({ members: { $in: [userId] } });
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await User.findById(receiverId);
            return {
                user: {
                    receiverId: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar.url
                },
                conversationId: conversation._id
            }
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        res.status(400).send({ errors: error.message });
    }
}

exports.getAllActiveUsers = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get all ACTIVE users except current user
        const allUsers = await User.find({ 
            _id: { $ne: userId },
            status: 'active' // Only include active users
        }).select('_id email name avatar.url status');
        
        res.status(200).json(allUsers);
    } catch (error) {
        res.status(400).send({ 
            success: false,
            message: 'Failed to fetch user list',
            error: error.message 
        });
    }
};