// Service Worker for Push Notifications

const CACHE_NAME = 'inventory-pro-v1';

// Listen for push events
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received');
    
    let notificationData = {
        title: 'InventoryPro Alert',
        body: 'You have a new notification',
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        data: {}
    };
    
    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }
    
    const options = {
        body: notificationData.body,
        icon: notificationData.icon || '/icons/notification-icon.png',
        badge: notificationData.badge || '/icons/badge-icon.png',
        vibrate: [100, 50, 100],
        data: notificationData.data || {},
        actions: [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        tag: notificationData.data?.type || 'general',
        renotify: true,
        requireInteraction: notificationData.data?.type === 'stock-alert'
    };
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click received');
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // Default action or 'view' action
    let urlToOpen = '/';
    
    if (event.notification.data?.type === 'stock-alert') {
        urlToOpen = '/#inventory';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                // Check if there's already a window open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.postMessage({
                            type: 'notification-click',
                            data: event.notification.data
                        });
                        return client.focus();
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
    console.log('[Service Worker] Push Subscription Change');
    
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true
        }).then(function(subscription) {
            // Send new subscription to server
            return fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription })
            });
        })
    );
});

// Install event
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating...');
    event.waitUntil(clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', function(event) {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
