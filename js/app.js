// ===== API BASE URL =====
const API_BASE_URL = '/api';

// ===== DATA STORAGE =====
const STORAGE_KEYS = {
    INVENTORY: 'inventoryData',
    USAGE: 'usageData',
    SUPPLIERS: 'suppliersData',
    AUDIT: 'auditLog',
    SETTINGS: 'appSettings',
    NOTIFICATIONS: 'notifications'
};

// ===== STATE =====
let inventoryData = [];
let usageData = [];
let suppliersData = [];
let auditLog = [];
let notifications = [];
let selectedItems = [];
let currentView = 'grid';
let currentPage = 1;
let itemsPerPage = 20;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await loadDataFromAPI();
    } catch (error) {
        console.log('API not available, falling back to localStorage');
        loadDataFromStorage();
    }
    
    updateDashboard();
    renderInventory();
    renderSuppliers();
    renderAuditLog();
    initializeCharts();
    populateDropdowns();
    setupEventListeners();
    checkLowStockAlerts();
    loadSettings();
}

// ===== API FUNCTIONS =====
async function loadDataFromAPI() {
    const [inventoryRes, usageRes, suppliersRes, auditRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inventory`),
        fetch(`${API_BASE_URL}/usage`),
        fetch(`${API_BASE_URL}/suppliers`),
        fetch(`${API_BASE_URL}/audit`)
    ]);

    if (!inventoryRes.ok || !usageRes.ok || !suppliersRes.ok || !auditRes.ok) {
        throw new Error('API not available');
    }

    const inventoryResult = await inventoryRes.json();
    // Handle both paginated and non-paginated responses
    inventoryData = inventoryResult.items || inventoryResult;
    usageData = await usageRes.json();
    suppliersData = await suppliersRes.json();
    auditLog = await auditRes.json();
    notifications = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS) || [];
}


// ===== LOCAL STORAGE (Fallback) =====
function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function loadDataFromStorage() {
    inventoryData = loadFromStorage(STORAGE_KEYS.INVENTORY) || [];
    usageData = loadFromStorage(STORAGE_KEYS.USAGE) || [];
    suppliersData = loadFromStorage(STORAGE_KEYS.SUPPLIERS) || [];
    auditLog = loadFromStorage(STORAGE_KEYS.AUDIT) || [];
    notifications = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS) || [];
}

function saveAllData() {
    saveToStorage(STORAGE_KEYS.INVENTORY, inventoryData);
    saveToStorage(STORAGE_KEYS.USAGE, usageData);
    saveToStorage(STORAGE_KEYS.SUPPLIERS, suppliersData);
    saveToStorage(STORAGE_KEYS.AUDIT, auditLog);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
}

function addAuditEntryLocal(action, details) {
    auditLog.push({ id: generateId(auditLog), action, details, user: 'Admin', timestamp: new Date().toISOString() });
    if (auditLog.length > 500) auditLog = auditLog.slice(-500);
}

// ===== UTILITY FUNCTIONS =====
function getItemId(item) {
    return item._id || item.id;
}

function getItemStatus(item) {
    if (item.status) return item.status;
    if (item.currentStock === 0) return "Out of Stock";
    if (item.currentStock <= item.reorderLevel) return "Low";
    return "Healthy";
}

function getDaysUntilStockout(item) {
    if (item.dailyUsage <= 0) return Infinity;
    return Math.floor(item.currentStock / item.dailyUsage);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

function formatDateTime(date) {
    return new Date(date).toLocaleString();
}

function generateId(array) {
    return array.length > 0 ? Math.max(...array.map(i => i.id || 0)) + 1 : 1;
}

function generateSKU() {
    const sku = 'SKU-' + Date.now().toString(36).toUpperCase();
    document.getElementById('item-sku').value = sku;
}

// ===== PERFORMANCE OPTIMIZATION =====
// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Memoization cache for filtered inventory
let filterCache = {
    key: '',
    result: []
};

function getCacheKey() {
    const search = document.getElementById('inventory-search')?.value?.toLowerCase() || '';
    const category = document.getElementById('category-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    const sortBy = document.getElementById('sort-by')?.value || 'name';
    return `${search}|${category}|${status}|${sortBy}|${inventoryData.length}`;
}

function invalidateFilterCache() {
    filterCache.key = '';
    filterCache.result = [];
}

// ===== DASHBOARD =====
function updateDashboard() {
    const totalItems = inventoryData.length;
    const lowStock = inventoryData.filter(i => getItemStatus(i) === "Low").length;
    const outOfStock = inventoryData.filter(i => getItemStatus(i) === "Out of Stock").length;
    const dailyUsage = inventoryData.reduce((sum, i) => sum + i.dailyUsage, 0);

    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('low-stock').textContent = lowStock;
    document.getElementById('out-of-stock').textContent = outOfStock;
    document.getElementById('daily-usage').textContent = dailyUsage.toFixed(1);

    renderLowStockTable();
    renderRecentActivity();
    renderTopUsedItems();
    renderRecommendations();
    updateNotificationCount();
}

function refreshDashboard() {
    updateDashboard();
    if (window.usageTrendChart) updateCharts();
    showToast('Dashboard refreshed', 'success');
}

// ===== RECOMMENDATIONS SYSTEM =====
function generateRecommendations() {
    const recommendations = [];
    
    // Check for out of stock items - Critical
    const outOfStockItems = inventoryData.filter(i => getItemStatus(i) === "Out of Stock");
    if (outOfStockItems.length > 0) {
        recommendations.push({
            type: 'warning',
            icon: 'exclamation-triangle',
            title: 'Urgent: Items Out of Stock',
            text: `${outOfStockItems.length} item(s) are out of stock and need immediate reordering: ${outOfStockItems.slice(0, 3).map(i => i.name).join(', ')}${outOfStockItems.length > 3 ? '...' : ''}`,
            action: { label: 'Reorder Now', handler: 'generateOrderRequest' },
            priority: 1
        });
    }
    
    // Check for items running low (will run out within 7 days)
    const criticalItems = inventoryData.filter(i => {
        const days = getDaysUntilStockout(i);
        return days !== Infinity && days <= 7 && getItemStatus(i) !== "Out of Stock";
    });
    if (criticalItems.length > 0) {
        recommendations.push({
            type: 'warning',
            icon: 'clock-history',
            title: 'Stock Running Low',
            text: `${criticalItems.length} item(s) will run out within a week. Consider restocking: ${criticalItems.slice(0, 2).map(i => i.name).join(', ')}`,
            action: { label: 'View Items', handler: 'viewInventory' },
            priority: 2
        });
    }
    
    // Optimize reorder levels based on usage patterns
    const underutilizedItems = inventoryData.filter(i => {
        const daysStock = getDaysUntilStockout(i);
        return daysStock !== Infinity && daysStock > 90 && i.currentStock > i.reorderLevel * 3;
    });
    if (underutilizedItems.length > 0) {
        recommendations.push({
            type: 'info',
            icon: 'lightbulb',
            title: 'Optimize Stock Levels',
            text: `${underutilizedItems.length} item(s) have excess stock (90+ days). Consider reducing reorder quantities to free up storage.`,
            action: null,
            priority: 4
        });
    }
    
    // High usage items recommendation
    const highUsageItems = inventoryData.filter(i => i.dailyUsage > 5);
    if (highUsageItems.length > 0) {
        recommendations.push({
            type: 'info',
            icon: 'graph-up',
            title: 'High Consumption Items',
            text: `${highUsageItems.length} item(s) have high daily usage. Consider bulk ordering or negotiating better rates with suppliers.`,
            action: { label: 'View Usage', handler: 'viewUsage' },
            priority: 3
        });
    }
    
    // If inventory is healthy, show positive feedback
    if (recommendations.length === 0 && inventoryData.length > 0) {
        recommendations.push({
            type: 'success',
            icon: 'check-circle',
            title: 'Inventory Health: Excellent',
            text: 'All stock levels are healthy. No immediate actions required.',
            action: null,
            priority: 5
        });
    }
    
    // System optimization tip
    if (inventoryData.length > 0 && suppliersData.length === 0) {
        recommendations.push({
            type: 'info',
            icon: 'truck',
            title: 'Add Suppliers',
            text: 'Link items to suppliers for better order management and tracking.',
            action: { label: 'Add Supplier', handler: 'showAddSupplierModal' },
            priority: 6
        });
    }
    
    return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

// Helper functions for recommendation actions
function viewInventory() {
    showTab('inventory');
}

function viewUsage() {
    showTab('usage');
}

function renderRecommendations() {
    const container = document.getElementById('recommendations-container');
    if (!container) return;
    
    const recommendations = generateRecommendations();
    
    if (recommendations.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-card ${rec.type}">
            <div class="rec-icon ${rec.type}">
                <i class="bi bi-${rec.icon}"></i>
            </div>
            <div class="rec-content">
                <div class="rec-title">${rec.title}</div>
                <p class="rec-text">${rec.text}</p>
            </div>
            ${rec.action ? `
            <div class="rec-action">
                <button class="btn btn-sm btn-outline-primary" onclick="${rec.action.handler}()">
                    ${rec.action.label}
                </button>
            </div>
            ` : ''}
        </div>
    `).join('');
}

function renderLowStockTable() {
    const tbody = document.getElementById('low-stock-table');
    const lowStockItems = inventoryData.filter(i => getItemStatus(i) !== "Healthy").slice(0, 5);
    
    if (lowStockItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No low stock items</td></tr>';
        return;
    }

    tbody.innerHTML = lowStockItems.map(item => {
        const days = getDaysUntilStockout(item);
        const itemId = getItemId(item);
        return `<tr>
            <td>${item.name}</td>
            <td><span class="badge ${getItemStatus(item) === 'Out of Stock' ? 'bg-danger' : 'bg-warning'}">${item.currentStock}</span></td>
            <td>${days === Infinity ? 'N/A' : days + ' days'}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="showRestockModal('${itemId}')">Restock</button></td>
        </tr>`;
    }).join('');
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    const recentAudit = auditLog.slice(-10).reverse();
    
    if (recentAudit.length === 0) {
        container.innerHTML = '<p class="text-muted text-center p-3">No recent activity</p>';
        return;
    }

    container.innerHTML = recentAudit.map(entry => `
        <div class="activity-item">
            <div class="activity-icon ${entry.action}"><i class="bi bi-${getActionIcon(entry.action)}"></i></div>
            <div class="activity-content">
                <p class="activity-text">${entry.details}</p>
                <span class="activity-time">${formatDateTime(entry.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

function getActionIcon(action) {
    const icons = { add: 'plus-circle', edit: 'pencil', delete: 'trash', usage: 'graph-down', restock: 'box-arrow-in-down' };
    return icons[action] || 'circle';
}

function renderTopUsedItems() {
    const container = document.getElementById('top-used-items');
    const usageByItem = {};
    
    usageData.forEach(record => {
        const itemId = record.itemId?._id || record.itemId;
        usageByItem[itemId] = (usageByItem[itemId] || 0) + record.quantity;
    });

    const sortedItems = Object.keys(usageByItem)
        .map(itemId => {
            const item = inventoryData.find(i => getItemId(i) === itemId || getItemId(i) === String(itemId));
            return { id: itemId, name: item ? item.name : 'Unknown', usage: usageByItem[itemId] };
        })
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);

    if (sortedItems.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted text-center">No usage data available</p></div>';
        return;
    }

    container.innerHTML = sortedItems.map((item, index) => `
        <div class="col">
            <div class="top-item-card">
                <div class="top-item-rank">#${index + 1}</div>
                <div class="top-item-name">${item.name}</div>
                <div class="top-item-usage">${item.usage} units used</div>
            </div>
        </div>
    `).join('');
}

// ===== INVENTORY =====
function renderInventory() {
    const filtered = getFilteredInventory();
    const paginated = paginateData(filtered);
    
    if (currentView === 'grid') {
        renderInventoryGrid(paginated);
    } else {
        renderInventoryTable(paginated);
    }
    renderPagination(filtered.length, 'inventory-pagination');
}

function getFilteredInventory() {
    // Use cache if available
    const cacheKey = getCacheKey();
    if (filterCache.key === cacheKey) {
        return filterCache.result;
    }
    
    let filtered = [...inventoryData];
    const search = document.getElementById('inventory-search')?.value?.toLowerCase() || '';
    const category = document.getElementById('category-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    const sortBy = document.getElementById('sort-by')?.value || 'name';

    if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search) || i.sku?.toLowerCase().includes(search));
    if (category) filtered = filtered.filter(i => i.category === category);
    if (status) filtered = filtered.filter(i => getItemStatus(i) === status);

    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'stock': return a.currentStock - b.currentStock;
            case 'usage': return b.dailyUsage - a.dailyUsage;
            case 'status': return getItemStatus(a).localeCompare(getItemStatus(b));
            default: return a.name.localeCompare(b.name);
        }
    });

    // Store in cache
    filterCache.key = cacheKey;
    filterCache.result = filtered;
    
    return filtered;
}

function paginateData(data) {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
}

function renderInventoryGrid(items) {
    const container = document.getElementById('inventory-grid');
    container.classList.remove('d-none');
    document.getElementById('inventory-table-container').classList.add('d-none');

    if (items.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted text-center">No items found</p></div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const status = getItemStatus(item);
        const statusClass = status === 'Out of Stock' ? 'out-of-stock' : status === 'Low' ? 'low-stock' : '';
        const days = getDaysUntilStockout(item);
        const itemId = getItemId(item);

        return `
        <div class="inventory-item ${statusClass}">
            <input type="checkbox" class="item-checkbox form-check-input" value="${itemId}" onchange="toggleItemSelection('${itemId}')">
            <div class="item-header">
                <div>
                    <h5 class="item-name">${item.name}</h5>
                    <span class="item-category">${item.category}</span>
                </div>
                <span class="badge ${status === 'Healthy' ? 'bg-success' : status === 'Low' ? 'bg-warning' : 'bg-danger'}">${status}</span>
            </div>
            <div class="item-stats">
                <div class="stat-item"><div class="stat-value">${item.currentStock}</div><div class="stat-label">In Stock</div></div>
                <div class="stat-item"><div class="stat-value">${days === Infinity ? '∞' : days}</div><div class="stat-label">Days Left</div></div>
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="showRecordUsageModal('${itemId}')"><i class="bi bi-clipboard-check"></i></button>
                <button class="btn btn-sm btn-outline-success" onclick="showRestockModal('${itemId}')"><i class="bi bi-box-arrow-in-down"></i></button>
                <button class="btn btn-sm btn-outline-secondary" onclick="showEditItemModal('${itemId}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${itemId}')"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function renderInventoryTable(items) {
    document.getElementById('inventory-grid').classList.add('d-none');
    document.getElementById('inventory-table-container').classList.remove('d-none');
    const tbody = document.getElementById('inventory-table-body');

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No items found</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const status = getItemStatus(item);
        const supplier = suppliersData.find(s => {
            const supplierId = item.supplierId?._id || item.supplierId;
            return getItemId(s) === supplierId || getItemId(s) === String(supplierId);
        });
        const itemId = getItemId(item);
        return `<tr>
            <td><input type="checkbox" class="form-check-input" value="${itemId}" onchange="toggleItemSelection('${itemId}')"></td>
            <td>${itemId}</td>
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td>${item.currentStock}</td>
            <td>${item.reorderLevel}</td>
            <td>${item.dailyUsage.toFixed(1)}</td>
            <td><span class="badge ${status === 'Healthy' ? 'bg-success' : status === 'Low' ? 'bg-warning' : 'bg-danger'}">${status}</span></td>
            <td>${supplier ? supplier.name : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showRecordUsageModal('${itemId}')"><i class="bi bi-clipboard-check"></i></button>
                <button class="btn btn-sm btn-outline-success" onclick="showRestockModal('${itemId}')"><i class="bi bi-box-arrow-in-down"></i></button>
                <button class="btn btn-sm btn-outline-secondary" onclick="showEditItemModal('${itemId}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${itemId}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function setInventoryView(view) {
    currentView = view;
    document.getElementById('view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('view-table').classList.toggle('active', view === 'table');
    renderInventory();
}

function renderPagination(totalItems, containerId) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const container = document.getElementById(containerId);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="goToPage(${currentPage - 1})">Previous</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${currentPage === i ? 'active' : ''}"><a class="page-link" href="#" onclick="goToPage(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="goToPage(${currentPage + 1})">Next</a></li>`;
    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderInventory();
}

// ===== ITEM OPERATIONS =====
function showAddItemModal() {
    document.getElementById('add-item-form').reset();
    populateSupplierDropdown('item-supplier');
    new bootstrap.Modal(document.getElementById('addItemModal')).show();
}

async function addNewItem() {
    const name = document.getElementById('item-name').value.trim();
    const category = document.getElementById('item-category').value;
    const initialStock = parseInt(document.getElementById('initial-stock').value) || 0;
    const reorderLevel = parseInt(document.getElementById('reorder-level').value) || 1;
    const dailyUsage = parseFloat(document.getElementById('daily-usage-input').value) || 0;
    const unitPrice = parseFloat(document.getElementById('unit-price').value) || 0;
    const supplierId = document.getElementById('item-supplier').value || null;
    const description = document.getElementById('item-description').value.trim();
    const sku = document.getElementById('item-sku').value.trim();

    if (!name || !category) {
        showToast('Please fill in required fields', 'error');
        return;
    }

    const newItem = {
        name, category, currentStock: initialStock, reorderLevel, dailyUsage, unitPrice, supplierId, description, sku
    };

    try {
        const response = await fetch(`${API_BASE_URL}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });

        if (response.ok) {
            const savedItem = await response.json();
            inventoryData.push(savedItem);
        } else {
            throw new Error('Failed to save item');
        }
    } catch (error) {
        console.log('API not available, saving locally');
        newItem.id = generateId(inventoryData);
        inventoryData.push(newItem);
        addAuditEntryLocal('add', `Added new item: ${name}`);
        saveAllData();
    }
    
    bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
    invalidateFilterCache();
    updateDashboard();
    renderInventory();
    populateDropdowns();
    showToast('Item added successfully', 'success');
}

async function showEditItemModal(id) {
    const item = inventoryData.find(i => getItemId(i) === id || getItemId(i) === String(id));
    if (!item) return;

    document.getElementById('edit-item-id').value = getItemId(item);
    document.getElementById('edit-item-name').value = item.name;
    document.getElementById('edit-item-category').value = item.category;
    document.getElementById('edit-current-stock').value = item.currentStock;
    document.getElementById('edit-reorder-level').value = item.reorderLevel;
    document.getElementById('edit-daily-usage').value = item.dailyUsage;
    document.getElementById('edit-unit-price').value = item.unitPrice || 0;
    document.getElementById('edit-item-description').value = item.description || '';
    document.getElementById('edit-item-sku').value = item.sku || '';
    
    populateSupplierDropdown('edit-item-supplier');
    const supplierId = item.supplierId?._id || item.supplierId;
    document.getElementById('edit-item-supplier').value = supplierId || '';

    new bootstrap.Modal(document.getElementById('editItemModal')).show();
}

async function updateItem() {
    const id = document.getElementById('edit-item-id').value;
    const item = inventoryData.find(i => getItemId(i) === id || getItemId(i) === String(id));
    if (!item) return;

    const updatedData = {
        name: document.getElementById('edit-item-name').value.trim(),
        category: document.getElementById('edit-item-category').value,
        currentStock: parseInt(document.getElementById('edit-current-stock').value) || 0,
        reorderLevel: parseInt(document.getElementById('edit-reorder-level').value) || 1,
        dailyUsage: parseFloat(document.getElementById('edit-daily-usage').value) || 0,
        unitPrice: parseFloat(document.getElementById('edit-unit-price').value) || 0,
        supplierId: document.getElementById('edit-item-supplier').value || null,
        description: document.getElementById('edit-item-description').value.trim(),
        sku: document.getElementById('edit-item-sku').value.trim()
    };

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            const savedItem = await response.json();
            const index = inventoryData.findIndex(i => getItemId(i) === id || getItemId(i) === String(id));
            if (index !== -1) {
                inventoryData[index] = savedItem;
            }
        } else {
            throw new Error('Failed to update item');
        }
    } catch (error) {
        console.log('API not available, saving locally');
        Object.assign(item, updatedData);
        addAuditEntryLocal('edit', `Updated item: ${item.name}`);
        saveAllData();
    }

    bootstrap.Modal.getInstance(document.getElementById('editItemModal')).hide();
    invalidateFilterCache();
    updateDashboard();
    renderInventory();
    showToast('Item updated successfully', 'success');
}

async function deleteItem(id) {
    const item = inventoryData.find(i => getItemId(i) === id || getItemId(i) === String(id));
    if (!item || !confirm(`Delete "${item.name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            inventoryData = inventoryData.filter(i => getItemId(i) !== id && getItemId(i) !== String(id));
            // Also delete usage data for this item
            await fetch(`${API_BASE_URL}/usage/item/${id}`, { method: 'DELETE' });
            usageData = usageData.filter(u => (u.itemId !== id && u.itemId !== String(id) && u.itemId?._id !== id));
        } else {
            throw new Error('Failed to delete item');
        }
    } catch (error) {
        console.log('API not available, deleting locally');
        inventoryData = inventoryData.filter(i => getItemId(i) !== id);
        usageData = usageData.filter(u => u.itemId !== id);
        addAuditEntryLocal('delete', `Deleted item: ${item.name}`);
        saveAllData();
    }

    invalidateFilterCache();
    updateDashboard();
    renderInventory();
    populateDropdowns();
    showToast('Item deleted', 'success');
}

// ===== USAGE & RESTOCK =====
function showRecordUsageModal(itemId = null) {
    populateItemDropdown('usage-item');
    document.getElementById('usage-date').value = new Date().toISOString().split('T')[0];
    if (itemId) document.getElementById('usage-item').value = itemId;
    new bootstrap.Modal(document.getElementById('recordUsageModal')).show();
}

async function recordUsage() {
    const itemId = document.getElementById('usage-item').value;
    const quantity = parseInt(document.getElementById('usage-quantity').value);
    const date = document.getElementById('usage-date').value;
    const notes = document.getElementById('usage-notes').value;

    const item = inventoryData.find(i => getItemId(i) === itemId || getItemId(i) === String(itemId));
    if (!item || quantity <= 0) {
        showToast('Invalid input', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: itemId,
                quantity: quantity,
                date: new Date(date).toISOString(),
                notes: notes
            })
        });

        if (response.ok) {
            const result = await response.json();
            usageData.push(result.usage);
            // Update local item data
            const index = inventoryData.findIndex(i => getItemId(i) === itemId || getItemId(i) === String(itemId));
            if (index !== -1 && result.item) {
                inventoryData[index] = result.item;
            }
        } else {
            throw new Error('Failed to record usage');
        }
    } catch (error) {
        console.log('API not available, saving locally');
        item.currentStock = Math.max(0, item.currentStock - quantity);
        usageData.push({ id: generateId(usageData), itemId: getItemId(item), itemName: item.name, category: item.category, quantity, date: new Date(date).toISOString(), notes });
        addAuditEntryLocal('usage', `Used ${quantity} of ${item.name}`);
        saveAllData();
    }

    bootstrap.Modal.getInstance(document.getElementById('recordUsageModal')).hide();
    invalidateFilterCache();
    updateDashboard();
    renderInventory();
    checkLowStockAlerts();
    showToast('Usage recorded', 'success');
}

function showRestockModal(id) {
    const item = inventoryData.find(i => getItemId(i) === id || getItemId(i) === String(id));
    if (!item) return;

    document.getElementById('restock-item-id').value = getItemId(item);
    document.getElementById('restock-item-name').value = item.name;
    document.getElementById('restock-current-stock').value = item.currentStock;
    document.getElementById('restock-quantity').value = '';
    document.getElementById('restock-notes').value = '';

    new bootstrap.Modal(document.getElementById('restockModal')).show();
}

async function restockItem() {
    const id = document.getElementById('restock-item-id').value;
    const quantity = parseInt(document.getElementById('restock-quantity').value);
    const item = inventoryData.find(i => getItemId(i) === id || getItemId(i) === String(id));

    if (!item || quantity <= 0) {
        showToast('Invalid quantity', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}/restock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity })
        });

        if (response.ok) {
            const updatedItem = await response.json();
            const index = inventoryData.findIndex(i => getItemId(i) === id || getItemId(i) === String(id));
            if (index !== -1) {
                inventoryData[index] = updatedItem;
            }
        } else {
            throw new Error('Failed to restock item');
        }
    } catch (error) {
        console.log('API not available, saving locally');
        item.currentStock += quantity;
        addAuditEntryLocal('restock', `Restocked ${quantity} of ${item.name}`);
        saveAllData();
    }

    bootstrap.Modal.getInstance(document.getElementById('restockModal')).hide();
    invalidateFilterCache();
    updateDashboard();
    renderInventory();
    showToast('Item restocked', 'success');
}

// ===== SUPPLIERS =====
function renderSuppliers() {
    const tbody = document.getElementById('suppliers-table');
    if (suppliersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No suppliers</td></tr>';
        return;
    }

    tbody.innerHTML = suppliersData.map(s => `
        <tr>
            <td>${getItemId(s)}</td>
            <td>${s.name}</td>
            <td>${s.contact}</td>
            <td>${s.email}</td>
            <td>${s.phone}</td>
            <td>${s.category}</td>
            <td>${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="editSupplier('${getItemId(s)}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier('${getItemId(s)}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function showAddSupplierModal() {
    document.getElementById('supplier-form').reset();
    new bootstrap.Modal(document.getElementById('addSupplierModal')).show();
}

async function addSupplier() {
    const name = document.getElementById('supplier-name').value.trim();
    const contact = document.getElementById('supplier-contact').value.trim();
    const email = document.getElementById('supplier-email').value.trim();
    const phone = document.getElementById('supplier-phone').value.trim();
    const category = document.getElementById('supplier-category').value;
    const address = document.getElementById('supplier-address').value.trim();

    if (!name || !contact || !email || !phone) {
        showToast('Please fill required fields', 'error');
        return;
    }

    const newSupplier = { name, contact, email, phone, category, address, rating: 3 };

    try {
        const response = await fetch(`${API_BASE_URL}/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSupplier)
        });

        if (response.ok) {
            const savedSupplier = await response.json();
            suppliersData.push(savedSupplier);
        } else {
            throw new Error('Failed to save supplier');
        }
    } catch (error) {
        console.log('API not available, saving locally');
        newSupplier.id = generateId(suppliersData);
        suppliersData.push(newSupplier);
        addAuditEntryLocal('add', `Added supplier: ${name}`);
        saveAllData();
    }

    bootstrap.Modal.getInstance(document.getElementById('addSupplierModal')).hide();
    renderSuppliers();
    populateDropdowns();
    showToast('Supplier added', 'success');
}

async function deleteSupplier(id) {
    const supplier = suppliersData.find(s => getItemId(s) === id || getItemId(s) === String(id));
    if (!supplier || !confirm(`Delete supplier "${supplier.name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            suppliersData = suppliersData.filter(s => getItemId(s) !== id && getItemId(s) !== String(id));
        } else {
            throw new Error('Failed to delete supplier');
        }
    } catch (error) {
        console.log('API not available, deleting locally');
        suppliersData = suppliersData.filter(s => getItemId(s) !== id);
        addAuditEntryLocal('delete', `Deleted supplier: ${supplier.name}`);
        saveAllData();
    }

    renderSuppliers();
    showToast('Supplier deleted', 'success');
}

// ===== AUDIT LOG =====
async function addAuditEntry(action, details) {
    try {
        const response = await fetch(`${API_BASE_URL}/audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, details, user: 'Admin' })
        });

        if (response.ok) {
            const log = await response.json();
            auditLog.unshift(log);
            if (auditLog.length > 500) auditLog = auditLog.slice(0, 500);
        }
    } catch (error) {
        addAuditEntryLocal(action, details);
    }
}

function renderAuditLog() {
    const tbody = document.getElementById('audit-log-table');
    const recent = auditLog.slice(0, 50);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No audit entries</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(entry => `
        <tr>
            <td>${formatDateTime(entry.timestamp)}</td>
            <td>${entry.user}</td>
            <td><span class="badge bg-secondary">${entry.action}</span></td>
            <td>${entry.details}</td>
            <td>-</td>
        </tr>
    `).join('');
}

// ===== CHARTS =====
function initializeCharts() {
    // Usage Trend Chart
    const usageCtx = document.getElementById('usageTrendChart')?.getContext('2d');
    if (usageCtx) {
        window.usageTrendChart = new Chart(usageCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Daily Usage', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#3498db' }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                return `Usage: ${context.raw} units`;
                            }
                        }
                    }
                }, 
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }

    // Category Chart
    const catCtx = document.getElementById('categoryChart')?.getContext('2d');
    if (catCtx) {
        window.categoryChart = new Chart(catCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    updateCharts();
}

function updateCharts() {
    // Update usage trend
    const last7Days = [];
    const usageByDay = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        last7Days.push(key);
        usageByDay[key] = 0;
    }

    usageData.forEach(record => {
        const key = new Date(record.date).toISOString().split('T')[0];
        if (usageByDay[key] !== undefined) usageByDay[key] += record.quantity;
    });

    const usageValues = last7Days.map(d => usageByDay[d]);
    const dayLabels = last7Days.map(d => new Date(d).toLocaleDateString('en', { weekday: 'short' }));

    if (window.usageTrendChart) {
        window.usageTrendChart.data.labels = dayLabels;
        window.usageTrendChart.data.datasets[0].data = usageValues;
        
        // Highlight the peak day with a different color
        const maxUsage = Math.max(...usageValues);
        const nonZeroValues = usageValues.filter(v => v > 0);
        const minNonZeroUsage = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
        const pointColors = usageValues.map(val => {
            if (val === maxUsage && maxUsage > 0) return '#e74c3c';
            if (val === minNonZeroUsage && minNonZeroUsage > 0) return '#2ecc71';
            return '#3498db';
        });
        window.usageTrendChart.data.datasets[0].pointBackgroundColor = pointColors;
        window.usageTrendChart.data.datasets[0].pointBorderColor = pointColors;
        window.usageTrendChart.update();
    }

    // Update peak usage indicator
    updatePeakIndicator(last7Days, usageByDay, dayLabels);

    // Update category chart
    const categories = {};
    inventoryData.forEach(item => {
        categories[item.category] = (categories[item.category] || 0) + 1;
    });

    if (window.categoryChart) {
        window.categoryChart.data.labels = Object.keys(categories);
        window.categoryChart.data.datasets[0].data = Object.values(categories);
        window.categoryChart.update();
    }
}

function updatePeakIndicator(days, usageByDay, dayLabels) {
    const container = document.getElementById('usage-peak-indicator');
    if (!container) return;

    const usageEntries = days.map((day, idx) => ({
        day: dayLabels[idx],
        usage: usageByDay[day],
        date: day
    }));

    const totalUsage = usageEntries.reduce((sum, e) => sum + e.usage, 0);
    
    if (totalUsage === 0) {
        container.innerHTML = '<span class="text-muted">No usage data for the selected period</span>';
        return;
    }

    const maxEntry = usageEntries.reduce((max, e) => e.usage > max.usage ? e : max, usageEntries[0]);
    const nonZeroEntries = usageEntries.filter(e => e.usage > 0);
    const minEntry = nonZeroEntries.length > 0 
        ? nonZeroEntries.reduce((min, e) => e.usage < min.usage ? e : min, nonZeroEntries[0])
        : maxEntry;
    const avgUsage = (totalUsage / days.length).toFixed(1);

    container.innerHTML = `
        <span class="peak-item highest" title="Highest usage day">
            <i class="bi bi-arrow-up-circle-fill"></i>
            Peak: ${maxEntry.day} (${maxEntry.usage} units)
        </span>
        <span class="peak-item lowest" title="Lowest usage day">
            <i class="bi bi-arrow-down-circle-fill"></i>
            Low: ${minEntry.day} (${minEntry.usage} units)
        </span>
        <span class="peak-item" title="Average daily usage">
            <i class="bi bi-bar-chart-fill"></i>
            Avg: ${avgUsage} units/day
        </span>
    `;
}

// ===== NOTIFICATIONS =====
function checkLowStockAlerts() {
    const lowItems = inventoryData.filter(i => getItemStatus(i) !== 'Healthy');
    lowItems.forEach(item => {
        const itemId = getItemId(item);
        const existing = notifications.find(n => n.itemId === itemId && !n.read);
        if (!existing) {
            notifications.push({
                id: generateId(notifications),
                itemId: itemId,
                title: getItemStatus(item) === 'Out of Stock' ? 'Out of Stock!' : 'Low Stock Warning',
                message: `${item.name} needs attention (${item.currentStock} left)`,
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    });
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
    updateNotificationCount();
    renderNotifications();
}

function updateNotificationCount() {
    const unread = notifications.filter(n => !n.read).length;
    document.getElementById('notification-count').textContent = unread;
    document.getElementById('notification-count').style.display = unread > 0 ? 'block' : 'none';
}

function renderNotifications() {
    const container = document.getElementById('notifications-list');
    if (notifications.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No notifications</p>';
        return;
    }

    container.innerHTML = notifications.slice(-20).reverse().map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
            <h6>${n.title}</h6>
            <p>${n.message}</p>
            <span class="time">${formatDateTime(n.timestamp)}</span>
        </div>
    `).join('');
}

function markNotificationRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) notification.read = true;
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
    updateNotificationCount();
    renderNotifications();
}

function clearNotifications() {
    notifications = [];
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
    updateNotificationCount();
    renderNotifications();
}

// ===== REPORTS & EXPORTS =====
function generateOrderRequest() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Order Request', 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 35);

    const lowStockItems = inventoryData.filter(i => getItemStatus(i) !== 'Healthy');
    const tableData = lowStockItems.map(item => [item.name, item.category, item.currentStock, item.reorderLevel, Math.max(item.reorderLevel * 2, 10)]);

    doc.autoTable({
        startY: 45,
        head: [['Item', 'Category', 'Current Stock', 'Reorder Level', 'Order Qty']],
        body: tableData,
        theme: 'grid'
    });

    doc.save('order-request.pdf');
    showToast('PDF generated', 'success');
}

function exportInventory() {
    const wb = XLSX.utils.book_new();
    const data = inventoryData.map(item => ({
        ID: item.id, Name: item.name, Category: item.category, Stock: item.currentStock,
        'Reorder Level': item.reorderLevel, 'Daily Usage': item.dailyUsage, 'Unit Price': item.unitPrice,
        Status: getItemStatus(item), SKU: item.sku || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory-export.xlsx');
    showToast('Inventory exported', 'success');
}

function showImportModal() {
    new bootstrap.Modal(document.getElementById('importModal')).show();
}

function importInventory() {
    const file = document.getElementById('import-file').files[0];
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        json.forEach(row => {
            inventoryData.push({
                id: generateId(inventoryData),
                name: row.Name || row.name || 'Unknown',
                category: (row.Category || row.category || 'other').toLowerCase(),
                currentStock: parseInt(row.Stock || row.stock || 0),
                reorderLevel: parseInt(row['Reorder Level'] || row.reorderLevel || 10),
                dailyUsage: parseFloat(row['Daily Usage'] || row.dailyUsage || 0),
                unitPrice: parseFloat(row['Unit Price'] || row.unitPrice || 0),
                sku: row.SKU || row.sku || ''
            });
        });

        addAuditEntry('add', `Imported ${json.length} items`);
        saveAllData();
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        updateDashboard();
        renderInventory();
        showToast(`Imported ${json.length} items`, 'success');
    };
    reader.readAsArrayBuffer(file);
}

function generateReport() {
    const type = document.getElementById('report-type').value;
    const format = document.getElementById('report-format').value;

    let data = [];
    let filename = '';

    switch(type) {
        case 'inventory':
            data = inventoryData.map(i => ({ Name: i.name, Category: i.category, Stock: i.currentStock, Status: getItemStatus(i) }));
            filename = 'inventory-report';
            break;
        case 'usage':
            data = usageData.map(u => ({ Item: u.itemName, Quantity: u.quantity, Date: formatDate(u.date) }));
            filename = 'usage-report';
            break;
        default:
            data = inventoryData;
            filename = 'report';
    }

    if (format === 'excel' || format === 'csv') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(filename.replace('-', ' ').toUpperCase(), 20, 20);
        doc.autoTable({ startY: 30, head: [Object.keys(data[0] || {})], body: data.map(d => Object.values(d)) });
        doc.save(`${filename}.pdf`);
    }

    showToast('Report generated', 'success');
}

function quickReport(type) {
    document.getElementById('report-type').value = type === 'low-stock' ? 'inventory' : type === 'monthly-usage' ? 'usage' : 'inventory';
    generateReport();
}

// ===== SETTINGS =====
function loadSettings() {
    const settings = loadFromStorage(STORAGE_KEYS.SETTINGS) || {};
    if (settings.darkMode) document.body.setAttribute('data-theme', 'dark');
    if (settings.itemsPerPage) itemsPerPage = settings.itemsPerPage;
}

function saveSettings() {
    const settings = {
        companyName: document.getElementById('company-name').value,
        lowStockThreshold: document.getElementById('low-stock-threshold').value,
        leadTime: document.getElementById('lead-time').value,
        darkMode: document.getElementById('dark-mode-setting').checked,
        itemsPerPage: parseInt(document.getElementById('items-per-page').value)
    };
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
    itemsPerPage = settings.itemsPerPage;
    showToast('Settings saved', 'success');
}

function backupData() {
    const backup = { inventoryData, usageData, suppliersData, auditLog, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Backup created', 'success');
}

function restoreData() {
    const file = document.getElementById('restore-file').files[0];
    if (!file) {
        showToast('Please select a backup file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            inventoryData = backup.inventoryData || [];
            usageData = backup.usageData || [];
            suppliersData = backup.suppliersData || [];
            auditLog = backup.auditLog || [];
            saveAllData();
            initializeApp();
            showToast('Data restored', 'success');
        } catch (err) {
            showToast('Invalid backup file', 'error');
        }
    };
    reader.readAsText(file);
}

async function resetData() {
    if (!confirm('This will delete ALL data including data stored in the database. Continue?')) return;
    
    // Try to clear data from API
    try {
        // Clear data collections first (these log to audit)
        await Promise.allSettled([
            fetch(`${API_BASE_URL}/inventory`, { method: 'DELETE' }),
            fetch(`${API_BASE_URL}/usage`, { method: 'DELETE' }),
            fetch(`${API_BASE_URL}/suppliers`, { method: 'DELETE' })
        ]);
        
        // Clear audit log last
        await fetch(`${API_BASE_URL}/audit/clear`, { method: 'DELETE' });
    } catch (error) {
        console.log('API not available or error clearing data:', error);
    }
    
    // Clear localStorage
    if (!confirm('This will delete ALL data. Continue?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/data/clear-all`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear database');
        }
    } catch (error) {
        console.log('Failed to clear server data, proceeding with local storage clearing only:', error.message);
    }
    
    localStorage.clear();
    
    // Reset local arrays
    inventoryData = [];
    usageData = [];
    suppliersData = [];
    auditLog = [];
    notifications = [];
    
    // Update UI
    updateDashboard();
    renderInventory();
    renderSuppliers();
    renderAuditLog();
    initializeCharts();
    populateDropdowns();
    showToast('All data has been reset', 'success');
}

// ===== UI HELPERS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const id = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
    
    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-body d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `);

    const toast = new bootstrap.Toast(document.getElementById(id), { delay: 3000 });
    toast.show();
    document.getElementById(id).addEventListener('hidden.bs.toast', () => document.getElementById(id).remove());
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabName + '-content').classList.add('active');
    document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'usage') initUsageCharts();
    if (tabName === 'forecast') renderForecast();
}

function initUsageCharts() {
    const monthlyCtx = document.getElementById('monthlyUsageChart')?.getContext('2d');
    if (monthlyCtx && !window.monthlyUsageChart) {
        window.monthlyUsageChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], datasets: [{ label: 'Usage', data: [120, 190, 150, 180, 200, 170], backgroundColor: '#3498db' }] },
            options: { responsive: true }
        });
    }
}

function renderForecast() {
    const tbody = document.getElementById('forecast-table');
    const items = inventoryData.map(item => {
        const days = getDaysUntilStockout(item);
        let priority = 'low';
        if (days <= 7) priority = 'high';
        else if (days <= 14) priority = 'medium';
        
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() + Math.max(0, days - 7));
        
        return { ...item, days, priority, orderDate };
    }).sort((a, b) => a.days - b.days);

    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.currentStock}</td>
            <td>${item.days === Infinity ? 'N/A' : item.days}</td>
            <td>${item.days === Infinity ? 'N/A' : formatDate(item.orderDate)}</td>
            <td><span class="badge priority-${item.priority}">${item.priority}</span></td>
        </tr>
    `).join('');
}

function populateDropdowns() {
    populateItemDropdown('usage-item');
    populateItemDropdown('usage-item-filter');
    populateSupplierDropdown('item-supplier');
    populateSupplierDropdown('edit-item-supplier');
}

function populateItemDropdown(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Select Item</option>' + 
        inventoryData.map(item => `<option value="${getItemId(item)}">${item.name}</option>`).join('');
}

function populateSupplierDropdown(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Select Supplier</option>' + 
        suppliersData.map(s => `<option value="${getItemId(s)}">${s.name}</option>`).join('');
}

function toggleItemSelection(id) {
    const idx = selectedItems.indexOf(id);
    if (idx > -1) selectedItems.splice(idx, 1);
    else selectedItems.push(id);
    document.getElementById('bulk-action-btn').disabled = selectedItems.length === 0;
}

function toggleSelectAll() {
    const checked = document.getElementById('select-all').checked;
    selectedItems = checked ? inventoryData.map(i => getItemId(i)) : [];
    document.querySelectorAll('.item-checkbox, .form-check-input[type="checkbox"]').forEach(cb => cb.checked = checked);
    document.getElementById('bulk-action-btn').disabled = selectedItems.length === 0;
}

// ===== EVENT LISTENERS =====
// Debounced search handler for performance
const debouncedSearch = debounce(() => {
    currentPage = 1;
    renderInventory();
}, 250);

const debouncedGlobalSearch = debounce((query) => {
    if (query.length > 2) {
        document.getElementById('inventory-search').value = query;
        showTab('inventory');
        renderInventory();
    }
}, 300);

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', () => showTab(item.dataset.tab));
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Dark mode toggle
    document.getElementById('dark-mode-toggle')?.addEventListener('click', toggleDarkMode);
    document.getElementById('dark-mode-setting')?.addEventListener('change', toggleDarkMode);

    // Notification button
    document.getElementById('notification-btn')?.addEventListener('click', () => {
        new bootstrap.Offcanvas(document.getElementById('notificationsPanel')).show();
    });

    // Search and filters with debouncing for better performance
    document.getElementById('inventory-search')?.addEventListener('input', debouncedSearch);
    document.getElementById('category-filter')?.addEventListener('change', () => { currentPage = 1; invalidateFilterCache(); renderInventory(); });
    document.getElementById('status-filter')?.addEventListener('change', () => { currentPage = 1; invalidateFilterCache(); renderInventory(); });
    document.getElementById('sort-by')?.addEventListener('change', () => { invalidateFilterCache(); renderInventory(); });

    // Global search with debouncing
    document.getElementById('global-search')?.addEventListener('input', (e) => {
        debouncedGlobalSearch(e.target.value.toLowerCase());
    });
}

function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? '' : 'dark');
    const settings = loadFromStorage(STORAGE_KEYS.SETTINGS) || {};
    settings.darkMode = !isDark;
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
}

// ===== PC BARCODE SCANNER =====
function processBarcodeScan() {
    const barcodeInput = document.getElementById('barcode-input');
    const barcode = barcodeInput.value.trim();
    
    if (!barcode) {
        showToast('Please enter or scan a barcode', 'error');
        return;
    }
    
    handleScannedBarcode(barcode);
}

function handleScannedBarcode(barcode) {
    document.getElementById('scan-result').classList.remove('d-none');
    document.getElementById('scan-result-text').textContent = barcode;
    
    const item = inventoryData.find(i => i.sku === barcode);
    if (item) {
        // Close the scan modal
        const scanModal = bootstrap.Modal.getInstance(document.getElementById('scanModal'));
        if (scanModal) {
            scanModal.hide();
        }
        // Open the edit item modal for the found item
        showEditItemModal(getItemId(item));
    } else {
        showToast(`No item found with SKU: ${barcode}`, 'info');
    }
}

function setupBarcodeScanner() {
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        // Handle Enter key press (USB scanners typically send Enter after barcode)
        barcodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                processBarcodeScan();
            }
        });
    }
}

// Initialize barcode scanner when modal is shown
document.getElementById('scanModal')?.addEventListener('shown.bs.modal', () => {
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
    }
    // Reset the scan result display
    document.getElementById('scan-result')?.classList.add('d-none');
});

document.getElementById('scan-btn')?.addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('scanModal')).show();
});

// Setup barcode scanner event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', setupBarcodeScanner);

// Utility functions for external calls
window.showAddItemModal = showAddItemModal;
window.showEditItemModal = showEditItemModal;
window.showRecordUsageModal = showRecordUsageModal;
window.showRestockModal = showRestockModal;
window.showAddSupplierModal = showAddSupplierModal;
window.showImportModal = showImportModal;
window.addNewItem = addNewItem;
window.updateItem = updateItem;
window.deleteItem = deleteItem;
window.recordUsage = recordUsage;
window.restockItem = restockItem;
window.addSupplier = addSupplier;
window.deleteSupplier = deleteSupplier;
window.generateSKU = generateSKU;
window.setInventoryView = setInventoryView;
window.goToPage = goToPage;
window.toggleItemSelection = toggleItemSelection;
window.toggleSelectAll = toggleSelectAll;
window.showTab = showTab;
window.refreshDashboard = refreshDashboard;
window.generateOrderRequest = generateOrderRequest;
window.exportInventory = exportInventory;
window.importInventory = importInventory;
window.generateReport = generateReport;
window.quickReport = quickReport;
window.saveSettings = saveSettings;
window.backupData = backupData;
window.restoreData = restoreData;
window.resetData = resetData;
window.clearNotifications = clearNotifications;
window.markNotificationRead = markNotificationRead;
window.applyUsageFilters = () => {};
window.exportUsageData = exportInventory;
window.filterAuditLog = renderAuditLog;
window.exportAuditLog = () => generateReport();
window.showUserProfile = () => showToast('Profile feature coming soon');
window.showSettings = () => showTab('settings');
window.logout = () => showToast('Logout feature coming soon');
window.showBulkActions = () => showToast('Bulk actions: ' + selectedItems.length + ' items selected');
window.editSupplier = (id) => showToast('Edit supplier ' + id);
window.processBarcodeScan = processBarcodeScan;
window.viewInventory = viewInventory;
window.viewUsage = viewUsage;
window.stopScanner = stopScanner;
