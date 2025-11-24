const User = require('../../models/User');
const Event = require('../../models/event-details/Event');
const EventOrder = require('../../models/event-order/EventOrder');
const PaymentHistory = require('../../models/admin-payment/payment-history');
const ServiceRequest = require('../../models/service-reequest/service-request');
const mongoose = require('mongoose');

exports.getDashbordData = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get total events count
    const totalEvents = await Event.countDocuments({ isDelete: false, step: 4 });

    // Get active providers count (status: 'active' and role: 'provider')
    const activeProviders = await User.countDocuments({
      role: 'provider',
      status: 'active'
    });

    // Calculate total revenue from all ticket configurations
    const confirmedOrders = await EventOrder.aggregate([
            {
                $match: {
                    paymentStatus: 'confirmed'
                }
            },
            {
                $lookup: {
                    from: 'events', // assuming your events collection name is 'events'
                    localField: 'eventId',
                    foreignField: '_id',
                    as: 'event'
                }
            },
            {
                $unwind: {
                    path: '$event',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    'event.status': 'approved'
                }
            },
            {
                $unwind: '$tickets' // Unwind the tickets array to calculate for each ticket
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ['$tickets.quantity', '$tickets.unitPrice'] 
                        } 
                    }
                }
            }
        ]);

        let totalRevenue = confirmedOrders.length > 0 ? confirmedOrders[0].totalRevenue : 0;

    // Get processed transactions data
    const processedTransactions = await PaymentHistory.countDocuments({
      status: { $in: ['success', 'initiated', 'pending'] } // Adjust statuses as needed
    });

    // Alternative: If you want only successful transactions
    const successfulTransactions = await PaymentHistory.countDocuments({
      status: 'success'
    });

    // If you want transaction amount data
    const transactionStats = await PaymentHistory.aggregate([
      {
        $match: {
          status: 'success' // Only count successful payments
        }
      },
      {
        $group: {
          _id: null,
          totalProcessedAmount: { $sum: '$bidAmount' },
          totalFeeAmount: { $sum: '$feeAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = transactionStats.length > 0 ? transactionStats[0] : {
      totalProcessedAmount: 0,
      totalFeeAmount: 0,
      count: 0
    };

    // Prepare response data
    const dashboardData = {
      totalUsers,
      totalEvents,
      activeProviders,
      totalRevenue: totalRevenue,
      processedTransactions: processedTransactions || 0, // or use successfulTransactions
      successfulTransactions: successfulTransactions || 0,
      transactionStats: {
        totalProcessedAmount: stats.totalProcessedAmount,
        totalFeeAmount: stats.totalFeeAmount,
        transactionCount: stats.count
      }
    };

    res.status(200).json({
      success: true,
      message: "Get data successfully...",
      dashboardData
    });

  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getMoniteringProvider = async (req, res) => {
  try {
    const { providerId } = req.params; // Assuming provider ID comes from request params

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: 'Provider ID is required'
      });
    }

    // Verify provider exists and is actually a provider
    const provider = await User.findOne({
      _id: providerId,
      role: 'provider'
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    // Aggregate service requests by category for this provider
    const categoryStats = await ServiceRequest.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(providerId),
          status: 'active' // Only count active services
        }
      },
      {
        $group: {
          _id: '$serviceType', // Group by serviceType (category)
          count: { $sum: 1 }, // Count services in each category
          services: {
            $push: {
              _id: '$_id',
              eventLocation: '$eventLocation',
              budget: '$budget',
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          services: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 } // Sort by count descending
      }
    ]);

    // Format data for bar graph
    const barGraphData = {
      labels: categoryStats.map(item => item.category),
      datasets: [
        {
          label: 'Number of Services',
          data: categoryStats.map(item => item.count),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ],
          borderColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ],
          borderWidth: 1
        }
      ]
    };

    // Additional statistics
    const summary = {
      totalServices: categoryStats.reduce((sum, item) => sum + item.count, 0),
      totalCategories: categoryStats.length,
      mostPopularCategory: categoryStats.length > 0 ? categoryStats[0].category : null,
      servicesByCategory: categoryStats
    };

    res.status(200).json({
      success: true,
      message: 'Provider services by category retrieved successfully',
      data: {
        barGraphData,
        summary,
        rawData: categoryStats
      }
    });


  } catch (err) {
    console.error('Performance summary error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getProviderList = async (req, res) => {
  try {
    const providers = await User.find(
      { role: 'provider' }, // Filter by provider role
      { name: 1, _id: 1 }   // Only include name and id fields
    ).sort({ name: 1 });    // Optional: sort by name alphabetically

    res.status(200).json({
      success: true,
      providers,
      count: providers.length,
      message: "Fetch successfully..."
    });

  } catch (err) {
    console.error('Error fetching provider list:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};