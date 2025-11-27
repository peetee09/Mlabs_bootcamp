const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    contact: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'general',
        enum: ['general', 'stationery', 'equipment', 'electronics', 'furniture']
    },
    address: {
        type: String,
        trim: true
    },
    rating: {
        type: Number,
        default: 3,
        min: 1,
        max: 5
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);
