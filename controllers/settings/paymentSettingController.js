const PaymentSettings = require("../../models/Settings/paymentSettings");

exports.savePaymentSettings = async (req, res) => {
  try {
    const { paymentMethod, method, details } = req.body;
    const userId = req.user._id; // authenticated user
 
    if (!paymentMethod || !method || !details) {
      return res.status(400).json({ message: "All fields are required." });
    }
 
    // Check if user already has a record for this payment method
    let existing = await PaymentSettings.findOne({ userId, paymentMethod });
 
    if (existing) {
      return res.status(400).json({
        message: `Payment method "${paymentMethod}" already exists. Please update it instead of creating a new one.`,
      });
    }
 
    // Create new payment setting if it doesn't exist
    const newSettings = new PaymentSettings({
      userId,
      paymentMethod,
      method,
      details,
    });
 
    await newSettings.save();
 
    return res.status(201).json({
      message: "Payment setting saved successfully.",
      data: newSettings
    });
 
  } catch (error) {
    console.error("Error saving payment settings:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

exports.deletePaymentSetting = async (req, res) => {
  try {
    const userId = req.user._id;
    const settingId = req.params.id;

    // Ensure the user owns this payment setting
    const deleted = await PaymentSettings.findOneAndDelete({ _id: settingId, userId });

    if (!deleted) {
      return res.status(404).json({ message: "Payment setting not found." });
    }

    return res.status(200).json({ message: "Payment setting removed successfully." });
  } catch (error) {
    console.error("Error deleting payment setting:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

exports.getPaymentSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const settings = await PaymentSettings.find({ userId });

    if (!settings || settings.length === 0) {
      return res.status(404).json({ message: "No payment settings found." });
    }

    return res.status(200).json({ settings, message: "Fetch deta successfully..." });
  } catch (error) {
    console.error("Error fetching payment settings:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

//update
exports.getPaymentSettingById = async (req, res) => {
  try {
    const userId = req.user._id;
    const settingId = req.params.id;

    // Find the payment setting by userId and _id (to ensure user owns it)
    const setting = await PaymentSettings.findOne({ userId, _id: settingId });

    if (!setting) {
      return res.status(404).json({ message: "Payment setting not found." });
    }

    return res.status(200).json({ data: setting });
  } catch (error) {
    console.error("Error fetching payment setting by ID:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

exports.updatePaymentSetting = async (req, res) => {
  try {
    const userId = req.user._id;
    const settingId = req.params.id;
    const update = req.body; // Only changed fields

    const updated = await PaymentSettings.findOneAndUpdate(
      { _id: settingId, userId },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Setting not found." });
    }

    return res.status(200).json({ data: updated });
  } catch (error) {
    console.error("Error updating setting:", error);
    return res.status(500).json({ message: "Server error." });
  }
};
