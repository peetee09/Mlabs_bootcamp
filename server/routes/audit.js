const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');

// Get all audit logs (with pagination)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 500;
        const skip = (page - 1) * limit;

        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get filtered audit logs
router.get('/filter', async (req, res) => {
    try {
        const { action, startDate, endDate } = req.query;
        const query = {};

        if (action) {
            query.action = action;
        }

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }

        const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(500);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create audit log entry
router.post('/', async (req, res) => {
    const log = new AuditLog({
        action: req.body.action,
        details: req.body.details,
        user: req.body.user || 'Admin',
        timestamp: req.body.timestamp || new Date()
    });

    try {
        const newLog = await log.save();
        res.status(201).json(newLog);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Clear all audit logs
router.delete('/clear', async (req, res) => {
    try {
        await AuditLog.deleteMany({});
        res.json({ message: 'Audit logs cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
