const PaymentSettings = require("../../models/Settings/paymentSettings");

exports.savePaymentSettings = async (req, res) => {
  try {
    const { paymentMethod, method, details } = req.body;
    const userId = req.user._id; // assuming user is authenticated and available in req.user

    if (!paymentMethod || !method || !details) {
      return res.status(400).json({ message: "All fields are required." });
    }
    // Check if an exact same entry already exists (user + method + matching details)
    let duplicate = await PaymentSettings.findOne({ userId, paymentMethod, details });

    if (duplicate) {
      return res.status(400).json({ message: "This payment setting already exists." });
    }

    // Otherwise, create a new one (even if same method)
    const newSettings = new PaymentSettings({
      userId,
      paymentMethod,
      method,
      details,
    });

    await newSettings.save();
    return res.status(201).json({ message: "Payment settings saved.", data: newSettings });

  } catch (error) {
    console.error("Error saving payment settings:", error);
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

    return res.status(200).json({ data: settings });
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
