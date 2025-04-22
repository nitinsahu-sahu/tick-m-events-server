const mongoose = require('mongoose');
const { Schema } = mongoose;

const locationSchema = new Schema({
    name: {
        type: String,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    },
    address: {
        type: String,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    },
    contact: {
        type: String,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    },
    availableTicketTypes: {
        type: [String],
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        },
        validate: {
            validator: function (v) {
                return this.parent().useOwnPhysicalPoints ? v.length > 0 : true;
            },
            message: 'At least one ticket type must be specified when using own physical points'
        }
    },
    salesStart: {
        type: Date,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    },
    salesEnd: {
        type: Date,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    },
    ticketLimit: {
        type: Number,
        required: function () {
            return this.parent().useOwnPhysicalPoints === true;
        }
    }
});

const salesPointSchema = new Schema(
    {
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        activatePhysicalSales: {
            type: Boolean,
            default: false
        },
        useOwnPhysicalPoints: {
            type: Boolean,
            default: false,
            validate: {
                validator: function (v) {
                    // Can't use own points without activating physical sales
                    return v ? this.activatePhysicalSales === true : true;
                },
                message: 'Must activate physical sales before using own points'
            }
        },
        locations: [locationSchema]
    },
    {
        timestamps: true,
        validate: {
            validator: function () {
                // If using own points, must have at least one location
                if (this.useOwnPhysicalPoints && (!this.locations || this.locations.length === 0)) {
                    return false;
                }
                return true;
            },
            message: 'At least one location must be provided when using own physical points'
        }
    });

module.exports = mongoose.model('SalesPoint', salesPointSchema);