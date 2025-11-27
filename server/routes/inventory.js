const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const AuditLog = require('../models/AuditLog');

// Get all inventory items
router.get('/', async (req, res) => {
    try {
        const items = await Inventory.find().populate('supplierId');
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id).populate('supplierId');
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new inventory item
router.post('/', async (req, res) => {
    const item = new Inventory({
        name: req.body.name,
        category: req.body.category,
        currentStock: req.body.currentStock,
        reorderLevel: req.body.reorderLevel,
        dailyUsage: req.body.dailyUsage,
        unitPrice: req.body.unitPrice,
        supplierId: req.body.supplierId || null,
        sku: req.body.sku,
        description: req.body.description
    });

    try {
        const newItem = await item.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'add',
            details: `Added new item: ${newItem.name}`,
            user: 'Admin'
        }).save();
        
        res.status(201).json(newItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update inventory item
router.patch('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const updateFields = ['name', 'category', 'currentStock', 'reorderLevel', 
                             'dailyUsage', 'unitPrice', 'supplierId', 'sku', 'description'];
        
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                item[field] = req.body[field];
            }
        });

        const updatedItem = await item.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'edit',
            details: `Updated item: ${updatedItem.name}`,
            user: 'Admin'
        }).save();
        
        res.json(updatedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Restock inventory item
router.patch('/:id/restock', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const quantity = parseInt(req.body.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        item.currentStock += quantity;
        const updatedItem = await item.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'restock',
            details: `Restocked ${quantity} of ${updatedItem.name}`,
            user: 'Admin'
        }).save();
        
        res.json(updatedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const itemName = item.name;
        await Inventory.findByIdAndDelete(req.params.id);
        
        // Log audit entry
        await new AuditLog({
            action: 'delete',
            details: `Deleted item: ${itemName}`,
            user: 'Admin'
        }).save();
        
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
