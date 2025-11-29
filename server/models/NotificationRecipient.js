const mongoose = require('mongoose');

const notificationRecipientSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    notifyOnLowStock: {
        type: Boolean,
        default: true
    },
    notifyOnOutOfStock: {
        type: Boolean,
        default: true
    },
    notifyOnRestock: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('NotificationRecipient', notificationRecipientSchema);
