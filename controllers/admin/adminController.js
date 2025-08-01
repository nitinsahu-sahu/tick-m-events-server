const User = require('../../models/User');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }); // Exclude admins
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.validateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = 'active';
    await user.save();

    res.status(200).json({ success: true, message: 'User validated successfully', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.blockUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = 'block';
    await user.save();

    res.status(200).json({ success: true, message: 'User blocked successfully', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.providerList = async (req, res) => {
  try {
    const providers = await User.find({
      role: 'provider'
    }).select('-socialLinks -experience -password -__v -cover -avatar -website')
    res.status(200).json({ success: true, message: 'Fetch provider sunccessfully...', providers });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Server error' });
  }
};