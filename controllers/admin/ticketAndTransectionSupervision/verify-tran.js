const adminPaymentHistory = require("../../../models/admin-payment/payment-history");
const Event = require("../../../models/event-details/Event");
const TicketType = require("../../../models/TicketType");
const RefundRequest = require("../../../models/refund-managment/RefundRequest");


exports.getAllAdminTransactions = async (req, res) => {
    try {
        const adminId = req.user._id;

        // Extract query parameters for filtering, sorting, and pagination
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
            startDate,
            endDate,
            search
        } = req.query;

        // Build filter object
        const filter = {};

        // Add status filter if provided
        if (status && status !== 'all') {
            filter.status = status;
        }

        // Add date range filter if provided
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        // Add search filter for transaction ID
        if (search) {
            filter.transId = { $regex: search, $options: 'i' };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sort configuration
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Fetch payment history with population
        const payments = await adminPaymentHistory
            .find(filter)
            .populate('eventId', 'eventName eventDate')
            .populate('organizerId', 'name email')
            .populate('eventReqId', 'proposedBudget')
            .populate('placeABidId', 'bidAmount')
            .populate('bidId', 'amount')
            .sort(sortConfig)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const totalCount = await adminPaymentHistory.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Payment history fetched successfully',
            payments,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (err) {
        console.error('Error fetching admin transactions:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching payment history'
        });
    }
};

exports.getFinancialStatistics = async (req, res) => {
    try {
        // Calculate total revenue from all ticket configurations
        const allTickets = await TicketType.find()
            .populate('eventId', 'status') // Only populate status to check if event is approved
            .lean();

        let totalRevenue = 0;

        allTickets.forEach(ticket => {
            // Only count revenue from approved events
            if (ticket.eventId && ticket.eventId.status === 'approved') {
                // Extract numeric value from price string (e.g., "5000 XAF" -> 5000)
                const priceStr = ticket.price.split(' ')[0];
                const price = parseFloat(priceStr) || 0;
                const soldQuantity = parseInt(ticket.sold) || 0;

                // Revenue = price × quantity sold
                totalRevenue += price * soldQuantity;
            }
        });

        // Get refund statistics from RefundRequest table
        const refundStats = await RefundRequest.aggregate([
            {
                $group: {
                    _id: '$refundStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$refundAmount' }
                }
            }
        ]);

        // Calculate approved refunds count and amount
        let approvedRefundsCount = 0;
        let approvedRefundsAmount = 0;
        let pendingRefundsCount = 0;
        let processedRefundsCount = 0;

        refundStats.forEach(stat => {
            if (stat._id === 'approved') {
                approvedRefundsCount = stat.count;
                approvedRefundsAmount = stat.totalAmount;
            } else if (stat._id === 'pending') {
                pendingRefundsCount = stat.count;
            } else if (stat._id === 'processed' || stat._id === 'refunded') {
                processedRefundsCount += stat.count;
            }
        });

        // Calculate total approved refund amount
        const approvedRefunds = await RefundRequest.aggregate([
            {
                $match: {
                    refundStatus: 'approved'
                }
            },
            {
                $group: {
                    _id: null,
                    totalApprovedAmount: { $sum: '$refundAmount' }
                }
            }
        ]);

        const totalApprovedRefundAmount = approvedRefunds.length > 0 ? approvedRefunds[0].totalApprovedAmount : 0;

        // Calculate total commission from adminPaymentHistory - ONLY SUCCESSFUL transactions
        const commissionStats = await adminPaymentHistory.aggregate([
            {
                $match: {
                    status: 'successful' // Only include successful payments
                }
            },
            {
                $group: {
                    _id: null,
                    totalCommission: { $sum: '$feeAmount' },
                    totalTransactions: { $sum: 1 }
                }
            }
        ]);

        const totalCommission = commissionStats.length > 0 ? commissionStats[0].totalCommission : 0;

        // Calculate 10% of total revenue for commitionTicketActivity
        const commitionTicketActivity = totalRevenue * 0.1; // 10% of total revenue

        // Calculate pending payments (sum of availableBalance from all events)
        const pendingPaymentsStats = await Event.aggregate([
            {
                $group: {
                    _id: null,
                    totalPendingPayments: { $sum: '$availableBalance' }
                }
            }
        ]);

        const pendingPayment = pendingPaymentsStats.length > 0 ? pendingPaymentsStats[0].totalPendingPayments : 0;

        // Prepare response data
        const ticketTrnsSup = {
            totalSales: `${totalRevenue.toLocaleString()} XAF`,
            totalApprovedRefundAmount: `${totalApprovedRefundAmount.toLocaleString()} XAF`,
            totalCommission: `${totalCommission.toLocaleString()} XAF`,
            commitionTicketActivity: `${commitionTicketActivity.toLocaleString()} XAF`,
            pendingPayment:`${pendingPayment.toLocaleString()} XAF`
        };

       

        res.status(200).json({
            success: true,
            message: "Get data successfully...",
            ticketTrnsSup,
        });

    } catch (err) {
        console.error('Financial statistics error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching payment history'
        });
    }
};