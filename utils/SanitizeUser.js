exports.sanitizeUser = (user) => {
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        gender: user.gender,
        number: user.number,
        avatar: user.avatar,
        role: user.role,
        status: user.status
    }
}