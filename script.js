// ===== AXO - Sistema de Achados e Perdidos =====
// Versão completa com Histórico Detalhado + Backup + Blackout

let itemsDatabase = [];
let historyDatabase = [];
let blackoutActive = false;
let autoBackupInterval = null;
let currentUser = 'admin';

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
                { id: '1', name: 'iPhone 13 Azul', category: 'Eletrônicos', location: 'Praça de Alimentação', description: 'Capa transparente, película com pequeno arranhão', date: '2024-01-15', status: 'pending' },
                { id: '2', name: 'Carteira de Couro', category: 'Acessórios', location: 'Estacionamento G2', description: 'Marrom, contém documentos e cartões', date: '2024-01-18', status: 'pending' },
                { id: '3', name: 'Mochila Escolar', category: 'Acessórios', location: 'Auditório Principal', description: 'Preta, com adesivos de desenhos', date: '2024-01-10', status: 'returned' }
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
        
        const savedBlackout = localStorage.getItem('axo_blackout');
        if (savedBlackout) {
            blackoutActive = JSON.parse(savedBlackout);
            if (blackoutActive) activateBlackoutUI();
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
        localStorage.setItem('axo_blackout', JSON.stringify(blackoutActive));
    }, 0);
}

// ===== HISTÓRICO DETALHADO =====
function addToHistory(actionType, description, itemId = null, extraData = null) {
    const historyEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: actionType,
        description: description,
        itemId: itemId,
        timestamp: new Date().toISOString(),
        user: currentUser,
        userAgent: navigator.userAgent.substring(0, 100),
        extraData: extraData
    };
    
    historyDatabase.unshift(historyEntry);
    
    if (historyDatabase.length > 1000) {
        historyDatabase = historyDatabase.slice(0, 1000);
    }
    
    saveDatabase();
    
    const historyModal = document.getElementById('historyModal');
    if (historyModal && historyModal.classList.contains('active')) {
        renderHistory();
    }
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
    
    let filtered = [...historyDatabase];
    
    if (searchTerm) {
        filtered = filtered.filter(h => 
            h.description.toLowerCase().includes(searchTerm) ||
            (h.extraData?.name && h.extraData.name.toLowerCase().includes(searchTerm))
        );
    }
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(h => h.type === typeFilter);
    }
    
    const now = new Date();
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    const weekCount = filtered.filter(h => new Date(h.timestamp) > weekAgo).length;
    
    document.getElementById('historyTotalCount').textContent = filtered.length;
    document.getElementById('historyWeekCount').textContent = weekCount;
    
    if (filtered.length === 0) {
        historyList.innerHTML = '<div class="empty-history">📭 Nenhum registro encontrado no histórico</div>';
        return;
    }
    
    historyList.innerHTML = filtered.map(entry => `
        <div class="history-item-detailed ${entry.type}">
            <div class="history-header-detailed">
                <div class="history-badge ${entry.type}">
                    ${getTypeIcon(entry.type)} ${getTypeName(entry.type)}
                </div>
                <div class="history-user">
                    👤 ${entry.user === 'admin' ? 'Administrador' : 'Operador'}
                    <span>•</span>
                    ${formatDateTime(entry.timestamp)}
                </div>
            </div>
            <div class="history-details-detailed">
                ${escapeHtml(entry.description)}
            </div>
            ${entry.extraData?.changes ? `
                <div class="history-changes">
                    <strong>Alterações:</strong><br>
                    ${escapeHtml(entry.extraData.changes)}
                </div>
            ` : ''}
            ${entry.extraData?.old && entry.extraData?.new ? `
                <div class="history-changes">
                    <strong>Detalhes:</strong><br>
                    Antes: ${escapeHtml(JSON.stringify(entry.extraData.old))}<br>
                    Depois: ${escapeHtml(JSON.stringify(entry.extraData.new))}
                </div>
            ` : ''}
            <div class="history-meta">
                <span>🆔 ID: ${entry.id.substring(0, 8)}...</span>
                ${entry.itemId ? `<span>📦 Item: ${entry.itemId.substring(0, 8)}...</span>` : ''}
            </div>
        </div>
    `).join('');
}

function getTypeIcon(type) {
    const icons = { 'create': '➕', 'edit': '✏️', 'delete': '🗑️', 'status': '🔄', 'blackout': '⚠️', 'backup': '💾' };
    return icons[type] || '📝';
}

function getTypeName(type) {
    const names = { 'create': 'CRIAÇÃO', 'edit': 'EDIÇÃO', 'delete': 'EXCLUSÃO', 'status': 'STATUS', 'blackout': 'BLACKOUT', 'backup': 'BACKUP' };
    return names[type] || 'AÇÃO';
}

// ===== BACKUP SYSTEM =====
async function exportBackup(includeItems = true, includeHistory = true, includeSettings = true) {
    showLoading(true, 'Gerando arquivo de backup...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {}
        };
        
        if (includeItems) backup.data.items = itemsDatabase;
        if (includeHistory) backup.data.history = historyDatabase;
        if (includeSettings) backup.data.settings = { blackoutActive };
        
        const backupJson = JSON.stringify(backup, null, 2);
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `axo_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addToHistory('backup', `Backup exportado (${includeItems ? 'itens, ' : ''}${includeHistory ? 'histórico, ' : ''}${includeSettings ? 'configurações' : ''})`, null);
        showTemporaryMessage('✅ Backup exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar backup:', error);
        showTemporaryMessage('❌ Erro ao exportar backup!', 'error');
    } finally {
        showLoading(false);
    }
}

async function importBackup(file) {
    showLoading(true, 'Validando arquivo de backup...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const text = await file.text();
        const backup = JSON.parse(text);
        
        if (!backup.version || !backup.data) {
            throw new Error('Arquivo de backup inválido');
        }
        
        const preview = document.getElementById('restorePreview');
        preview.innerHTML = `
            <div class="backup-preview-info">
                <p><strong>📅 Data do backup:</strong> ${new Date(backup.timestamp).toLocaleString('pt-BR')}</p>
                <p><strong>📦 Versão:</strong> ${backup.version}</p>
                <p><strong>📊 Itens:</strong> ${backup.data.items?.length || 0} objetos</p>
                <p><strong>📋 Histórico:</strong> ${backup.data.history?.length || 0} registros</p>
                <p><strong>⚙️ Configurações:</strong> ${backup.data.settings ? 'Incluídas' : 'Não incluídas'}</p>
            </div>
        `;
        
        window.tempBackup = backup;
        document.getElementById('restoreConfirmModal').classList.add('active');
        
    } catch (error) {
        console.error('Erro ao ler backup:', error);
        showTemporaryMessage('❌ Arquivo de backup inválido ou corrompido!', 'error');
    } finally {
        showLoading(false);
    }
}

async function executeRestore() {
    if (!window.tempBackup) return;
    
    showLoading(true, 'Restaurando dados...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const backup = window.tempBackup;
        
        if (backup.data.items) itemsDatabase = backup.data.items;
        if (backup.data.history) historyDatabase = backup.data.history;
        if (backup.data.settings) {
            blackoutActive = backup.data.settings.blackoutActive;
            if (blackoutActive) activateBlackoutUI();
            else deactivateBlackoutUI();
        }
        
        saveDatabase();
        updateStatsAndRender();
        
        addToHistory('backup', `Backup restaurado de ${new Date(backup.timestamp).toLocaleString('pt-BR')}`, null, { restoredItems: itemsDatabase.length });
        showTemporaryMessage('✅ Backup restaurado com sucesso!', 'success');
        
        document.getElementById('restoreConfirmModal').classList.remove('active');
        document.getElementById('backupModal').classList.remove('active');
        window.tempBackup = null;
        
    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        showTemporaryMessage('❌ Erro ao restaurar backup!', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== BACKUP AUTOMÁTICO =====
function setupAutoBackup() {
    const autoBackupEnabled = localStorage.getItem('axo_auto_backup_enabled') === 'true';
    const autoBackupIntervalValue = parseInt(localStorage.getItem('axo_auto_backup_interval') || '86400000');
    
    const autoBackupEnable = document.getElementById('autoBackupEnable');
    const autoBackupInterval = document.getElementById('autoBackupInterval');
    
    if (autoBackupEnable) {
        autoBackupEnable.checked = autoBackupEnabled;
        if (autoBackupEnabled) startAutoBackup(autoBackupIntervalValue);
    }
    
    if (autoBackupInterval) {
        autoBackupInterval.value = autoBackupIntervalValue;
        autoBackupInterval.disabled = !autoBackupEnabled;
    }
}

function startAutoBackup(intervalMs) {
    if (autoBackupInterval) clearInterval(autoBackupInterval);
    
    autoBackupInterval = setInterval(() => {
        performAutoBackup();
    }, intervalMs);
    
    localStorage.setItem('axo_auto_backup_enabled', 'true');
    localStorage.setItem('axo_auto_backup_interval', intervalMs);
}

function stopAutoBackup() {
    if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
        autoBackupInterval = null;
    }
    localStorage.setItem('axo_auto_backup_enabled', 'false');
}

async function performAutoBackup() {
    const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        type: 'auto',
        data: {
            items: itemsDatabase,
            history: historyDatabase.slice(0, 100),
            settings: { blackoutActive }
        }
    };
    
    const autoBackups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    autoBackups.unshift(backup);
    
    while (autoBackups.length > 10) autoBackups.pop();
    
    localStorage.setItem('axo_auto_backups', JSON.stringify(autoBackups));
    loadAutoBackupList();
}

function loadAutoBackupList() {
    const container = document.getElementById('backupFilesList');
    if (!container) return;
    
    const autoBackups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    
    if (autoBackups.length === 0) {
        container.innerHTML = '<p style="color: var(--axo-text-gray);">Nenhum backup automático encontrado.</p>';
        return;
    }
    
    container.innerHTML = autoBackups.map((backup, index) => `
        <div class="backup-file-item">
            <div class="backup-file-info">
                <strong>${new Date(backup.timestamp).toLocaleString('pt-BR')}</strong><br>
                <small>${backup.data.items?.length || 0} objetos | ${backup.data.history?.length || 0} registros</small>
            </div>
            <div class="backup-file-actions">
                <button class="btn btn-secondary" onclick="restoreAutoBackup(${index})">Restaurar</button>
            </div>
        </div>
    `).join('');
}

function restoreAutoBackup(index) {
    const autoBackups = JSON.parse(localStorage.getItem('axo_auto_backups') || '[]');
    if (autoBackups[index]) {
        window.tempBackup = autoBackups[index];
        const preview = document.getElementById('restorePreview');
        preview.innerHTML = `
            <div class="backup-preview-info">
                <p><strong>📅 Backup automático:</strong> ${new Date(autoBackups[index].timestamp).toLocaleString('pt-BR')}</p>
                <p><strong>📊 Itens:</strong> ${autoBackups[index].data.items?.length || 0} objetos</p>
            </div>
        `;
        document.getElementById('restoreConfirmModal').classList.add('active');
    }
}

// ===== FUNÇÕES PRINCIPAIS =====
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }
function formatDate(dateString) { if (!dateString) return 'Data não informada'; return new Date(dateString).toLocaleDateString('pt-BR'); }
function formatDateTime(dateString) { return new Date(dateString).toLocaleString('pt-BR'); }

function updateStats() {
    document.getElementById('totalItems').textContent = itemsDatabase.length;
    document.getElementById('pendingItems').textContent = itemsDatabase.filter(item => item.status === 'pending').length;
    document.getElementById('returnedItems').textContent = itemsDatabase.filter(item => item.status === 'returned').length;
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
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>Nenhum objeto encontrado</h3><p>Tente outro termo de busca ou registre um novo item.</p></div>';
        return;
    }
    
    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="card-header"><h3 class="item-name">${escapeHtml(item.name)}</h3><span class="status-badge ${item.status === 'pending' ? 'status-pending' : 'status-returned'}">${item.status === 'pending' ? '⏳ Aguardando' : '✅ Devolvido'}</span></div>
            <div class="item-category">${item.category}</div>
            <div class="item-detail"><span>📍</span> <span>${escapeHtml(item.location)}</span></div>
            <div class="item-detail"><span>📅</span> <span>${formatDate(item.date)}</span></div>
            <div class="card-actions">
                <button class="btn btn-secondary edit-item" data-id="${item.id}" ${blackoutActive ? 'disabled' : ''}>✏️ Editar</button>
                <button class="btn ${item.status === 'pending' ? 'btn-primary' : 'btn-secondary'} toggle-status" data-id="${item.id}" ${blackoutActive ? 'disabled' : ''}>${item.status === 'pending' ? '✓ Marcar devolvido' : '↩️ Reabrir'}</button>
                <button class="btn btn-secondary delete-item" data-id="${item.id}" ${blackoutActive ? 'disabled' : ''}>🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
    
    if (!blackoutActive) {
        document.querySelectorAll('.edit-item').forEach(btn => btn.addEventListener('click', (e) => openEditModal(btn.getAttribute('data-id'))));
        document.querySelectorAll('.toggle-status').forEach(btn => btn.addEventListener('click', (e) => toggleItemStatus(btn.getAttribute('data-id'))));
        document.querySelectorAll('.delete-item').forEach(btn => btn.addEventListener('click', (e) => { if (confirm('Tem certeza?')) deleteItem(btn.getAttribute('data-id')); }));
    }
}

// ===== CRUD =====
function saveItem(itemData) {
    if (blackoutActive) { showTemporaryMessage('❌ Sistema em BLACKOUT!', 'error'); return; }
    
    if (itemData.id) {
        const index = itemsDatabase.findIndex(i => i.id === itemData.id);
        if (index !== -1) {
            const old = { ...itemsDatabase[index] };
            itemsDatabase[index] = { ...itemsDatabase[index], ...itemData };
            addToHistory('edit', `Item editado: "${itemData.name}"`, itemData.id, { old, new: itemData, changes: getChanges(old, itemData) });
        }
    } else {
        const newItem = { id: generateId(), ...itemData, date: itemData.date || new Date().toISOString().split('T')[0] };
        itemsDatabase.push(newItem);
        addToHistory('create', `Novo objeto registrado: "${newItem.name}"`, newItem.id, newItem);
    }
    saveDatabase();
    updateStatsAndRender();
    closeModal();
    showTemporaryMessage(itemData.id ? '✏️ Item atualizado!' : '✅ Objeto registrado!');
}

function getChanges(oldObj, newObj) {
    const changes = [];
    if (oldObj.name !== newObj.name) changes.push(`Nome: "${oldObj.name}" → "${newObj.name}"`);
    if (oldObj.status !== newObj.status) changes.push(`Status: ${oldObj.status} → ${newObj.status}`);
    if (oldObj.location !== newObj.location) changes.push(`Local: "${oldObj.location}" → "${newObj.location}"`);
    return changes.join('; ');
}

function deleteItem(id) {
    if (blackoutActive) { showTemporaryMessage('❌ Sistema em BLACKOUT!', 'error'); return; }
    const item = itemsDatabase.find(i => i.id === id);
    if (item) {
        itemsDatabase = itemsDatabase.filter(i => i.id !== id);
        addToHistory('delete', `Objeto excluído: "${item.name}"`, id, item);
        saveDatabase();
        updateStatsAndRender();
        showTemporaryMessage('🗑️ Objeto removido!');
    }
}

function toggleItemStatus(id) {
    if (blackoutActive) { showTemporaryMessage('❌ Sistema em BLACKOUT!', 'error'); return; }
    const item = itemsDatabase.find(i => i.id === id);
    if (item) {
        const oldStatus = item.status;
        item.status = item.status === 'pending' ? 'returned' : 'pending';
        addToHistory('status', `Status alterado: "${item.name}" de ${oldStatus === 'pending' ? 'pendente' : 'devolvido'} para ${item.status === 'pending' ? 'pendente' : 'devolvido'}`, id, { old: oldStatus, new: item.status });
        saveDatabase();
        updateStatsAndRender();
        showTemporaryMessage(item.status === 'returned' ? '✅ Devolvido!' : '🔄 Reaberto!');
    }
}

// ===== BLACKOUT =====
function activateBlackout(reason = null) {
    blackoutActive = true;
    saveDatabase();
    activateBlackoutUI();
    addToHistory('blackout', `MODO BLACKOUT ATIVADO${reason ? ` - Motivo: ${reason}` : ''}`, null, { reason });
    showTemporaryMessage('⚠️ BLACKOUT ATIVADO!', 'warning');
}

function deactivateBlackout() {
    blackoutActive = false;
    saveDatabase();
    deactivateBlackoutUI();
    addToHistory('blackout', 'MODO BLACKOUT DESATIVADO', null);
    showTemporaryMessage('🔓 Blackout desativado.', 'success');
}

function activateBlackoutUI() {
    const overlay = document.getElementById('blackoutOverlay');
    if (overlay) overlay.style.display = 'block';
    document.body.classList.add('blackout-mode');
    const registerBtn = document.getElementById('openRegisterBtn');
    if (registerBtn) registerBtn.disabled = true;
}

function deactivateBlackoutUI() {
    const overlay = document.getElementById('blackoutOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('blackout-mode');
    const registerBtn = document.getElementById('openRegisterBtn');
    if (registerBtn) registerBtn.disabled = false;
}

// ===== MODAIS =====
function openModal(editMode = false, itemData = null) {
    if (blackoutActive && !editMode) { showTemporaryMessage('❌ BLACKOUT ativo!', 'error'); return; }
    if (editMode && itemData) {
        document.getElementById('modalTitle').textContent = '✏️ Editar objeto';
        document.getElementById('itemId').value = itemData.id;
        document.getElementById('itemName').value = itemData.name;
        document.getElementById('itemCategory').value = itemData.category;
        document.getElementById('itemLocation').value = itemData.location;
        document.getElementById('itemDescription').value = itemData.description || '';
        document.getElementById('itemDate').value = itemData.date || '';
        document.getElementById('itemStatus').value = itemData.status;
    } else {
        document.getElementById('modalTitle').textContent = '📝 Registrar novo objeto';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('itemStatus').value = 'pending';
    }
    document.getElementById('itemModal').classList.add('active');
}

function closeModal() { document.getElementById('itemModal').classList.remove('active'); }
function openEditModal(id) { const item = itemsDatabase.find(i => i.id === id); if (item) openModal(true, item); }
function openHistoryModal() { renderHistory(); document.getElementById('historyModal').classList.add('active'); }
function closeHistoryModal() { document.getElementById('historyModal').classList.remove('active'); }
function openBackupModal() { loadAutoBackupList(); document.getElementById('backupModal').classList.add('active'); }
function closeBackupModal() { document.getElementById('backupModal').classList.remove('active'); }
function clearHistory() { if (confirm('⚠️ Limpar TODO o histórico?')) { historyDatabase = []; saveDatabase(); renderHistory(); showTemporaryMessage('📋 Histórico limpo!'); } }

function showTemporaryMessage(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'error' ? '#DC2626' : type === 'warning' ? '#F59E0B' : 'var(--axo-blue-electric)';
    toast.style.color = '#111827';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '2000';
    toast.style.animation = 'fadeIn 0.3s ease';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== EVENT LISTENERS =====
document.getElementById('openRegisterBtn')?.addEventListener('click', () => openModal(false));
document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
document.getElementById('emptyStateBtn')?.addEventListener('click', () => openModal(false));
document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
document.getElementById('closeHistoryBtn')?.addEventListener('click', closeHistoryModal);
document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
document.getElementById('backupBtn')?.addEventListener('click', openBackupModal);
document.getElementById('closeBackupBtn')?.addEventListener('click', closeBackupModal);
document.getElementById('exportBackupBtn')?.addEventListener('click', () => { const includeItems = document.getElementById('exportItems').checked; const includeHistory = document.getElementById('exportHistory').checked; const includeSettings = document.getElementById('exportSettings').checked; exportBackup(includeItems, includeHistory, includeSettings); });
document.getElementById('exportFullBackupBtn')?.addEventListener('click', () => exportBackup(true, true, true));
document.getElementById('selectRestoreBtn')?.addEventListener('click', () => document.getElementById('restoreFileInput').click());
document.getElementById('restoreFileInput')?.addEventListener('change', (e) => { if (e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; } });
document.getElementById('cancelRestoreBtn')?.addEventListener('click', () => { document.getElementById('restoreConfirmModal').classList.remove('active'); window.tempBackup = null; });
document.getElementById('executeRestoreBtn')?.addEventListener('click', executeRestore);
document.getElementById('closeRestoreConfirmBtn')?.addEventListener('click', () => { document.getElementById('restoreConfirmModal').classList.remove('active'); window.tempBackup = null; });
document.getElementById('autoBackupEnable')?.addEventListener('change', (e) => { if (e.target.checked) startAutoBackup(parseInt(document.getElementById('autoBackupInterval').value)); else stopAutoBackup(); });
document.getElementById('autoBackupInterval')?.addEventListener('change', (e) => { if (document.getElementById('autoBackupEnable').checked) { stopAutoBackup(); startAutoBackup(parseInt(e.target.value)); } });
document.getElementById('blackoutBtn')?.addEventListener('click', () => document.getElementById('blackoutModal').classList.add('active'));
document.getElementById('closeBlackoutBtn')?.addEventListener('click', () => document.getElementById('blackoutModal').classList.remove('active'));
document.getElementById('exitBlackoutBtn')?.addEventListener('click', () => { deactivateBlackout(); document.getElementById('blackoutModal').classList.remove('active'); });
document.getElementById('confirmBlackoutBtn')?.addEventListener('click', () => { const reason = document.getElementById('blackoutReason').value; activateBlackout(reason); document.getElementById('blackoutModal').classList.remove('active'); });
document.getElementById('searchInput')?.addEventListener('input', () => renderItems());
document.getElementById('categoryFilter')?.addEventListener('change', () => renderItems());
document.getElementById('historySearch')?.addEventListener('input', () => renderHistory());
document.getElementById('historyTypeFilter')?.addEventListener('change', () => renderHistory());
document.getElementById('itemForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveItem({ id: document.getElementById('itemId').value || null, name: document.getElementById('itemName').value.trim(), category: document.getElementById('itemCategory').value, location: document.getElementById('itemLocation').value.trim(), description: document.getElementById('itemDescription').value.trim(), date: document.getElementById('itemDate').value, status: document.getElementById('itemStatus').value }); });

document.querySelectorAll('.modal').forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); }); });

// ===== INICIALIZAÇÃO =====
loadDatabase();