const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Usage = require('../models/Usage');
const Supplier = require('../models/Supplier');
const AuditLog = require('../models/AuditLog');

// Clear all data from all collections
router.delete('/clear-all', async (req, res) => {
    try {
        await Promise.all([
            Inventory.deleteMany({}),
            Usage.deleteMany({}),
            Supplier.deleteMany({}),
            AuditLog.deleteMany({})
        ]);
        
        res.json({ message: 'All data cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
