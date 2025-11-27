const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['add', 'edit', 'delete', 'usage', 'restock', 'system']
    },
    details: {
        type: String,
        required: true
    },
    user: {
        type: String,
        default: 'Admin'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
