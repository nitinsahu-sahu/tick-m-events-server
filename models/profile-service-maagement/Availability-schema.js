const mongoose = require('mongoose');

const dayAvailabilitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    available: { type: Boolean, default: false },
    allDay: { type: Boolean, default: false },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '17:00' }
});

const availabilitySchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
    },
    availabilityEnabled: { type: Boolean, default: false },
    days: [dayAvailabilitySchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Availability', availabilitySchema);