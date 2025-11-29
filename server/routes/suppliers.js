const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const AuditLog = require('../models/AuditLog');

// Get all suppliers
router.get('/', async (req, res) => {
    try {
        const suppliers = await Supplier.find();
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single supplier
router.get('/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new supplier
router.post('/', async (req, res) => {
    const supplier = new Supplier({
        name: req.body.name,
        contact: req.body.contact,
        email: req.body.email,
        phone: req.body.phone,
        category: req.body.category,
        address: req.body.address,
        rating: req.body.rating || 3
    });

    try {
        const newSupplier = await supplier.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'add',
            details: `Added supplier: ${newSupplier.name}`,
            user: 'Admin'
        }).save();
        
        res.status(201).json(newSupplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update supplier
router.patch('/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        const updateFields = ['name', 'contact', 'email', 'phone', 'category', 'address', 'rating'];
        
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                supplier[field] = req.body[field];
            }
        });

        const updatedSupplier = await supplier.save();
        
        // Log audit entry
        await new AuditLog({
            action: 'edit',
            details: `Updated supplier: ${updatedSupplier.name}`,
            user: 'Admin'
        }).save();
        
        res.json(updatedSupplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        const supplierName = supplier.name;
        await Supplier.findByIdAndDelete(req.params.id);
        
        // Log audit entry
        await new AuditLog({
            action: 'delete',
            details: `Deleted supplier: ${supplierName}`,
            user: 'Admin'
        }).save();
        
        res.json({ message: 'Supplier deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Clear all suppliers
router.delete('/', async (req, res) => {
    try {
        const count = await Supplier.countDocuments();
        await Supplier.deleteMany({});
        
        // Log audit entry
        await new AuditLog({
            action: 'delete',
            details: `Cleared all suppliers (${count} suppliers)`,
            user: 'Admin'
        }).save();
        
        res.json({ message: 'All suppliers cleared', count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
