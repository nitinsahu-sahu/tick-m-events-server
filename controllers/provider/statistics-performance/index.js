const User = require('../../../models/User');
const Bid = require('../../../models/event-request/bid.modal');
const EventReq = require('../../../models/event-request/event-requests.model');
const mongoose = require("mongoose");

exports.getStatistics = async (req, res) => {
    const providerID = req.user._id;
    const { period = 'monthly' } = req.query;
    try {
        // Get the user with gigsCounts
        const user = await User.findById(providerID).select('gigsCounts');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Extract gig counts from user document
        const { completed } = user.gigsCounts;
        const totalGigs = completed;

        // Calculate completion rate (avoid division by zero)
        const completionRate = totalGigs > 0
            ? (completed / totalGigs) * 100
            : 0;

        // NEW: Calculate conversion rate statistics
        const conversionStats = await getConversionStatistics(providerID);

        // Calculate total revenue from completed projects (Bid model) - Month wise
        const revenueResult = await Bid.aggregate([
            {
                $match: {
                    providerId: new mongoose.Types.ObjectId(providerID),
                    status: 'accepted',
                    winningBid: { $gt: 0 }
                }
            },
            {
                $lookup: {
                    from: 'placeabids',
                    localField: 'projectId',
                    foreignField: '_id',
                    as: 'project'
                }
            },
            {
                $unwind: {
                    path: '$project',
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $match: {
                    'project.status': 'completed',
                    'project.isSigned': true
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    monthlyRevenue: { $sum: '$winningBid' },
                    projectCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Calculate total revenue from completed event requests - Month wise
        const eventReqRevenueResult = await EventReq.aggregate([
            {
                $match: {
                    providerId: new mongoose.Types.ObjectId(providerID),
                    projectStatus: 'completed',
                    isSigned: true
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    monthlyRevenue: { $sum: '$providerProposal.amount' },
                    eventReqCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // NEW: Get daily revenue data for last 30 days for day-over-day percentage
        const dailyRevenueResult = await getDailyRevenueData(providerID);

        // Calculate totals for overall statistics
        const totalRevenue = revenueResult.reduce((sum, item) => sum + item.monthlyRevenue, 0);
        const completedProjectsCount = revenueResult.reduce((sum, item) => sum + item.projectCount, 0);

        const totalEventReqRevenue = eventReqRevenueResult.reduce((sum, item) => sum + item.monthlyRevenue, 0);
        const completedEventReqsCount = eventReqRevenueResult.reduce((sum, item) => sum + item.eventReqCount, 0);

        // Combine monthly data from both sources
        const monthlyRevenueMap = new Map();

        // Process Bid revenue
        revenueResult.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            monthlyRevenueMap.set(key, {
                year: item._id.year,
                month: item._id.month,
                bidRevenue: item.monthlyRevenue,
                eventReqRevenue: 0,
                totalRevenue: item.monthlyRevenue,
                bidProjects: item.projectCount,
                eventReqProjects: 0,
                totalProjects: item.projectCount
            });
        });

        // Process EventReq revenue and merge with existing data
        eventReqRevenueResult.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            if (monthlyRevenueMap.has(key)) {
                const existing = monthlyRevenueMap.get(key);
                existing.eventReqRevenue += item.monthlyRevenue;
                existing.totalRevenue += item.monthlyRevenue;
                existing.eventReqProjects += item.eventReqCount;
                existing.totalProjects += item.eventReqCount;
            } else {
                monthlyRevenueMap.set(key, {
                    year: item._id.year,
                    month: item._id.month,
                    bidRevenue: 0,
                    eventReqRevenue: item.monthlyRevenue,
                    totalRevenue: item.monthlyRevenue,
                    bidProjects: 0,
                    eventReqProjects: item.eventReqCount,
                    totalProjects: item.eventReqCount
                });
            }
        });

        // Convert map to array and sort by year and month
        const monthlyRevenueData = Array.from(monthlyRevenueMap.values())
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            })
            .map(item => ({
                ...item,
                monthName: getMonthName(item.month),
                period: `${getMonthName(item.month)} ${item.year}`
            }));

        // Get last 12 months data for the line chart
        const last12MonthsData = getLast12MonthsData(monthlyRevenueData);

        // NEW: Calculate revenue breakdown by service type for bar chart
        const revenueBreakdown = await getRevenueBreakdown(providerID);

        // NEW: Calculate day-over-day percentage change
        const dailyPercentageChange = calculateDailyPercentageChange(dailyRevenueResult);

        const filteredRevenueGrowth = await getFilteredRevenueGrowth(providerID, period);

            // NEW: Calculate comprehensive financial analytics for last 12 months
        const financialAnalytics = await getFinancialAnalytics(providerID);
        
        // Prepare statistics response
        const statistics = {
            gigs: {
                completed: completed,
                completionRate: Math.round(completionRate * 100) / 100,
                completedProjects: completedProjectsCount + completedEventReqsCount,
                breakdown: {
                    bidProjects: completedProjectsCount,
                    eventRequests: completedEventReqsCount
                }
            },
            revenue: {
                total: totalRevenue + totalEventReqRevenue,
                currency: 'XAF',
                // NEW: Add daily percentage change
                dailyPercentageChange: dailyPercentageChange,
                breakdown: {
                    bidRevenue: totalRevenue,
                    eventReqRevenue: totalEventReqRevenue,

                },
                // NEW: Add detailed breakdown for bar chart
                revenueBreakdown: revenueBreakdown,
                monthlyRevenueGrowth: filteredRevenueGrowth,
                period: period,
                // NEW: Add performance trend with growth rates
                performanceTrend: calculatePerformanceTrend(last12MonthsData)
            },
            
            // NEW: Conversion rate statistics
            conversion: {
                offerConversionRate: conversionStats.overallConversionRate,
                totalOffers: conversionStats.totalOffers,
                acceptedOffers: conversionStats.acceptedOffers,
                breakdown: {
                    bidConversionRate: conversionStats.bidConversionRate,
                    eventReqConversionRate: conversionStats.eventReqConversionRate,
                    bidOffers: conversionStats.bidOffers,
                    acceptedBidOffers: conversionStats.acceptedBidOffers,
                    eventReqOffers: conversionStats.eventReqOffers,
                    acceptedEventReqOffers: conversionStats.acceptedEventReqOffers
                }
            },
            ratings: {
                average: user.averageRating || 0,
                totalReviews: user.reviewCount || 0
            },
             financialAnalytics: {
                period: 'last_12_months',
                totalRevenue: financialAnalytics.totalRevenue,
                totalServicesCompleted: financialAnalytics.totalServicesCompleted,
                averagePayment: financialAnalytics.averagePayment,
                currency: 'XAF',
                monthlyBreakdown: financialAnalytics.monthlyBreakdown,
                summary: {
                    highestRevenueMonth: financialAnalytics.highestRevenueMonth,
                    lowestRevenueMonth: financialAnalytics.lowestRevenueMonth,
                    bestPerformingMonth: financialAnalytics.bestPerformingMonth,
                    revenueGrowth: financialAnalytics.revenueGrowth,
                    averageMonthlyRevenue: financialAnalytics.averageMonthlyRevenue
                }
            },
        };

        res.status(200).json({
            success: true,
            message: 'Statistics fetched successfully',
            statistics
        });

    } catch (err) {
        console.error('Error fetching statistics:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

async function getFinancialAnalytics(providerID) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Get Bid financial data for last 12 months
    const bidFinancialData = await Bid.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                status: 'accepted',
                winningBid: { $gt: 0 },
                createdAt: { $gte: twelveMonthsAgo }
            }
        },
        {
            $lookup: {
                from: 'placeabids',
                localField: 'projectId',
                foreignField: '_id',
                as: 'project'
            }
        },
        {
            $unwind: {
                path: '$project',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                'project.status': 'completed',
                'project.isSigned': true
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                monthlyRevenue: { $sum: '$winningBid' },
                projectCount: { $sum: 1 },
                // For average calculation
                totalBidAmount: { $sum: '$winningBid' }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    // Get EventReq financial data for last 12 months
    const eventReqFinancialData = await EventReq.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                projectStatus: 'completed',
                isSigned: true,
                createdAt: { $gte: twelveMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                monthlyRevenue: { $sum: '$providerProposal.amount' },
                eventReqCount: { $sum: 1 },
                // For average calculation
                totalEventReqAmount: { $sum: '$providerProposal.amount' }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    // Combine and process financial data
    const financialMap = new Map();

    // Initialize last 12 months with zero values
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(currentDate.getMonth() - i);
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month}`;

        financialMap.set(key, {
            year,
            month,
            monthName: getMonthName(month),
            period: `${getMonthName(month)} ${year}`,
            revenueEarned: 0,
            servicesCompleted: 0,
            averagePayment: 0,
            bidRevenue: 0,
            eventReqRevenue: 0,
            bidServices: 0,
            eventReqServices: 0
        });
    }

    // Process Bid financial data
    bidFinancialData.forEach(item => {
        const key = `${item._id.year}-${item._id.month}`;
        if (financialMap.has(key)) {
            const existing = financialMap.get(key);
            existing.bidRevenue += item.monthlyRevenue;
            existing.revenueEarned += item.monthlyRevenue;
            existing.bidServices += item.projectCount;
            existing.servicesCompleted += item.projectCount;
        }
    });

    // Process EventReq financial data
    eventReqFinancialData.forEach(item => {
        const key = `${item._id.year}-${item._id.month}`;
        if (financialMap.has(key)) {
            const existing = financialMap.get(key);
            existing.eventReqRevenue += item.monthlyRevenue;
            existing.revenueEarned += item.monthlyRevenue;
            existing.eventReqServices += item.eventReqCount;
            existing.servicesCompleted += item.eventReqCount;
        }
    });

    // Calculate average payment for each month
    financialMap.forEach((monthData) => {
        monthData.averagePayment = monthData.servicesCompleted > 0 
            ? Math.round(monthData.revenueEarned / monthData.servicesCompleted)
            : 0;
    });

    // Convert to array and sort
    const monthlyBreakdown = Array.from(financialMap.values())
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

    // Calculate totals and analytics
    const totalRevenue = monthlyBreakdown.reduce((sum, month) => sum + month.revenueEarned, 0);
    const totalServicesCompleted = monthlyBreakdown.reduce((sum, month) => sum + month.servicesCompleted, 0);
    const averagePayment = totalServicesCompleted > 0 
        ? Math.round(totalRevenue / totalServicesCompleted)
        : 0;

    // Find highest and lowest revenue months
    const revenueMonths = monthlyBreakdown.filter(month => month.revenueEarned > 0);
    const highestRevenueMonth = revenueMonths.length > 0 
        ? revenueMonths.reduce((max, month) => month.revenueEarned > max.revenueEarned ? month : max)
        : null;
    const lowestRevenueMonth = revenueMonths.length > 0 
        ? revenueMonths.reduce((min, month) => month.revenueEarned < min.revenueEarned ? month : min)
        : null;

    // Calculate revenue growth (current month vs previous month)
    let revenueGrowth = 0;
    if (monthlyBreakdown.length >= 2) {
        const currentMonth = monthlyBreakdown[monthlyBreakdown.length - 1];
        const previousMonth = monthlyBreakdown[monthlyBreakdown.length - 2];
        
        if (previousMonth.revenueEarned > 0) {
            revenueGrowth = ((currentMonth.revenueEarned - previousMonth.revenueEarned) / previousMonth.revenueEarned) * 100;
            revenueGrowth = Math.round(revenueGrowth * 100) / 100;
        }
    }

    // Find best performing month (highest services completed with good revenue)
    const bestPerformingMonth = revenueMonths.length > 0 
        ? revenueMonths.reduce((best, month) => {
            const bestScore = best.servicesCompleted * (best.revenueEarned / best.servicesCompleted || 0);
            const currentScore = month.servicesCompleted * (month.revenueEarned / month.servicesCompleted || 0);
            return currentScore > bestScore ? month : best;
        })
        : null;

    // Calculate average monthly revenue
    const monthsWithRevenue = monthlyBreakdown.filter(month => month.revenueEarned > 0).length;
    const averageMonthlyRevenue = monthsWithRevenue > 0 
        ? Math.round(totalRevenue / monthsWithRevenue)
        : 0;

    return {
        totalRevenue,
        totalServicesCompleted,
        averagePayment,
        monthlyBreakdown,
        highestRevenueMonth: highestRevenueMonth ? {
            month: highestRevenueMonth.period,
            revenue: highestRevenueMonth.revenueEarned,
            services: highestRevenueMonth.servicesCompleted
        } : null,
        lowestRevenueMonth: lowestRevenueMonth ? {
            month: lowestRevenueMonth.period,
            revenue: lowestRevenueMonth.revenueEarned,
            services: lowestRevenueMonth.servicesCompleted
        } : null,
        bestPerformingMonth: bestPerformingMonth ? {
            month: bestPerformingMonth.period,
            revenue: bestPerformingMonth.revenueEarned,
            services: bestPerformingMonth.servicesCompleted,
            averagePayment: bestPerformingMonth.averagePayment
        } : null,
        revenueGrowth,
        averageMonthlyRevenue
    };
}

// NEW: Function to calculate performance trend (month-over-month growth)
function calculatePerformanceTrend(monthlyRevenueData) {
    if (monthlyRevenueData.length < 2) {
        return monthlyRevenueData.map(item => ({
            ...item,
            growthRate: 0,
            trend: 'neutral'
        }));
    }

    const trendData = [];

    for (let i = 0; i < monthlyRevenueData.length; i++) {
        const currentMonth = monthlyRevenueData[i];

        if (i === 0) {
            // First month has no previous data
            trendData.push({
                ...currentMonth,
                growthRate: 0,
                trend: 'neutral'
            });
        } else {
            const previousMonth = monthlyRevenueData[i - 1];
            const previousRevenue = previousMonth.totalRevenue;
            const currentRevenue = currentMonth.totalRevenue;

            let growthRate = 0;
            let trend = 'neutral';

            if (previousRevenue > 0) {
                growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
                growthRate = Math.round(growthRate * 100) / 100; // Round to 2 decimal places

                if (growthRate > 0) {
                    trend = 'up';
                } else if (growthRate < 0) {
                    trend = 'down';
                }
            } else if (currentRevenue > 0) {
                growthRate = 100; // First time revenue
                trend = 'up';
            }

            trendData.push({
                ...currentMonth,
                growthRate,
                trend
            });
        }
    }

    return trendData;
}

// NEW: Function to get filtered revenue growth data
async function getFilteredRevenueGrowth(providerID, filterType) {
    let revenueResult, eventReqRevenueResult;

    const currentDate = new Date();
    let startDate;

    switch (filterType) {
        case 'daily':
            startDate = new Date();
            startDate.setDate(currentDate.getDate() - 30); // Last 30 days
            break;
        case 'weekly':
            startDate = new Date();
            startDate.setDate(currentDate.getDate() - 90); // Last 12 weeks
            break;
        case 'monthly':
            startDate = new Date();
            startDate.setMonth(currentDate.getMonth() - 12); // Last 12 months
            break;
        default:
            startDate = new Date();
            startDate.setMonth(currentDate.getMonth() - 12);
    }

    // Get Bid revenue data based on filter type
    revenueResult = await Bid.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                status: 'accepted',
                winningBid: { $gt: 0 },
                createdAt: { $gte: startDate }
            }
        },
        {
            $lookup: {
                from: 'placeabids',
                localField: 'projectId',
                foreignField: '_id',
                as: 'project'
            }
        },
        {
            $unwind: {
                path: '$project',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                'project.status': 'completed',
                'project.isSigned': true
            }
        },
        {
            $group: {
                _id: getGroupingId(filterType),
                monthlyRevenue: { $sum: '$winningBid' },
                projectCount: { $sum: 1 }
            }
        },
        {
            $sort: getSortCriteria(filterType)
        }
    ]);

    // Get EventReq revenue data based on filter type
    eventReqRevenueResult = await EventReq.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                projectStatus: 'completed',
                isSigned: true,
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: getGroupingId(filterType),
                monthlyRevenue: { $sum: '$providerProposal.amount' },
                eventReqCount: { $sum: 1 }
            }
        },
        {
            $sort: getSortCriteria(filterType)
        }
    ]);

    // Combine and process the data
    return processFilteredRevenueData(revenueResult, eventReqRevenueResult, filterType);
}

// Process and combine filtered revenue data
function processFilteredRevenueData(bidData, eventReqData, filterType) {
    const revenueMap = new Map();

    // Process Bid revenue
    bidData.forEach(item => {
        const key = getKeyFromId(item._id, filterType);
        revenueMap.set(key, {
            period: getPeriodLabel(item._id, filterType),
            ...item._id,
            bidRevenue: item.monthlyRevenue,
            eventReqRevenue: 0,
            totalRevenue: item.monthlyRevenue,
            bidProjects: item.projectCount,
            eventReqProjects: 0,
            totalProjects: item.projectCount
        });
    });

    // Process EventReq revenue and merge
    eventReqData.forEach(item => {
        const key = getKeyFromId(item._id, filterType);
        if (revenueMap.has(key)) {
            const existing = revenueMap.get(key);
            existing.eventReqRevenue += item.monthlyRevenue;
            existing.totalRevenue += item.monthlyRevenue;
            existing.eventReqProjects += item.eventReqCount;
            existing.totalProjects += item.eventReqCount;
        } else {
            revenueMap.set(key, {
                period: getPeriodLabel(item._id, filterType),
                ...item._id,
                bidRevenue: 0,
                eventReqRevenue: item.monthlyRevenue,
                totalRevenue: item.monthlyRevenue,
                bidProjects: 0,
                eventReqProjects: item.eventReqCount,
                totalProjects: item.eventReqCount
            });
        }
    });

    // Convert to array and fill missing periods
    const revenueArray = Array.from(revenueMap.values())
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (filterType === 'monthly' && a.month !== b.month) return a.month - b.month;
            if (filterType === 'weekly' && a.week !== b.week) return a.week - b.week;
            if (filterType === 'daily' && a.day !== b.day) return a.day - b.day;
            return 0;
        });

    return fillMissingPeriods(revenueArray, filterType);
}

// Helper function to generate unique key for Map
function getKeyFromId(id, filterType) {
    switch (filterType) {
        case 'daily':
            return `${id.year}-${id.month}-${id.day}`;
        case 'weekly':
            return `${id.year}-${id.week}`;
        case 'monthly':
        default:
            return `${id.year}-${id.month}`;
    }
}

// Helper function to generate period labels
function getPeriodLabel(id, filterType) {
    switch (filterType) {
        case 'daily':
            return `${getMonthName(id.month)} ${id.day}, ${id.year}`;
        case 'weekly':
            return `Week ${id.week}, ${id.year}`;
        case 'monthly':
        default:
            return `${getMonthName(id.month)} ${id.year}`;
    }
}

// Fill missing periods with zero values
function fillMissingPeriods(data, filterType) {
    const filledData = [];
    const currentDate = new Date();
    let periodsToGenerate;

    switch (filterType) {
        case 'daily':
            periodsToGenerate = 30;
            break;
        case 'weekly':
            periodsToGenerate = 12;
            break;
        case 'monthly':
        default:
            periodsToGenerate = 12;
    }

    for (let i = periodsToGenerate - 1; i >= 0; i--) {
        const periodDate = new Date();

        switch (filterType) {
            case 'daily':
                periodDate.setDate(currentDate.getDate() - i);
                const dayKey = `${periodDate.getFullYear()}-${periodDate.getMonth() + 1}-${periodDate.getDate()}`;
                const existingDay = data.find(item =>
                    item.year === periodDate.getFullYear() &&
                    item.month === periodDate.getMonth() + 1 &&
                    item.day === periodDate.getDate()
                );

                if (existingDay) {
                    filledData.push(existingDay);
                } else {
                    filledData.push({
                        year: periodDate.getFullYear(),
                        month: periodDate.getMonth() + 1,
                        day: periodDate.getDate(),
                        period: `${getMonthName(periodDate.getMonth() + 1)} ${periodDate.getDate()}, ${periodDate.getFullYear()}`,
                        bidRevenue: 0,
                        eventReqRevenue: 0,
                        totalRevenue: 0,
                        bidProjects: 0,
                        eventReqProjects: 0,
                        totalProjects: 0
                    });
                }
                break;

            case 'weekly':
                periodDate.setDate(currentDate.getDate() - (i * 7));
                const weekNumber = getWeekNumber(periodDate);
                const weekKey = `${periodDate.getFullYear()}-${weekNumber}`;
                const existingWeek = data.find(item =>
                    item.year === periodDate.getFullYear() &&
                    item.week === weekNumber
                );

                if (existingWeek) {
                    filledData.push(existingWeek);
                } else {
                    filledData.push({
                        year: periodDate.getFullYear(),
                        week: weekNumber,
                        period: `Week ${weekNumber}, ${periodDate.getFullYear()}`,
                        bidRevenue: 0,
                        eventReqRevenue: 0,
                        totalRevenue: 0,
                        bidProjects: 0,
                        eventReqProjects: 0,
                        totalProjects: 0
                    });
                }
                break;

            case 'monthly':
            default:
                periodDate.setMonth(currentDate.getMonth() - i);
                const monthKey = `${periodDate.getFullYear()}-${periodDate.getMonth() + 1}`;
                const existingMonth = data.find(item =>
                    item.year === periodDate.getFullYear() &&
                    item.month === periodDate.getMonth() + 1
                );

                if (existingMonth) {
                    filledData.push(existingMonth);
                } else {
                    filledData.push({
                        year: periodDate.getFullYear(),
                        month: periodDate.getMonth() + 1,
                        period: `${getMonthName(periodDate.getMonth() + 1)} ${periodDate.getFullYear()}`,
                        bidRevenue: 0,
                        eventReqRevenue: 0,
                        totalRevenue: 0,
                        bidProjects: 0,
                        eventReqProjects: 0,
                        totalProjects: 0
                    });
                }
        }
    }

    return filledData;
}

// Helper function to get week number
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to determine grouping for aggregation
function getGroupingId(filterType) {
    switch (filterType) {
        case 'daily':
            return {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
        case 'weekly':
            return {
                year: { $year: '$createdAt' },
                week: { $week: '$createdAt' }
            };
        case 'monthly':
        default:
            return {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
            };
    }
}

// Helper function to determine sort criteria
function getSortCriteria(filterType) {
    switch (filterType) {
        case 'daily':
            return { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
        case 'weekly':
            return { '_id.year': 1, '_id.week': 1 };
        case 'monthly':
        default:
            return { '_id.year': 1, '_id.month': 1 };
    }
}
// NEW: Function to calculate performance trend (month-over-month growth)
function calculatePerformanceTrend(monthlyRevenueData) {
    if (monthlyRevenueData.length < 2) {
        return monthlyRevenueData.map(item => ({
            ...item,
            growthRate: 0,
            trend: 'neutral'
        }));
    }

    const trendData = [];

    for (let i = 0; i < monthlyRevenueData.length; i++) {
        const currentMonth = monthlyRevenueData[i];

        if (i === 0) {
            // First month has no previous data
            trendData.push({
                ...currentMonth,
                growthRate: 0,
                trend: 'neutral'
            });
        } else {
            const previousMonth = monthlyRevenueData[i - 1];
            const previousRevenue = previousMonth.totalRevenue;
            const currentRevenue = currentMonth.totalRevenue;

            let growthRate = 0;
            let trend = 'neutral';

            if (previousRevenue > 0) {
                growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
                growthRate = Math.round(growthRate * 100) / 100; // Round to 2 decimal places

                if (growthRate > 0) {
                    trend = 'up';
                } else if (growthRate < 0) {
                    trend = 'down';
                }
            } else if (currentRevenue > 0) {
                growthRate = 100; // First time revenue
                trend = 'up';
            }

            trendData.push({
                ...currentMonth,
                growthRate,
                trend
            });
        }
    }

    return trendData;
}

// NEW: Function to calculate conversion statistics
async function getConversionStatistics(providerID) {
    // Get bid statistics
    const bidStats = await Bid.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID)
            }
        },
        {
            $group: {
                _id: null,
                totalBids: { $sum: 1 },
                acceptedBids: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
                    }
                }
            }
        }
    ]);

    // Get event request statistics
    const eventReqStats = await EventReq.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID)
            }
        },
        {
            $group: {
                _id: null,
                totalEventReqs: { $sum: 1 },
                acceptedEventReqs: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ['$providerStatus', 'accepted'] },
                                    { $eq: ['$orgStatus', 'accepted'] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const bidData = bidStats[0] || { totalBids: 0, acceptedBids: 0 };
    const eventReqData = eventReqStats[0] || { totalEventReqs: 0, acceptedEventReqs: 0 };

    const totalOffers = bidData.totalBids + eventReqData.totalEventReqs;
    const acceptedOffers = bidData.acceptedBids + eventReqData.acceptedEventReqs;

    // Calculate conversion rates
    const overallConversionRate = totalOffers > 0
        ? Math.round((acceptedOffers / totalOffers) * 100 * 100) / 100
        : 0;

    const bidConversionRate = bidData.totalBids > 0
        ? Math.round((bidData.acceptedBids / bidData.totalBids) * 100 * 100) / 100
        : 0;

    const eventReqConversionRate = eventReqData.totalEventReqs > 0
        ? Math.round((eventReqData.acceptedEventReqs / eventReqData.totalEventReqs) * 100 * 100) / 100
        : 0;

    return {
        overallConversionRate,
        totalOffers,
        acceptedOffers,
        bidConversionRate,
        eventReqConversionRate,
        bidOffers: bidData.totalBids,
        acceptedBidOffers: bidData.acceptedBids,
        eventReqOffers: eventReqData.totalEventReqs,
        acceptedEventReqOffers: eventReqData.acceptedEventReqs
    };
}

// NEW: Function to get daily revenue data for last 30 days
async function getDailyRevenueData(providerID) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get daily revenue from Bid model
    const bidDailyRevenue = await Bid.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                status: 'accepted',
                winningBid: { $gt: 0 },
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $lookup: {
                from: 'placeabids',
                localField: 'projectId',
                foreignField: '_id',
                as: 'project'
            }
        },
        {
            $unwind: {
                path: '$project',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                'project.status': 'completed',
                'project.isSigned': true
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                dailyRevenue: { $sum: '$winningBid' },
                projectCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);

    // Get daily revenue from EventReq model
    const eventReqDailyRevenue = await EventReq.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                projectStatus: 'completed',
                isSigned: true,
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                dailyRevenue: { $sum: '$providerProposal.amount' },
                eventReqCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);

    // Combine daily revenue data
    const dailyRevenueMap = new Map();

    // Process Bid daily revenue
    bidDailyRevenue.forEach(item => {
        const key = `${item._id.year}-${item._id.month}-${item._id.day}`;
        dailyRevenueMap.set(key, {
            date: new Date(item._id.year, item._id.month - 1, item._id.day),
            totalRevenue: item.dailyRevenue,
            bidRevenue: item.dailyRevenue,
            eventReqRevenue: 0
        });
    });

    // Process EventReq daily revenue and merge
    eventReqDailyRevenue.forEach(item => {
        const key = `${item._id.year}-${item._id.month}-${item._id.day}`;
        const date = new Date(item._id.year, item._id.month - 1, item._id.day);

        if (dailyRevenueMap.has(key)) {
            const existing = dailyRevenueMap.get(key);
            existing.totalRevenue += item.dailyRevenue;
            existing.eventReqRevenue += item.dailyRevenue;
        } else {
            dailyRevenueMap.set(key, {
                date: date,
                totalRevenue: item.dailyRevenue,
                bidRevenue: 0,
                eventReqRevenue: item.dailyRevenue
            });
        }
    });

    return Array.from(dailyRevenueMap.values())
        .sort((a, b) => a.date - b.date);
}

// NEW: Function to get revenue breakdown by service type/category
async function getRevenueBreakdown(providerID) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Get daily revenue breakdown from Bid model for last 7 days
    const bidDailyRevenue = await Bid.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                status: 'accepted',
                winningBid: { $gt: 0 },
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $lookup: {
                from: 'placeabids',
                localField: 'projectId',
                foreignField: '_id',
                as: 'project'
            }
        },
        {
            $unwind: {
                path: '$project',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                'project.status': 'completed',
                'project.isSigned': true
            }
        },
        {
            $group: {
                _id: {
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    }
                },
                dailyRevenue: { $sum: '$winningBid' },
                projectCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.date': 1 }
        }
    ]);

    // Get daily revenue breakdown from EventReq model for last 7 days
    const eventReqDailyRevenue = await EventReq.aggregate([
        {
            $match: {
                providerId: new mongoose.Types.ObjectId(providerID),
                projectStatus: 'completed',
                isSigned: true,
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $group: {
                _id: {
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    }
                },
                dailyRevenue: { $sum: '$providerProposal.amount' },
                eventReqCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.date': 1 }
        }
    ]);

    // Create a map for all dates in the last 7 days
    const dateMap = new Map();
    
    // Initialize all dates for the last 7 days with zero values
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dateString = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        dateMap.set(dateString, {
            date: dateString,
            day: dayName,
            bidRevenue: 0,
            eventReqRevenue: 0,
            totalRevenue: 0,
            bidProjects: 0,
            eventReqProjects: 0,
            totalProjects: 0
        });
    }

    // Process Bid daily revenue - FIXED: Use the correct field name
    bidDailyRevenue.forEach(item => {
        const dateString = item._id.date;
        if (dateMap.has(dateString)) {
            const existing = dateMap.get(dateString);
            existing.bidRevenue += item.dailyRevenue;
            existing.totalRevenue += item.dailyRevenue;
            existing.bidProjects += item.projectCount;
            existing.totalProjects += item.projectCount;
        }
    });

    // Process EventReq daily revenue
    eventReqDailyRevenue.forEach(item => {
        const dateString = item._id.date;
        if (dateMap.has(dateString)) {
            const existing = dateMap.get(dateString);
            existing.eventReqRevenue += item.dailyRevenue;
            existing.totalRevenue += item.dailyRevenue;
            existing.eventReqProjects += item.eventReqCount;
            existing.totalProjects += item.eventReqCount;
        }
    });

    // Convert to array and ensure proper order
    const dailyBreakdown = Array.from(dateMap.values())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(item => ({
            ...item,
            displayDate: `${item.day}, ${formatDisplayDate(item.date)}`
        }));

    return dailyBreakdown;
}

// Helper function to format date for display
function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
}

// NEW: Function to calculate day-over-day percentage change
function calculateDailyPercentageChange(dailyRevenueData) {
    if (dailyRevenueData.length < 2) {
        return 0;
    }

    // Get last two days with revenue
    const lastTwoDays = dailyRevenueData.slice(-2);

    if (lastTwoDays.length < 2) {
        return 0;
    }

    const yesterdayRevenue = lastTwoDays[0].totalRevenue;
    const dayBeforeRevenue = lastTwoDays[1].totalRevenue;

    if (dayBeforeRevenue === 0) {
        return yesterdayRevenue > 0 ? 100 : 0;
    }

    const percentageChange = ((yesterdayRevenue - dayBeforeRevenue) / dayBeforeRevenue) * 100;
    return Math.round(percentageChange * 100) / 100;
}

// Helper function to get month name
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1];
}

// Helper function to get last 12 months data including months with zero revenue
function getLast12MonthsData(monthlyData) {
    const result = [];
    const currentDate = new Date();

    // Create a map of existing monthly data for easy lookup
    const dataMap = new Map();
    monthlyData.forEach(item => {
        dataMap.set(`${item.year}-${item.month}`, item);
    });

    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(currentDate.getMonth() - i);

        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month}`;

        const existingData = dataMap.get(key);

        if (existingData) {
            result.push(existingData);
        } else {
            result.push({
                year,
                month,
                monthName: getMonthName(month),
                period: `${getMonthName(month)} ${year}`,
                bidRevenue: 0,
                eventReqRevenue: 0,
                totalRevenue: 0,
                bidProjects: 0,
                eventReqProjects: 0,
                totalProjects: 0
            });
        }
    }

    return result;
}