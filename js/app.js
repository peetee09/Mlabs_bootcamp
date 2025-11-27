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
        if (inventoryData.length === 0) {
            await loadSampleData();
        }
    } catch (error) {
        console.log('API not available, falling back to localStorage');
        loadDataFromStorage();
        if (inventoryData.length === 0) loadSampleDataLocal();
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

    inventoryData = await inventoryRes.json();
    usageData = await usageRes.json();
    suppliersData = await suppliersRes.json();
    auditLog = await auditRes.json();
    notifications = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS) || [];
}

async function loadSampleData() {
    // Create sample suppliers first
    const sampleSuppliers = [
        { name: "Office Supplies Co", contact: "John Smith", email: "john@officesupplies.com", phone: "555-0101", category: "stationery", rating: 4, address: "123 Main St" },
        { name: "Tech World Inc", contact: "Jane Doe", email: "jane@techworld.com", phone: "555-0102", category: "electronics", rating: 5, address: "456 Tech Ave" },
        { name: "Furniture Plus", contact: "Bob Wilson", email: "bob@furnitureplus.com", phone: "555-0103", category: "furniture", rating: 3, address: "789 Oak Rd" }
    ];

    for (const supplier of sampleSuppliers) {
        try {
            const response = await fetch(`${API_BASE_URL}/suppliers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplier)
            });
            if (response.ok) {
                const newSupplier = await response.json();
                suppliersData.push(newSupplier);
            }
        } catch (error) {
            console.error('Error adding sample supplier:', error);
        }
    }

    // Create sample inventory items
    const sampleItems = [
        { name: "A4 Paper (Ream)", category: "stationery", currentStock: 45, reorderLevel: 20, dailyUsage: 2.5, unitPrice: 5.99, sku: "SKU-001", description: "White A4 paper, 500 sheets" },
        { name: "Ballpoint Pens", category: "stationery", currentStock: 15, reorderLevel: 25, dailyUsage: 3.2, unitPrice: 0.99, sku: "SKU-002", description: "Blue ink ballpoint pens" },
        { name: "Stapler", category: "equipment", currentStock: 3, reorderLevel: 5, dailyUsage: 0.1, unitPrice: 12.99, sku: "SKU-003", description: "Heavy duty stapler" },
        { name: "Laptop", category: "electronics", currentStock: 8, reorderLevel: 3, dailyUsage: 0.05, unitPrice: 899.99, sku: "SKU-004", description: "Business laptop" },
        { name: "Printer Cartridge", category: "electronics", currentStock: 0, reorderLevel: 2, dailyUsage: 0.3, unitPrice: 45.99, sku: "SKU-005", description: "Black ink cartridge" },
        { name: "Desk Chair", category: "furniture", currentStock: 2, reorderLevel: 3, dailyUsage: 0.01, unitPrice: 199.99, sku: "SKU-006", description: "Ergonomic office chair" }
    ];

    for (const item of sampleItems) {
        try {
            if (suppliersData.length > 0) {
                const supplierIndex = sampleItems.indexOf(item) % suppliersData.length;
                item.supplierId = suppliersData[supplierIndex]._id;
            }
            const response = await fetch(`${API_BASE_URL}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (response.ok) {
                const newItem = await response.json();
                inventoryData.push(newItem);
            }
        } catch (error) {
            console.error('Error adding sample item:', error);
        }
    }

    // Generate sample usage data for the past 30 days
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(today.getDate() - (29 - i));
        
        for (const item of inventoryData) {
            const randomFactor = 0.8 + Math.random() * 0.4;
            const usageQty = Math.round(item.dailyUsage * randomFactor);
            if (usageQty > 0) {
                try {
                    const response = await fetch(`${API_BASE_URL}/usage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            itemId: item._id,
                            quantity: usageQty,
                            date: date.toISOString(),
                            notes: ""
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        usageData.push(result.usage);
                    }
                } catch (error) {
                    console.error('Error adding sample usage:', error);
                }
            }
        }
    }

    // Reload data after adding samples
    await loadDataFromAPI();
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

// ===== SAMPLE DATA (Local Fallback) =====
function loadSampleDataLocal() {
    suppliersData = [
        { id: 1, name: "Office Supplies Co", contact: "John Smith", email: "john@officesupplies.com", phone: "555-0101", category: "stationery", rating: 4, address: "123 Main St" },
        { id: 2, name: "Tech World Inc", contact: "Jane Doe", email: "jane@techworld.com", phone: "555-0102", category: "electronics", rating: 5, address: "456 Tech Ave" },
        { id: 3, name: "Furniture Plus", contact: "Bob Wilson", email: "bob@furnitureplus.com", phone: "555-0103", category: "furniture", rating: 3, address: "789 Oak Rd" }
    ];

    inventoryData = [
        { id: 1, name: "A4 Paper (Ream)", category: "stationery", currentStock: 45, reorderLevel: 20, dailyUsage: 2.5, unitPrice: 5.99, supplierId: 1, sku: "SKU-001", description: "White A4 paper, 500 sheets" },
        { id: 2, name: "Ballpoint Pens", category: "stationery", currentStock: 15, reorderLevel: 25, dailyUsage: 3.2, unitPrice: 0.99, supplierId: 1, sku: "SKU-002", description: "Blue ink ballpoint pens" },
        { id: 3, name: "Stapler", category: "equipment", currentStock: 3, reorderLevel: 5, dailyUsage: 0.1, unitPrice: 12.99, supplierId: 1, sku: "SKU-003", description: "Heavy duty stapler" },
        { id: 4, name: "Laptop", category: "electronics", currentStock: 8, reorderLevel: 3, dailyUsage: 0.05, unitPrice: 899.99, supplierId: 2, sku: "SKU-004", description: "Business laptop" },
        { id: 5, name: "Printer Cartridge", category: "electronics", currentStock: 0, reorderLevel: 2, dailyUsage: 0.3, unitPrice: 45.99, supplierId: 2, sku: "SKU-005", description: "Black ink cartridge" },
        { id: 6, name: "Desk Chair", category: "furniture", currentStock: 2, reorderLevel: 3, dailyUsage: 0.01, unitPrice: 199.99, supplierId: 3, sku: "SKU-006", description: "Ergonomic office chair" }
    ];

    // Generate sample usage data
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(today.getDate() - (29 - i));
        inventoryData.forEach(item => {
            const randomFactor = 0.8 + Math.random() * 0.4;
            const usageQty = Math.round(item.dailyUsage * randomFactor);
            if (usageQty > 0) {
                usageData.push({
                    id: usageData.length + 1,
                    itemId: item.id,
                    itemName: item.name,
                    category: item.category,
                    quantity: usageQty,
                    date: date.toISOString(),
                    notes: ""
                });
            }
        });
    }

    addAuditEntryLocal('system', 'System initialized with sample data');
    saveAllData();
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
    updateNotificationCount();
}

function refreshDashboard() {
    updateDashboard();
    if (window.usageTrendChart) updateCharts();
    showToast('Dashboard refreshed', 'success');
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
            data: { labels: [], datasets: [{ label: 'Daily Usage', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
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

    if (window.usageTrendChart) {
        window.usageTrendChart.data.labels = last7Days.map(d => new Date(d).toLocaleDateString('en', { weekday: 'short' }));
        window.usageTrendChart.data.datasets[0].data = last7Days.map(d => usageByDay[d]);
        window.usageTrendChart.update();
    }

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

function resetData() {
    if (!confirm('This will delete ALL data. Continue?')) return;
    localStorage.clear();
    inventoryData = [];
    usageData = [];
    suppliersData = [];
    auditLog = [];
    notifications = [];
    loadSampleData();
    initializeApp();
    showToast('Data reset', 'success');
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

    // Search and filters
    document.getElementById('inventory-search')?.addEventListener('input', () => { currentPage = 1; renderInventory(); });
    document.getElementById('category-filter')?.addEventListener('change', () => { currentPage = 1; renderInventory(); });
    document.getElementById('status-filter')?.addEventListener('change', () => { currentPage = 1; renderInventory(); });
    document.getElementById('sort-by')?.addEventListener('change', renderInventory);

    // Global search
    document.getElementById('global-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 2) {
            document.getElementById('inventory-search').value = query;
            showTab('inventory');
            renderInventory();
        }
    });
}

function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? '' : 'dark');
    const settings = loadFromStorage(STORAGE_KEYS.SETTINGS) || {};
    settings.darkMode = !isDark;
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
}

// ===== SCANNER =====
let html5QrCode = null;

function startScanner() {
    html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
        document.getElementById('scan-result').classList.remove('d-none');
        document.getElementById('scan-result-text').textContent = decodedText;
        const item = inventoryData.find(i => i.sku === decodedText);
        if (item) showEditItemModal(item.id);
        stopScanner();
    });
}

function stopScanner() {
    if (html5QrCode) html5QrCode.stop().catch(() => {});
}

document.getElementById('scan-btn')?.addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('scanModal')).show();
    setTimeout(startScanner, 500);
});

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
