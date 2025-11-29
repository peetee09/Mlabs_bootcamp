const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const Subscription = require('../models/Subscription');
const NotificationRecipient = require('../models/NotificationRecipient');

// VAPID keys for web push - must be set via environment variables in production
// Generate keys using: npx web-push generate-vapid-keys
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

// Warn if VAPID keys are not configured (required for production)
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn('WARNING: VAPID keys not configured. Push notifications will not work.');
    console.warn('Generate keys using: npx web-push generate-vapid-keys');
    console.warn('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
}

// Configure web-push only if keys are available
if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
        'mailto:admin@tfg.co.za',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
}

// Get VAPID public key for client
router.get('/vapid-public-key', (req, res) => {
    if (!vapidKeys.publicKey) {
        return res.status(503).json({ message: 'Push notifications not configured' });
    }
    res.json({ publicKey: vapidKeys.publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, email } = req.body;
        
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ message: 'Invalid subscription data' });
        }

        // Check if subscription already exists
        let existingSubscription = await Subscription.findOne({ endpoint: subscription.endpoint });
        
        if (existingSubscription) {
            existingSubscription.keys = subscription.keys;
            existingSubscription.email = email || existingSubscription.email;
            existingSubscription.isActive = true;
            await existingSubscription.save();
        } else {
            existingSubscription = await new Subscription({
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                email: email || null,
                isActive: true
            }).save();
        }

        res.status(201).json({ message: 'Subscription saved successfully' });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            return res.status(400).json({ message: 'Endpoint is required' });
        }

        await Subscription.findOneAndUpdate(
            { endpoint },
            { isActive: false }
        );

        res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send push notification to all active subscribers
router.post('/send', async (req, res) => {
    try {
        const { title, body, data, icon } = req.body;
        
        if (!title || !body) {
            return res.status(400).json({ message: 'Title and body are required' });
        }

        const subscriptions = await Subscription.find({ isActive: true });
        
        const payload = JSON.stringify({
            title,
            body,
            icon: icon || '/icons/notification-icon.png',
            badge: '/icons/badge-icon.png',
            data: data || {},
            timestamp: Date.now()
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: sub.keys
                    }, payload);
                    return { success: true, endpoint: sub.endpoint };
                } catch (error) {
                    // If subscription is invalid, mark as inactive
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await Subscription.findOneAndUpdate(
                            { endpoint: sub.endpoint },
                            { isActive: false }
                        );
                    }
                    return { success: false, endpoint: sub.endpoint, error: error.message };
                }
            })
        );

        const successful = results.filter(r => r.value?.success).length;
        const failed = results.filter(r => !r.value?.success).length;

        res.json({ 
            message: 'Notifications sent',
            successful,
            failed,
            total: subscriptions.length
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Send stock alert notification
router.post('/stock-alert', async (req, res) => {
    try {
        const { itemName, currentStock, alertType, reorderLevel } = req.body;
        
        let title, body;
        
        if (alertType === 'out-of-stock') {
            title = '⚠️ Out of Stock Alert';
            body = `${itemName} is now out of stock! Immediate reorder required.`;
        } else {
            title = '📦 Low Stock Warning';
            body = `${itemName} is running low. Current stock: ${currentStock}. Reorder level: ${reorderLevel}`;
        }

        const subscriptions = await Subscription.find({ isActive: true });
        
        const payload = JSON.stringify({
            title,
            body,
            icon: '/icons/notification-icon.png',
            badge: '/icons/badge-icon.png',
            data: {
                type: 'stock-alert',
                alertType,
                itemName,
                currentStock,
                reorderLevel
            },
            timestamp: Date.now()
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: sub.keys
                    }, payload);
                    return { success: true };
                } catch (error) {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await Subscription.findOneAndUpdate(
                            { endpoint: sub.endpoint },
                            { isActive: false }
                        );
                    }
                    return { success: false, error: error.message };
                }
            })
        );

        const successful = results.filter(r => r.value?.success).length;

        res.json({ 
            message: 'Stock alert sent',
            successful,
            total: subscriptions.length
        });
    } catch (error) {
        console.error('Stock alert error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all notification recipients
router.get('/recipients', async (req, res) => {
    try {
        const recipients = await NotificationRecipient.find().sort({ createdAt: -1 });
        res.json(recipients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add notification recipient
router.post('/recipients', async (req, res) => {
    try {
        const { email, name, notifyOnLowStock, notifyOnOutOfStock, notifyOnRestock } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if email already exists
        const existing = await NotificationRecipient.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const recipient = await new NotificationRecipient({
            email,
            name,
            notifyOnLowStock: notifyOnLowStock !== false,
            notifyOnOutOfStock: notifyOnOutOfStock !== false,
            notifyOnRestock: notifyOnRestock === true,
            isActive: true
        }).save();

        res.status(201).json(recipient);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update notification recipient
router.patch('/recipients/:id', async (req, res) => {
    try {
        const recipient = await NotificationRecipient.findById(req.params.id);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        const updateFields = ['email', 'name', 'isActive', 'notifyOnLowStock', 'notifyOnOutOfStock', 'notifyOnRestock'];
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                recipient[field] = req.body[field];
            }
        });

        const updated = await recipient.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete notification recipient
router.delete('/recipients/:id', async (req, res) => {
    try {
        const recipient = await NotificationRecipient.findByIdAndDelete(req.params.id);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }
        res.json({ message: 'Recipient deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Seed default notification recipients
router.post('/recipients/seed', async (req, res) => {
    try {
        const defaultRecipients = [
            { email: 'NhlanhlaC@tfg.co.za', name: 'Nhlanhla C' },
            { email: 'JeriffaMc@tfg.co.za', name: 'Jeriffa Mc' },
            { email: 'PabiI@tfg.co.za', name: 'Pabi I' },
            { email: 'Dr.M@tfg.co.za', name: 'Dr. M' }
        ];

        const results = [];
        for (const recipient of defaultRecipients) {
            const existing = await NotificationRecipient.findOne({ email: recipient.email.toLowerCase() });
            if (!existing) {
                await new NotificationRecipient({
                    email: recipient.email,
                    name: recipient.name,
                    isActive: true,
                    notifyOnLowStock: true,
                    notifyOnOutOfStock: true,
                    notifyOnRestock: false
                }).save();
                results.push({ email: recipient.email, status: 'created' });
            } else {
                results.push({ email: recipient.email, status: 'already exists' });
            }
        }

        res.json({ message: 'Default recipients seeded', results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get subscription count
router.get('/subscriptions/count', async (req, res) => {
    try {
        const activeCount = await Subscription.countDocuments({ isActive: true });
        const totalCount = await Subscription.countDocuments();
        res.json({ active: activeCount, total: totalCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
