const RewardTransaction = require("../../models/RewardTrans");

const rewardCatalog = [
  {
    name: "5% Discount on a Ticket",
    pointsRequired: 1000,
    description: "10,000 XAF ticket → 1,000 XAF discount."
  },
  {
    name: "10% Discount on a Ticket",
    pointsRequired: 5000,
    description: "20,000 XAF ticket → 5,000 XAF discount."
  },
  {
    name: "1 Free Ticket (≤ 10,000 XAF)",
    pointsRequired: 10000,
    description: "Usable on tickets ≤ 10,000 XAF."
  },
  {
    name: "Upgrade to Higher Category",
    pointsRequired: 20000,
    description: "Ticket at 10,000 XAF → upgraded to a category of 15,000 XAF."
  },
  {
    name: "Access to Special/Premium Seats",
    pointsRequired: 30000,
    description: "Most privileged places defined by the organizer."
  },
  {
    name: "Exclusive Goodies (T-shirt, bag, cap, TV, fridge, etc.)",
    pointsRequired: 50000,
    description: "Free delivery."
  },
  {
    name: "Annual Credit (200,000 XAF usable in tickets)",
    pointsRequired: 100000,
    description: "Can be used on any ticket via the app."
  },
];

exports.getAvailableRewards = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await RewardTransaction.find({
      userId,
      type: "credit",
      status: "available",
    });

    if (!transactions.length) {
      return res.status(200).json({
        success: true,
        message: "No available rewards",
        rewards: [],
      });
    }

    const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);

    // Merge reward info + transaction info
    const availableRewards = rewardCatalog
      .filter(r => totalPoints >= r.pointsRequired)
      .map(r => {
        const txn = transactions.find(t => t.points >= r.pointsRequired);
        return {
          _id: txn?._id || null,     // transaction id
          name: r.name,
          description: r.description,
          points: txn?.points || r.pointsRequired, // show actual points instead of required
          reason: txn?.reason || null,
          redeemCode: txn?.redeemCode || null,
        };
      });

    return res.status(200).json({
      success: true,
      message: "Available rewards fetched successfully",
      totalPoints,
      rewards: availableRewards, // already merged
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch available rewards",
      error: err.message,
    });
  }
};

exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await RewardTransaction.find({ 
      userId, 
      status: "available" 
    });

    const totalPoints = transactions.reduce((acc, tx) => {
      return tx.type === "credit" ? acc + tx.points : acc - tx.points;
    }, 0);
    res.json({ success: true, points: totalPoints });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRewardHistory = async (req, res) => {
  try {
    const userId = req.user._id; 
    const history = await RewardTransaction.find({
      userId,
      type: "debit",   
      status: "used", 
    }).sort({ createdAt: -1 });

    if (!history.length) {
      return res.status(200).json({
        success: true,
        message: "No reward history found",
        history: [],
      });
    }

    const formattedHistory = history.map((h) => ({
      id: h._id,
      name: h.reason,                
      points: `-${h.points} Points`, 
      date: h.usedAt || h.createdAt, 
    }));

    return res.status(200).json({
      success: true,
      message: "Reward history fetched successfully",
      history: formattedHistory,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reward history",
      error: err.message,
    });
  }
};

exports.redeemReward = async (req, res) => {
  try {
    const userId = req.user._id;
    const { rewardId, code, discountValue, discountType } = req.body;
 
    if (!code) {
      return res.status(400).json({ success: false, message: "Redeem code is required" });
    }
 
    // Find the existing transaction by its _id and userId
    let transaction = await RewardTransaction.findOne({ _id: rewardId, userId });
 
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
 
    // If code already exists, return it
    if (transaction.redeemCode) {
      // Update discount info if provided
      transaction.discountValue = discountValue ?? transaction.discountValue;
      transaction.discountType = discountType ?? transaction.discountType;
 
      await transaction.save(); // save updated values
 
      return res.status(200).json({
        success: true,
        message: "Reward code already generated",
        code: transaction.redeemCode,
        discountValue: transaction.discountValue,
        discountType: transaction.discountType,
      });
    }
 
    // Update only the fields you need
    transaction.redeemCode = code;
    transaction.discountValue = discountValue != null ? String(discountValue) : null;
    transaction.discountType = discountType || null;
    transaction.codeGeneratedAt = new Date();
 
    await transaction.save();
    return res.status(200).json({
      success: true,
      message: "Reward code saved successfully",
      code: transaction.redeemCode,
      discountValue: transaction.discountValue,
      discountType: transaction.discountType,
    });
 
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to save reward code",
      error: err.message,
    });
  }
};
 

