const express = require('express');
const router = express.Router();
const Usage = require('../models/Usage');
const Inventory = require('../models/Inventory');
const AuditLog = require('../models/AuditLog');

// Get all usage records
router.get('/', async (req, res) => {
    try {
        const usageRecords = await Usage.find().sort({ date: -1 });
        res.json(usageRecords);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get usage records for a specific item
router.get('/item/:itemId', async (req, res) => {
    try {
        const usageRecords = await Usage.find({ itemId: req.params.itemId }).sort({ date: -1 });
        res.json(usageRecords);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Record new usage
router.post('/', async (req, res) => {
    try {
        const item = await Inventory.findById(req.body.itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const quantity = parseInt(req.body.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        // Create usage record
        const usage = new Usage({
            itemId: req.body.itemId,
            itemName: item.name,
            category: item.category,
            quantity: quantity,
            date: req.body.date || new Date(),
            notes: req.body.notes
        });

        // Update inventory stock
        item.currentStock = Math.max(0, item.currentStock - quantity);
        await item.save();

        const newUsage = await usage.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'usage',
            details: `Used ${quantity} of ${item.name}`,
            user: 'Admin'
        }).save();
        
        res.status(201).json({ usage: newUsage, item });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete usage record (restores stock)
router.delete('/:id', async (req, res) => {
    try {
        const usage = await Usage.findById(req.params.id);
        if (!usage) {
            return res.status(404).json({ message: 'Usage record not found' });
        }

        // Restore the stock to the inventory item
        const item = await Inventory.findById(usage.itemId);
        if (item) {
            item.currentStock += usage.quantity;
            await item.save();
        }

        await Usage.findByIdAndDelete(req.params.id);
        res.json({ message: 'Usage record deleted and stock restored' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete all usage records for an item
router.delete('/item/:itemId', async (req, res) => {
    try {
        await Usage.deleteMany({ itemId: req.params.itemId });
        res.json({ message: 'Usage records deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
