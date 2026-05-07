// ===== AXO - Sistema de Achados e Perdidos =====
// Versão completa com Histórico + Backup + Login + Imagens

let itemsDatabase = [];
let historyDatabase = [];
let autoBackupInterval = null;
let currentUser = null;
let currentPhotoBase64 = null;

// Credenciais de exemplo
const validUsers = [
    { email: 'admin@axo.com', password: '123456', name: 'Administrador' },
    { email: 'usuario@axo.com', password: '123456', name: 'Usuário' }
];

// ===== LOADING CONTROL =====
function showLoading(show, message = 'Processando...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.querySelector('p').textContent = message;
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }
}

// ===== INICIALIZAÇÃO =====
async function loadDatabase() {
    showLoading(true, 'Carregando dados...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const saved = localStorage.getItem('axo_items');
        if (saved) {
            itemsDatabase = JSON.parse(saved);
        } else {
            itemsDatabase = [
                { id: '1', name: 'iPhone 13 Azul', category: 'Eletrônicos', location: 'Praça de Alimentação', description: 'Capa transparente', date: '2024-01-15', status: 'pending', photo: null },
                { id: '2', name: 'Carteira de Couro', category: 'Acessórios', location: 'Estacionamento G2', description: 'Marrom, documentos', date: '2024-01-18', status: 'pending', photo: null },
                { id: '3', name: 'Mochila Escolar', category: 'Acessórios', location: 'Auditório Principal', description: 'Preta, adesivos', date: '2024-01-10', status: 'returned', photo: null }
            ];
            saveDatabase();
        }
        
        const savedHistory = localStorage.getItem('axo_history');
        if (savedHistory) {
            historyDatabase = JSON.parse(savedHistory);
        } else {
            historyDatabase = [];
            addToHistory('create', 'Sistema inicializado com dados de exemplo', null, { itemsCount: itemsDatabase.length });
        }
        
        setupAutoBackup();
        updateStatsAndRender();
        loadAutoBackupList();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showTemporaryMessage('Erro ao carregar dados!', 'error');
    } finally {
        showLoading(false);
    }
}

function saveDatabase() {
    setTimeout(() => {
        localStorage.setItem('axo_items', JSON.stringify(itemsDatabase));
        localStorage.setItem('axo_history', JSON.stringify(historyDatabase));
    }, 0);
}

// ===== LOGIN =====
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = validUsers.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        showTemporaryMessage(`Bem-vindo, ${user.name}!`, 'success');
        updateStatsAndRender();
    } else {
        showTemporaryMessage('E-mail ou senha incorretos! Use admin@axo.com / 123456', 'error');
    }
}

function logout() {
    currentUser = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginForm').reset();
    showTemporaryMessage('Você saiu do sistema', 'success');
}

// ===== HISTÓRICO =====
function addToHistory(actionType, description, itemId = null, extraData = null) {
    const historyEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: actionType,
        description: description,
        itemId: itemId,
        timestamp: new Date().toISOString(),
        user: currentUser ? currentUser.name : 'admin',
        extraData: extraData
    };
    
    historyDatabase.unshift(historyEntry);
    if (historyDatabase.length > 1000) historyDatabase = historyDatabase.slice(0, 1000);
    saveDatabase();
    
    const historyModal = document.getElementById('historyModal');
    if (historyModal && historyModal.classList.contains('active')) renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
    
    let filtered = [...historyDatabase];
    if (searchTerm) filtered = filtered.filter(h => h.description.toLowerCase().includes(searchTerm));
    if (typeFilter !== 'all') filtered = filtered.filter(h => h.type === typeFilter);
    
    const weekAgo = new Date(new Date().setDate(new Date().getDate() - 7));
    const weekCount = filtered.filter(h => new Date(h.timestamp) > weekAgo).length;
    
    document.getElementById('historyTotalCount').textContent = filtered.length;
    document.getElementById('historyWeekCount').textContent = weekCount;
    
    if (filtered.length === 0) {
        historyList.innerHTML = '<div class="empty-history">📭 Nenhum registro encontrado</div>';
        return;
    }
    
    historyList.innerHTML = filtered.map(entry => `
        <div class="history-item-detailed ${entry.type}">
            <div class="history-header-detailed">
                <div class="history-badge ${entry.type}">${getTypeIcon(entry.type)} ${getTypeName(entry.type)}</div>
                <div class="history-user">👤 ${escapeHtml(entry.user)} • ${formatDateTime(entry.timestamp)}</div>
            </div>
            <div class="history-details-detailed">${escapeHtml(entry.description)}</div>
            ${entry.extraData?.changes ? `<div class="history-changes"><strong>Alterações:</strong><br>${escapeHtml(entry.extraData.changes)}</div>` : ''}
            <div class="history-meta"><span>🆔 ID: ${entry.id.substring(0, 8)}...</span>${entry.itemId ? `<span>📦 Item: ${entry.itemId.substring(0, 8)}...</span>` : ''}</div>
        </div>
    `).join('');
}

function getTypeIcon(type) {
    const icons = { 'create': '➕', 'edit': '✏️', 'delete': '🗑️', 'status': '🔄', 'backup': '💾' };
    return icons[type] || '📝';
}

function getTypeName(type) {
    const names = { 'create': 'CRIAÇÃO', 'edit': 'EDIÇÃO', 'delete': 'EXCLUSÃO', 'status': 'STATUS', 'backup': 'BACKUP' };
    return names[type] || 'AÇÃO';
}

// ===== BACKUP SYSTEM =====
async function exportBackup(includeItems = true, includeHistory = true, includeSettings = true) {
    showLoading(true, 'Gerando backup...');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const backup = { version: '1.0', timestamp: new Date().toISOString(), data: {} };
        if (includeItems) backup.data.items = itemsDatabase;
        if (includeHistory) backup.data.history = historyDatabase;
        if (includeSettings) backup.data.settings = {};
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `axo_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addToHistory('backup', 'Backup exportado', null);
        showTemporaryMessage('✅ Backup exportado!', 'success');
    } catch (error) {
        showTemporaryMessage('❌ Erro ao exportar!', 'error');
    } finally {
        showLoading(false);
    }
}

async function importBackup(file) {
    showLoading(true, 'Validando backup...');
    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.version || !backup.data) throw new Error('Arquivo inválido');
        
        document.getElementById('restorePreview').innerHTML = `
            <div class="backup-preview-info">
                <p>📅 Data: ${new Date(backup.timestamp).toLocaleString('pt-BR')}</p>
                <p>📦 Itens: ${backup.data.items?.length || 0}</p>
                <p>📋 Registros: ${backup.data.history?.length || 0}</p>
            </div>
        `;
        window.tempBackup = backup;
        document.getElementById('restoreConfirmModal').classList.add('active');
    } catch (error) {
        showTemporaryMessage('❌ Backup inválido!', 'error');
    } finally {
        showLoading(false);
    }
}

async function executeRestore() {
    if (!window.tempBackup) return;
    showLoading(true, 'Restaurando...');
    try {
        if (window.tempBackup.data.items) itemsDatabase = window.tempBackup.data.items;
        if (window.tempBackup.data.history) historyDatabase = window.tempBackup.data.history;
        saveDatabase();
        updateStatsAndRender();
        addToHistory('backup', 'Backup restaurado', null);
        showTemporaryMessage('✅ Backup restaurado!', 'success');
        document.getElementById('restoreConfirmModal').classList.remove('active');
        document.getElementById('backupModal').classList.remove('active');
        window.tempBackup = null;
    } catch (error) {
        showTemporaryMessage('❌ Erro na restauração!', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== BACKUP AUTOMÁTICO =====
function setupAutoBackup() {
    const enabled = localStorage.getItem('axo_auto_backup_enabled') === 'true';
    const interval = parseInt(localStorage.getItem('axo_auto_backup_interval') || '86400000');
    const cb = document.getElementById('autoBackupEnable');
    const sel = document.getElementById('autoBackupInterval');
    if (cb) { cb.checked = enabled; if (enabled) startAutoBackup(interval); }
    if (sel) { sel.value = interval; sel.disabled = !enabled; }
}

function startAutoBackup(intervalMs) {
    if (autoBackupInterval) clearInterval(autoBackupInterval);
    autoBackupInterval = setInterval(() => performAutoBackup(), intervalMs);
    localStorage.setItem('axo_auto_backup_enabled', 'true');
    localStorage.setItem('axo_auto_backup_interval', intervalMs);
}

function stopAutoBackup() {
    if (autoBackupInterval) { clearInterval(autoBackupInterval); autoBackupInterval = null; }
    localStorage.setItem('axo_auto_backup_enabled', 'false');
}

async function performAutoBackup() {
    const backups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    backups.unshift({ version: '1.0', timestamp: new Date().toISOString(), data: { items: itemsDatabase, history: historyDatabase.slice(0, 100) } });
    while (backups.length > 10) backups.pop();
    localStorage.setItem('axo_auto_backups', JSON.stringify(backups));
    loadAutoBackupList();
}

function loadAutoBackupList() {
    const container = document.getElementById('backupFilesList');
    if (!container) return;
    const backups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    if (backups.length === 0) { container.innerHTML = '<p>Nenhum backup automático</p>'; return; }
    container.innerHTML = backups.map((b, i) => `
        <div class="backup-file-item">
            <div class="backup-file-info"><strong>${new Date(b.timestamp).toLocaleString('pt-BR')}</strong><br><small>${b.data.items?.length || 0} objetos</small></div>
            <div class="backup-file-actions"><button class="btn btn-secondary" onclick="restoreAutoBackup(${i})">Restaurar</button></div>
        </div>
    `).join('');
}

function restoreAutoBackup(index) {
    const backups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    if (backups[index]) {
        window.tempBackup = backups[index];
        document.getElementById('restorePreview').innerHTML = `<div class="backup-preview-info"><p>📅 Backup: ${new Date(backups[index].timestamp).toLocaleString('pt-BR')}</p><p>📦 Itens: ${backups[index].data.items?.length || 0}</p></div>`;
        document.getElementById('restoreConfirmModal').classList.add('active');
    }
}

// ===== FUNÇÕES PRINCIPAIS =====
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
function formatDate(dateString) { return dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'Data não informada'; }
function formatDateTime(dateString) { return new Date(dateString).toLocaleString('pt-BR'); }

function updateStats() {
    document.getElementById('totalItems').textContent = itemsDatabase.length;
    document.getElementById('pendingItems').textContent = itemsDatabase.filter(i => i.status === 'pending').length;
    document.getElementById('returnedItems').textContent = itemsDatabase.filter(i => i.status === 'returned').length;
}

function updateStatsAndRender() { updateStats(); renderItems(); }

function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filtered = itemsDatabase.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(searchTerm) || item.location.toLowerCase().includes(searchTerm);
        const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchSearch && matchCategory;
    });
    
    filtered.sort((a, b) => {
        if (a.status === 'pending' && b.status === 'returned') return -1;
        if (a.status === 'returned' && b.status === 'pending') return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>Nenhum objeto encontrado</h3><p>Tente outro termo de busca</p></div>';
        return;
    }
    
    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            ${item.photo ? `<img src="${item.photo}" class="item-photo" alt="${escapeHtml(item.name)}">` : '<div class="item-photo-placeholder">📷</div>'}
            <div class="card-header">
                <h3 class="item-name">${escapeHtml(item.name)}</h3>
                <span class="status-badge ${item.status === 'pending' ? 'status-pending' : 'status-returned'}">${item.status === 'pending' ? '⏳ Pendente' : '✅ Devolvido'}</span>
            </div>
            <div class="item-category">${item.category}</div>
            <div class="item-detail"><span>📍</span> ${escapeHtml(item.location)}</div>
            <div class="item-detail"><span>📅</span> ${formatDate(item.date)}</div>
            <div class="card-actions">
                <button class="btn btn-secondary edit-item" data-id="${item.id}">✏️ Editar</button>
                <button class="btn ${item.status === 'pending' ? 'btn-primary' : 'btn-secondary'} toggle-status" data-id="${item.id}">${item.status === 'pending' ? '✓ Devolver' : '↩️ Reabrir'}</button>
                <button class="btn btn-secondary delete-item" data-id="${item.id}">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
    
    document.querySelectorAll('.edit-item').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.toggle-status').forEach(btn => btn.addEventListener('click', () => toggleItemStatus(btn.dataset.id)));
    document.querySelectorAll('.delete-item').forEach(btn => btn.addEventListener('click', () => { if (confirm('Excluir permanentemente?')) deleteItem(btn.dataset.id); }));
}

// ===== CRUD COM FOTO =====
function saveItem(itemData) {
    if (itemData.id) {
        const index = itemsDatabase.findIndex(i => i.id === itemData.id);
        if (index !== -1) {
            const old = { ...itemsDatabase[index] };
            itemsDatabase[index] = { ...itemsDatabase[index], ...itemData, photo: currentPhotoBase64 || itemsDatabase[index].photo };
            addToHistory('edit', `"${itemData.name}" editado`, itemData.id, { changes: getChanges(old, itemData) });
        }
    } else {
        const newItem = { id: generateId(), ...itemData, date: itemData.date || new Date().toISOString().split('T')[0], photo: currentPhotoBase64 || null };
        itemsDatabase.push(newItem);
        addToHistory('create', `Novo objeto: "${newItem.name}"`, newItem.id);
    }
    saveDatabase();
    updateStatsAndRender();
    closeModal();
    showTemporaryMessage(itemData.id ? '✏️ Atualizado!' : '✅ Registrado!');
    currentPhotoBase64 = null;
}

function getChanges(oldObj, newObj) {
    const changes = [];
    if (oldObj.name !== newObj.name) changes.push(`Nome: "${oldObj.name}" → "${newObj.name}"`);
    if (oldObj.status !== newObj.status) changes.push(`Status: ${oldObj.status} → ${newObj.status}`);
    if (oldObj.location !== newObj.location) changes.push(`Local: "${oldObj.location}" → "${newObj.location}"`);
    return changes.join('; ');
}

function deleteItem(id) {
    const item = itemsDatabase.find(i => i.id === id);
    if (item) {
        itemsDatabase = itemsDatabase.filter(i => i.id !== id);
        addToHistory('delete', `"${item.name}" excluído`, id);
        saveDatabase();
        updateStatsAndRender();
        showTemporaryMessage('🗑️ Removido!');
    }
}

function toggleItemStatus(id) {
    const item = itemsDatabase.find(i => i.id === id);
    if (item) {
        const oldStatus = item.status;
        item.status = item.status === 'pending' ? 'returned' : 'pending';
        addToHistory('status', `"${item.name}" → ${item.status === 'pending' ? 'pendente' : 'devolvido'}`, id);
        saveDatabase();
        updateStatsAndRender();
        showTemporaryMessage(item.status === 'returned' ? '✅ Devolvido!' : '🔄 Reaberto!');
    }
}

// ===== MODAIS E FOTO =====
function openModal(editMode = false, itemData = null) {
    currentPhotoBase64 = null;
    document.getElementById('photoPlaceholder').style.display = 'flex';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('previewImage').src = '';
    
    if (editMode && itemData) {
        document.getElementById('modalTitle').textContent = '✏️ Editar objeto';
        document.getElementById('itemId').value = itemData.id;
        document.getElementById('itemName').value = itemData.name;
        document.getElementById('itemCategory').value = itemData.category;
        document.getElementById('itemLocation').value = itemData.location;
        document.getElementById('itemDescription').value = itemData.description || '';
        document.getElementById('itemDate').value = itemData.date || '';
        document.getElementById('itemStatus').value = itemData.status;
        if (itemData.photo) {
            currentPhotoBase64 = itemData.photo;
            document.getElementById('previewImage').src = itemData.photo;
            document.getElementById('photoPlaceholder').style.display = 'none';
            document.getElementById('photoPreview').style.display = 'block';
        }
    } else {
        document.getElementById('modalTitle').textContent = '📝 Registrar objeto';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('itemStatus').value = 'pending';
    }
    document.getElementById('itemModal').classList.add('active');
}

function closeModal() { 
    document.getElementById('itemModal').classList.remove('active');
    currentPhotoBase64 = null;
}
function openEditModal(id) { const item = itemsDatabase.find(i => i.id === id); if (item) openModal(true, item); }
function openHistoryModal() { renderHistory(); document.getElementById('historyModal').classList.add('active'); }
function closeHistoryModal() { document.getElementById('historyModal').classList.remove('active'); }
function openBackupModal() { loadAutoBackupList(); document.getElementById('backupModal').classList.add('active'); }
function closeBackupModal() { document.getElementById('backupModal').classList.remove('active'); }
function clearHistory() { if (confirm('Limpar TODO o histórico?')) { historyDatabase = []; saveDatabase(); renderHistory(); showTemporaryMessage('📋 Histórico limpo!'); } }

function showTemporaryMessage(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'error' ? '#DC2626' : type === 'warning' ? '#F59E0B' : '#10B981';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '2000';
    toast.style.animation = 'fadeIn 0.3s ease';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== UPLOAD DE FOTO =====
function setupPhotoUpload() {
    const uploadArea = document.getElementById('photoUploadArea');
    const fileInput = document.getElementById('itemPhoto');
    const placeholder = document.getElementById('photoPlaceholder');
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removePhotoBtn');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg')) {
            if (file.size > 5 * 1024 * 1024) {
                showTemporaryMessage('Arquivo muito grande! Max 5MB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                currentPhotoBase64 = event.target.result;
                previewImg.src = currentPhotoBase64;
                placeholder.style.display = 'none';
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            showTemporaryMessage('Formato inválido! Use JPG ou PNG', 'error');
        }
    });
    
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentPhotoBase64 = null;
        previewImg.src = '';
        placeholder.style.display = 'flex';
        preview.style.display = 'none';
        fileInput.value = '';
    });
}

// ===== EVENT LISTENERS =====
document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
document.getElementById('googleLogin')?.addEventListener('click', () => showTemporaryMessage('Google em desenvolvimento', 'warning'));
document.getElementById('signupLink')?.addEventListener('click', (e) => { e.preventDefault(); showTemporaryMessage('Use admin@axo.com / 123456', 'warning'); });
document.getElementById('forgotPassword')?.addEventListener('click', (e) => { e.preventDefault(); showTemporaryMessage('Use admin@axo.com / 123456', 'warning'); });
document.getElementById('logoutHeaderBtn')?.addEventListener('click', logout);
document.getElementById('openRegisterBtn')?.addEventListener('click', () => openModal(false));
document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
document.getElementById('emptyStateBtn')?.addEventListener('click', () => openModal(false));
document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
document.getElementById('closeHistoryBtn')?.addEventListener('click', closeHistoryModal);
document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
document.getElementById('backupBtn')?.addEventListener('click', openBackupModal);
document.getElementById('closeBackupBtn')?.addEventListener('click', closeBackupModal);
document.getElementById('exportBackupBtn')?.addEventListener('click', () => exportBackup(true, true, true));
document.getElementById('exportFullBackupBtn')?.addEventListener('click', () => exportBackup(true, true, true));
document.getElementById('selectRestoreBtn')?.addEventListener('click', () => document.getElementById('restoreFileInput').click());
document.getElementById('restoreFileInput')?.addEventListener('change', (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); });
document.getElementById('cancelRestoreBtn')?.addEventListener('click', () => { document.getElementById('restoreConfirmModal').classList.remove('active'); window.tempBackup = null; });
document.getElementById('executeRestoreBtn')?.addEventListener('click', executeRestore);
document.getElementById('closeRestoreConfirmBtn')?.addEventListener('click', () => { document.getElementById('restoreConfirmModal').classList.remove('active'); window.tempBackup = null; });
document.getElementById('autoBackupEnable')?.addEventListener('change', (e) => { if (e.target.checked) startAutoBackup(parseInt(document.getElementById('autoBackupInterval').value)); else stopAutoBackup(); });
document.getElementById('autoBackupInterval')?.addEventListener('change', (e) => { if (document.getElementById('autoBackupEnable').checked) { stopAutoBackup(); startAutoBackup(parseInt(e.target.value)); } });
document.getElementById('searchInput')?.addEventListener('input', () => renderItems());
document.getElementById('categoryFilter')?.addEventListener('change', () => renderItems());
document.getElementById('historySearch')?.addEventListener('input', () => renderHistory());
document.getElementById('historyTypeFilter')?.addEventListener('change', () => renderHistory());
document.getElementById('itemForm')?.addEventListener('submit', (e) => { 
    e.preventDefault(); 
    saveItem({ 
        id: document.getElementById('itemId').value || null, 
        name: document.getElementById('itemName').value.trim(), 
        category: document.getElementById('itemCategory').value, 
        location: document.getElementById('itemLocation').value.trim(), 
        description: document.getElementById('itemDescription').value.trim(), 
        date: document.getElementById('itemDate').value, 
        status: document.getElementById('itemStatus').value 
    }); 
});

document.querySelectorAll('.modal').forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); }); });

// Inicialização
setupPhotoUpload();
loadDatabase();