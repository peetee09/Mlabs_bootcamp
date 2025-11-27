const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['stationery', 'equipment', 'electronics', 'furniture', 'other']
    },
    currentStock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    reorderLevel: {
        type: Number,
        required: true,
        min: 1
    },
    dailyUsage: {
        type: Number,
        default: 0,
        min: 0
    },
    unitPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    sku: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Virtual for item status
inventorySchema.virtual('status').get(function() {
    if (this.currentStock === 0) return 'Out of Stock';
    if (this.currentStock <= this.reorderLevel) return 'Low';
    return 'Healthy';
});

// Ensure virtuals are included in JSON
inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
