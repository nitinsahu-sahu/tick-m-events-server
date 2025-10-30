const Bid = require('../../../models/event-request/bid.modal');
const PlaceABid = require('../../../models/event-request/placeBid.modal');

exports.getSecureInfo = async (req, res) => {
    const providerId = req.user._id;
    const placeABidId = req.params.placeBidId;
    
    try {
        // Check if project exists and if this provider has an accepted/winning bid
        const [placeABid, assignedBid] = await Promise.all([
            PlaceABid.findById(placeABidId),
            Bid.findOne({
                projectId: placeABidId,
                providerId: providerId,
                status: 'accepted',
                $or: [
                    { winningBid: { $gt: 0 } },
                    { isOrgnizerAccepted: true }
                ]
            })
        ]);

        if (!placeABid) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const isAssigned = !!assignedBid;

        res.status(200).json({
            success: true,
            isAssigned: isAssigned,
            message: isAssigned ? 'Project is assigned to this provider' : 'Project is not assigned to this provider'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};