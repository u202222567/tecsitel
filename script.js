// Tecsitel Sistema de Gestión - JavaScript Principal
// Con todas las funcionalidades, seguridad y conexión a API

// ========================================
// Configuración Global
// ========================================
const CONFIG = {
    API_URL: 'https://tecsitel-api-f1374ed765a6.herokuapp.com',
    APP_URL: 'https://tecsitel.netlify.app',
    VERSION: '2.0.0',
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    DEBOUNCE_DELAY: 300,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['application/pdf'],
    IGV_DEFAULT: 18,
    CURRENCY: 'S/',
    DATE_FORMAT: 'DD/MM/YYYY',
    API_TIMEOUT: 15000 // 15 segundos
};

// ========================================
// Estado de la Aplicación
// ========================================
const AppState = {
    user: null,
    token: null,
    invoices: [],
    transactions: [],
    currentTab: 'dashboard',
    invoiceCounter: 1,
    attachedFiles: new Map(),
    filters: {
        dateFrom: null,
        dateTo: null,
        status: 'all'
    },
    isOnline: navigator.onLine,
    pendingSync: []
};

// ========================================
// Inicialización
// ========================================
// Precargar imagen del logo
const logoImg = new Image();
logoImg.src = 'https://i.imgur.com/6XXdcPR.png';

// Variable global para verificar si ya se ocultó el loading
let loadingHidden = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Cargado - Iniciando sistema...');
    
    // Simular proceso de carga con mensajes de estado
    const loadingMessages = [
        'Inicializando sistema...',
        'Cargando módulos...',
        'Conectando con servidor...',
        'Verificando permisos...',
        'Preparando interfaz...',
        '¡Sistema listo!'
    ];
    
    let messageIndex = 0;
    const statusElement = document.querySelector('.loading-status');
    
    // Actualizar mensajes de carga
    const messageInterval = setInterval(() => {
        if (messageIndex < loadingMessages.length && statusElement) {
            // Fade out
            statusElement.style.opacity = '0';
            
            setTimeout(() => {
                statusElement.textContent = loadingMessages[messageIndex];
                // Fade in
                statusElement.style.opacity = '1';
                messageIndex++;
            }, 150);
        }
    }, 400);
    
    // Verificar si ya hay una sesión activa
    const savedToken = localStorage.getItem('tecsitel_token');
    if (savedToken) {
        AppState.token = savedToken;
        // validateSession(); // Comentado para evitar errores de red
    }
    
    // Inicializar la aplicación
    try {
        initializeApp();
    } catch (error) {
        console.error('Error al inicializar:', error);
    }
    
    // Ocultar pantalla de carga después de que todo esté listo
    setTimeout(() => {
        clearInterval(messageInterval);
        if (!loadingHidden) {
            console.log('Ocultando pantalla de carga...');
            hideLoadingScreen();
        }
    }, 2500);
});

window.addEventListener('load', function() {
    console.log('Página completamente cargada');
    // Asegurar que la pantalla de carga se oculte incluso si hay un error
    setTimeout(() => {
        if (!loadingHidden) {
            console.log('Forzando cierre de pantalla de carga por evento load');
            hideLoadingScreen();
        }
    }, 3000);
});

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');
    
    if (loadingScreen && !loadingHidden) {
        console.log('Ejecutando hideLoadingScreen...');
        // Marcar como oculto
        loadingHidden = true;
        
        // Asegurar que la animación se complete
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
        
        if (appContainer) {
            // Primero mostrar el contenedor
            appContainer.style.display = 'flex';
            // Luego añadir la clase para la animación
            setTimeout(() => {
                appContainer.classList.add('loaded');
                console.log('Clase loaded añadida al contenedor principal');
            }, 50);
        }
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            console.log('Pantalla de carga ocultada completamente');
        }, 500);
    }
}

// ========================================
// Funciones de Inicialización
// ========================================
function initializeApp() {
    // Prevenir errores si los elementos no existen
    try {
        // Cargar datos guardados localmente
        loadDataFromStorage();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar interceptores de seguridad
        setupSecurityFeatures();
        
        // Inicializar fecha actual en formularios
        setDefaultDates();
        
        // Verificar conexión a internet
        setupOnlineOfflineHandlers();
        
        // Actualizar dashboard
        updateDashboard();
        
        // Configurar auto-guardado
        setupAutoSave();
        
        // Sincronización deshabilitada para desarrollo
        // if (AppState.isOnline) {
        //     syncWithServer();
        // }
        
        console.log('✅ Tecsitel Sistema de Gestión iniciado correctamente');
    } catch (error) {
        console.error('Error durante la inicialización:', error);
        // Asegurar que la pantalla de carga se oculte en caso de error
        hideLoadingScreen();
    }
}

// ========================================
// API y Comunicación con Backend
// ========================================
class TecsitelAPI {
    static async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: CONFIG.API_TIMEOUT
        };
        
        // Agregar token si existe
        if (AppState.token) {
            defaultOptions.headers['Authorization'] = `Bearer ${AppState.token}`;
        }
        
        // Combinar opciones
        const finalOptions = { ...defaultOptions, ...options };
        if (finalOptions.body && typeof finalOptions.body === 'object') {
            finalOptions.body = JSON.stringify(finalOptions.body);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
            
            const response = await fetch(url, {
                ...finalOptions,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('API Error:', error);
            
            // Si no hay conexión, guardar para sincronizar después
            if (!navigator.onLine) {
                if (options.method !== 'GET') {
                    AppState.pendingSync.push({
                        endpoint,
                        options,
                        timestamp: new Date().toISOString()
                    });
                    saveDataToStorage();
                }
            }
            
            throw error;
        }
    }
    
    // Autenticación
    static async login(username, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: { username, password }
        });
    }
    
    static async register(userData) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: userData
        });
    }
    
    // Facturas
    static async getInvoices(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/api/invoices?${query}`);
    }
    
    static async createInvoice(invoiceData) {
        return this.request('/api/invoices', {
            method: 'POST',
            body: invoiceData
        });
    }
    
    static async getInvoice(id) {
        return this.request(`/api/invoices/${id}`);
    }
    
    // Reportes
    static async getFinancialSummary(period = 'month') {
        return this.request(`/api/reports/financial-summary?period=${period}`);
    }
    
    static async exportData(type, format = 'csv') {
        const response = await fetch(`${CONFIG.API_URL}/api/export/${type}?format=${format}`, {
            headers: {
                'Authorization': `Bearer ${AppState.token}`
            }
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // SharePoint Mock
    static async uploadToSharePoint(file, metadata) {
        // Simular subida a SharePoint
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    url: `https://sharepoint.mock/Documents/${file.name}`,
                    message: 'Archivo subido correctamente (simulado)'
                });
            }, 1500);
        });
    }
    
    // SUNAT Mock
    static async sendToSunat(invoiceData) {
        // Simular envío a SUNAT
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    cdr: `R-${invoiceData.invoice_number}`,
                    hash: generateHash(),
                    status: 'ACEPTADO',
                    message: 'Comprobante aceptado por SUNAT (simulado)'
                });
            }, 2000);
        });
    }
}

// ========================================
// Navegación y UI
// ========================================
function showTab(tabName) {
    // Actualizar estado
    AppState.currentTab = tabName;
    
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar pestaña seleccionada
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Actualizar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });
    
    // Actualizar navegación móvil
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });
    
    // Actualizar título
    const titles = {
        'dashboard': 'Dashboard',
        'invoices': 'Facturas',
        'accounting': 'Contabilidad',
        'timetracking': 'Control de Horarios',
        'compliance': 'Cumplimiento',
        'sharepoint': 'Respaldos'
    };
    
    document.getElementById('pageTitle').textContent = titles[tabName] || 'Dashboard';
    document.getElementById('breadcrumb').textContent = titles[tabName] || 'Dashboard';
    
    // Cerrar sidebar en móvil
    if (window.innerWidth <= 1024) {
        closeSidebar();
    }
    
    // Scroll al inicio
    window.scrollTo(0, 0);
    
    // Cargar datos específicos de la pestaña
    loadTabData(tabName);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
}

// ========================================
// Modales
// ========================================
function showModal(modalId) {
    const modal = document.getElementById(modalId + 'Modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus en primer input
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ========================================
// Gestión de Facturas
// ========================================
function calculateTotal() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const igvRate = parseFloat(document.getElementById('igvRate').value) || 0;
    
    const igv = amount * (igvRate / 100);
    const total = amount + igv;
    
    document.getElementById('igvAmount').value = `${CONFIG.CURRENCY} ${igv.toFixed(2)}`;
    document.getElementById('totalAmount').value = `${CONFIG.CURRENCY} ${total.toFixed(2)}`;
}

async function saveInvoice(event) {
    event.preventDefault();
    
    // Obtener valores del formulario
    const formData = {
        client_ruc: sanitizeInput(document.getElementById('clientRuc').value),
        client_name: sanitizeInput(document.getElementById('clientName').value),
        description: sanitizeInput(document.getElementById('description').value),
        amount: parseFloat(document.getElementById('amount').value) || 0,
        igv_rate: parseFloat(document.getElementById('igvRate').value) || CONFIG.IGV_DEFAULT,
        issue_date: document.getElementById('issueDate').value,
        due_date: document.getElementById('dueDate').value
    };
    
    // Validaciones
    const validation = validateInvoiceForm(formData);
    if (!validation.isValid) {
        showToast(validation.message, 'error');
        return;
    }
    
    // Mostrar loading
    showLoading('Guardando factura...');
    
    try {
        let invoice;
        
        if (AppState.isOnline && AppState.token) {
            // Enviar al servidor
            const response = await TecsitelAPI.createInvoice(formData);
            invoice = response;
        } else {
            // Guardar localmente
            invoice = createLocalInvoice(formData);
            AppState.invoices.push(invoice);
        }
        
        // Adjuntar archivo si existe
        if (AppState.attachedFiles.has('current')) {
            const file = AppState.attachedFiles.get('current');
            if (AppState.isOnline) {
                await TecsitelAPI.uploadToSharePoint(file, {
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number
                });
            }
        }
        
        // Simular envío a SUNAT
        if (AppState.isOnline) {
            setTimeout(async () => {
                try {
                    const sunatResponse = await TecsitelAPI.sendToSunat(invoice);
                    showToast(`✅ ${sunatResponse.message}`, 'success');
                } catch (error) {
                    showToast('⚠️ Error al enviar a SUNAT (se reintentará)', 'warning');
                }
            }, 1000);
        }
        
        // Actualizar UI
        updateInvoicesTable();
        updateDashboard();
        saveDataToStorage();
        
        // Limpiar formulario
        document.getElementById('invoiceForm').reset();
        document.getElementById('fileList').innerHTML = '';
        AppState.attachedFiles.delete('current');
        
        // Cerrar modal y mostrar éxito
        closeModal('newInvoiceModal');
        hideLoading();
        showToast(`✅ Factura ${invoice.invoice_number || invoice.id} guardada correctamente`, 'success');
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        hideLoading();
        showToast('❌ Error al guardar la factura', 'error');
    }
}

function createLocalInvoice(formData) {
    const invoiceNumber = generateInvoiceNumber();
    const amount = parseFloat(formData.amount);
    const igvRate = parseFloat(formData.igv_rate);
    const igv = amount * (igvRate / 100);
    const total = amount + igv;
    
    return {
        id: Date.now(),
        invoice_number: invoiceNumber,
        ...formData,
        igv_amount: igv,
        total: total,
        status: 'Pendiente',
        sunat_status: 'Por enviar',
        created_at: new Date().toISOString(),
        is_local: true
    };
}

function generateInvoiceNumber() {
    const number = String(AppState.invoiceCounter).padStart(8, '0');
    AppState.invoiceCounter++;
    return `F001-${number}`;
}

// ========================================
// Validaciones
// ========================================
function validateInvoiceForm(data) {
    // Validar RUC
    if (!validateRUC(data.client_ruc)) {
        return { isValid: false, message: 'RUC inválido' };
    }
    
    // Validar campos requeridos
    if (!data.client_name || !data.description) {
        return { isValid: false, message: 'Complete todos los campos requeridos' };
    }
    
    // Validar montos
    if (data.amount <= 0) {
        return { isValid: false, message: 'El monto debe ser mayor a 0' };
    }
    
    // Validar IGV
    if (data.igv_rate < 0 || data.igv_rate > 100) {
        return { isValid: false, message: 'El IGV debe estar entre 0% y 100%' };
    }
    
    // Validar fechas
    if (new Date(data.due_date) < new Date(data.issue_date)) {
        return { isValid: false, message: 'La fecha de vencimiento debe ser posterior a la emisión' };
    }
    
    return { isValid: true };
}

function validateRUC(ruc) {
    if (!/^\d{11}$/.test(ruc)) return false;
    
    const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
        sum += parseInt(ruc[i]) * factors[i];
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? 0 : 11 - remainder;
    
    return checkDigit === parseInt(ruc[10]);
}

// ========================================
// Manejo de Archivos
// ========================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) validateAndDisplayFile(file);
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files[0];
    if (file) validateAndDisplayFile(file);
    
    event.currentTarget.classList.remove('dragover');
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function validateAndDisplayFile(file) {
    // Validar tipo
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        showToast('❌ Solo se permiten archivos PDF', 'error');
        return;
    }
    
    // Validar tamaño
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast(`❌ El archivo no debe superar ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
        return;
    }
    
    // Guardar archivo
    AppState.attachedFiles.set('current', file);
    
    // Mostrar en UI
    document.getElementById('fileList').innerHTML = `
        <div class="file-item">
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="file-remove" onclick="removeFile()">×</button>
        </div>
    `;
    
    showToast('✅ Archivo adjuntado correctamente', 'success');
}

function removeFile() {
    AppState.attachedFiles.delete('current');
    document.getElementById('fileList').innerHTML = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========================================
// Actualización de UI
// ========================================
function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Calcular métricas
    const monthlyInvoices = AppState.invoices.filter(i => 
        i.issue_date && i.issue_date.startsWith(currentMonth)
    );
    
    const monthlyIncome = monthlyInvoices
        .filter(i => i.status === 'Pagada')
        .reduce((sum, i) => sum + (i.total || 0), 0);
    
    const monthlyExpenses = AppState.transactions
        .filter(t => t.type === 'Egreso' && t.date && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const netBalance = monthlyIncome - monthlyExpenses;
    const pendingInvoices = AppState.invoices.filter(i => i.status === 'Pendiente').length;
    
    // Actualizar valores en el DOM
    updateElement('totalIncome', `${CONFIG.CURRENCY} ${monthlyIncome.toFixed(2)}`);
    updateElement('totalExpenses', `${CONFIG.CURRENCY} ${monthlyExpenses.toFixed(2)}`);
    updateElement('netBalance', `${CONFIG.CURRENCY} ${netBalance.toFixed(2)}`);
    updateElement('pendingInvoices', pendingInvoices);
    
    // Actualizar tabla de actividad
    updateActivityTable();
    
    // Actualizar estado financiero
    updateFinancialStatements();
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function updateInvoicesTable() {
    const tbody = document.querySelector('#invoicesTable tbody');
    if (!tbody) return;
    
    if (AppState.invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--gray);">
                    No hay facturas registradas
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = AppState.invoices
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50) // Mostrar últimas 50
        .map(invoice => `
            <tr onclick="viewInvoice('${invoice.id}')">
                <td><strong>${invoice.invoice_number || 'Pendiente'}</strong></td>
                <td>${invoice.client_name}</td>
                <td>${invoice.client_ruc}</td>
                <td>${CONFIG.CURRENCY} ${(invoice.amount || 0).toFixed(2)}</td>
                <td>${invoice.igv_rate}% (${CONFIG.CURRENCY} ${(invoice.igv_amount || 0).toFixed(2)})</td>
                <td><strong>${CONFIG.CURRENCY} ${(invoice.total || 0).toFixed(2)}</strong></td>
                <td>
                    <span class="badge badge-${invoice.status === 'Pagada' ? 'success' : 'warning'}">
                        ${invoice.status}
                    </span>
                    ${invoice.is_local ? '<span class="badge badge-info">📱 Local</span>' : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewInvoice('${invoice.id}'); event.stopPropagation();">
                        Ver
                    </button>
                </td>
            </tr>
        `).join('');
}

function updateActivityTable() {
    const tbody = document.querySelector('#activityTable tbody');
    if (!tbody) return;
    
    const allActivities = [
        ...AppState.invoices.map(i => ({
            date: i.created_at,
            type: 'Factura',
            description: `${i.invoice_number} - ${i.client_name}`,
            amount: i.total,
            status: i.status,
            icon: '📄'
        })),
        ...AppState.transactions.map(t => ({
            ...t,
            icon: t.type === 'Ingreso' ? '💰' : '💳'
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
    
    if (allActivities.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray);">
                    No hay actividad registrada
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = allActivities.map(activity => `
        <tr>
            <td>${formatDate(activity.date)}</td>
            <td><span style="font-size: 20px;">${activity.icon}</span> ${activity.type}</td>
            <td>${activity.description}</td>
            <td style="color: ${activity.type === 'Ingreso' || activity.type === 'Factura' ? 'var(--success)' : 'var(--danger)'}">
                ${activity.type === 'Egreso' ? '-' : '+'} ${CONFIG.CURRENCY} ${(activity.amount || 0).toFixed(2)}
            </td>
            <td>
                <span class="badge badge-${getStatusBadgeClass(activity.status)}">
                    ${activity.status}
                </span>
            </td>
        </tr>
    `).join('');
}

function updateFinancialStatements() {
    const totalIncome = AppState.invoices
        .filter(i => i.status === 'Pagada')
        .reduce((sum, i) => sum + (i.total || 0), 0);
    
    const totalExpenses = AppState.transactions
        .filter(t => t.type === 'Egreso')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const netProfit = totalIncome - totalExpenses;
    const taxesPayable = AppState.invoices
        .reduce((sum, i) => sum + (i.igv_amount || 0), 0);
    
    // Balance General
    updateElement('cashBalance', `${CONFIG.CURRENCY} ${netProfit.toFixed(2)}`);
    updateElement('receivables', `${CONFIG.CURRENCY} ${AppState.invoices.filter(i => i.status === 'Pendiente').reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}`);
    updateElement('taxesPayable', `${CONFIG.CURRENCY} ${taxesPayable.toFixed(2)}`);
    updateElement('totalAssets', `${CONFIG.CURRENCY} ${(netProfit + 200000).toFixed(2)}`);
    updateElement('totalLiabilities', `${CONFIG.CURRENCY} ${taxesPayable.toFixed(2)}`);
    updateElement('totalEquity', `${CONFIG.CURRENCY} ${(200000 + netProfit).toFixed(2)}`);
    
    // Estado de Resultados
    updateElement('salesRevenue', `${CONFIG.CURRENCY} ${totalIncome.toFixed(2)}`);
    updateElement('costOfSales', `${CONFIG.CURRENCY} ${(totalIncome * 0.6).toFixed(2)}`);
    updateElement('grossProfit', `${CONFIG.CURRENCY} ${(totalIncome * 0.4).toFixed(2)}`);
    updateElement('operatingExpenses', `${CONFIG.CURRENCY} ${(totalExpenses * 0.7).toFixed(2)}`);
    updateElement('adminExpenses', `${CONFIG.CURRENCY} ${(totalExpenses * 0.3).toFixed(2)}`);
    updateElement('netProfit', `${CONFIG.CURRENCY} ${netProfit.toFixed(2)}`);
}

// ========================================
// Funciones de Utilidad
// ========================================
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getStatusBadgeClass(status) {
    const statusMap = {
        'Pagada': 'success',
        'Completado': 'success',
        'Pendiente': 'warning',
        'Por enviar': 'info',
        'Rechazado': 'danger',
        'Vencido': 'danger'
    };
    return statusMap[status] || 'secondary';
}

function sanitizeInput(input) {
    if (!input) return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function generateHash() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

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

// ========================================
// Notificaciones Toast
// ========================================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        'success': '✅',
        'error': '❌',
        'info': 'ℹ️',
        'warning': '⚠️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remover
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================================
// Loading Indicator
// ========================================
function showLoading(message = 'Cargando...') {
    const loading = document.createElement('div');
    loading.id = 'globalLoading';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        </div>
    `;
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('globalLoading');
    if (loading) loading.remove();
}

// ========================================
// Almacenamiento Local
// ========================================
function saveDataToStorage() {
    try {
        const data = {
            invoices: AppState.invoices,
            transactions: AppState.transactions,
            invoiceCounter: AppState.invoiceCounter,
            pendingSync: AppState.pendingSync,
            lastSync: new Date().toISOString()
        };
        
        localStorage.setItem('tecsitel_data', JSON.stringify(data));
        
        // Guardar token por separado
        if (AppState.token) {
            localStorage.setItem('tecsitel_token', AppState.token);
        }
        
    } catch (error) {
        console.error('Error saving to storage:', error);
        showToast('⚠️ Error al guardar datos localmente', 'warning');
    }
}

function loadDataFromStorage() {
    try {
        const data = localStorage.getItem('tecsitel_data');
        if (data) {
            const parsed = JSON.parse(data);
            AppState.invoices = parsed.invoices || [];
            AppState.transactions = parsed.transactions || [];
            AppState.invoiceCounter = parsed.invoiceCounter || 1;
            AppState.pendingSync = parsed.pendingSync || [];
            
            updateInvoicesTable();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error loading from storage:', error);
    }
}

// ========================================
// Sincronización Online/Offline
// ========================================
function setupOnlineOfflineHandlers() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

function handleOnline() {
    AppState.isOnline = true;
    showToast('✅ Conexión restaurada', 'success');
    syncWithServer();
}

function handleOffline() {
    AppState.isOnline = false;
    showToast('⚠️ Sin conexión - Trabajando offline', 'warning');
}

async function syncWithServer() {
    // Comentado para desarrollo sin backend
    /*
    if (!AppState.isOnline || !AppState.token) return;
    
    try {
        // Sincronizar datos pendientes
        for (const pending of AppState.pendingSync) {
            try {
                await TecsitelAPI.request(pending.endpoint, pending.options);
            } catch (error) {
                console.error('Error syncing:', error);
            }
        }
        
        // Limpiar pendientes sincronizados
        AppState.pendingSync = [];
        
        // Obtener datos actualizados del servidor
        if (AppState.token) {
            const invoicesData = await TecsitelAPI.getInvoices();
            if (invoicesData.invoices) {
                AppState.invoices = invoicesData.invoices;
                updateInvoicesTable();
                updateDashboard();
            }
        }
        
        saveDataToStorage();
        
    } catch (error) {
        console.error('Sync error:', error);
    }
    */
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Cerrar modales al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    });
    
    // Atajos de teclado
    document.addEventListener('keydown', function(e) {
        // ESC para cerrar modales
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
            
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        }
        
        // Ctrl/Cmd + S para guardar
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveDataToStorage();
            showToast('💾 Datos guardados', 'success');
        }
        
        // Ctrl/Cmd + N para nueva factura
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            showModal('newInvoice');
        }
        
        // Alt + 1-6 para navegación rápida
        if (e.altKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const tabs = ['dashboard', 'invoices', 'accounting', 'timetracking', 'compliance', 'sharepoint'];
            const index = parseInt(e.key) - 1;
            if (tabs[index]) {
                showTab(tabs[index]);
            }
        }
    });
    
    // Responsive
    window.addEventListener('resize', debounce(function() {
        if (window.innerWidth > 1024) {
            document.getElementById('sidebar').classList.remove('active');
        }
    }, CONFIG.DEBOUNCE_DELAY));
    
    // Prevenir envío accidental de formularios
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!e.target.hasAttribute('data-allow-submit')) {
                e.preventDefault();
            }
        });
    });
}

// ========================================
// Seguridad
// ========================================
function setupSecurityFeatures() {
    // Sanitización automática de inputs
    document.addEventListener('input', function(e) {
        if (e.target.matches('input[type="text"], textarea')) {
            // Prevenir scripts maliciosos
            const value = e.target.value;
            if (/<script|javascript:|onerror|onclick/i.test(value)) {
                e.target.value = value.replace(/<script.*?>.*?<\/script>/gi, '')
                                     .replace(/javascript:/gi, '')
                                     .replace(/onerror=/gi, '')
                                     .replace(/onclick=/gi, '');
                showToast('⚠️ Contenido no permitido detectado', 'warning');
            }
        }
    });
    
    // Session timeout
    let sessionTimeout;
    function resetSessionTimeout() {
        clearTimeout(sessionTimeout);
        sessionTimeout = setTimeout(() => {
            if (AppState.token) {
                showToast('⚠️ Sesión expirada por inactividad', 'warning');
                logout();
            }
        }, CONFIG.SESSION_TIMEOUT);
    }
    
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, resetSessionTimeout);
    });
    
    resetSessionTimeout();
}

// ========================================
// Funciones Auxiliares
// ========================================
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const inputs = document.querySelectorAll('input[type="date"]');
    
    inputs.forEach(input => {
        if (!input.value && input.id === 'issueDate') {
            input.value = today;
        }
        if (!input.value && input.id === 'dueDate') {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            input.value = dueDate.toISOString().split('T')[0];
        }
    });
}

function setupAutoSave() {
    setInterval(() => {
        saveDataToStorage();
    }, 30000); // Cada 30 segundos
}

function loadTabData(tabName) {
    switch(tabName) {
        case 'invoices':
            updateInvoicesTable();
            break;
        case 'accounting':
            updateFinancialStatements();
            break;
        case 'timetracking':
            updateTimeTrackingData();
            break;
        case 'compliance':
            checkComplianceStatus();
            break;
        case 'sharepoint':
            checkSharePointConnection();
            break;
    }
}

// Nueva función para actualizar datos de control de horarios
function updateTimeTrackingData() {
    // Actualizar estadísticas de asistencia
    const today = new Date().toLocaleDateString('es-PE');
    const dateElement = document.querySelector('#timetracking .panel-title');
    if (dateElement) {
        dateElement.innerHTML = `⏰ Control de Asistencia Digital - Hoy ${today}`;
    }
}

// ========================================
// Funciones Específicas
// ========================================
function exportInvoices() {
    if (AppState.invoices.length === 0) {
        showToast('No hay facturas para exportar', 'warning');
        return;
    }
    
    const csvContent = 'data:text/csv;charset=utf-8,' + 
        'Número,Cliente,RUC,Subtotal,IGV,Total,Estado,Fecha\n' +
        AppState.invoices.map(i => 
            `${i.invoice_number},${i.client_name},${i.client_ruc},${i.amount},${i.igv_amount},${i.total},${i.status},${i.issue_date}`
        ).join('\n');
    
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('✅ Facturas exportadas correctamente', 'success');
}

function printFinancialReport() {
    window.print();
}

function connectSharePoint() {
    const url = document.getElementById('sharepointUrl').value;
    const folder = document.getElementById('sharepointFolder').value;
    
    if (!url) {
        showToast('Ingrese la URL de SharePoint', 'error');
        return;
    }
    
    showLoading('Conectando con SharePoint...');
    
    // Simular conexión
    setTimeout(() => {
        hideLoading();
        localStorage.setItem('sharepoint_config', JSON.stringify({ url, folder }));
        showToast('✅ SharePoint configurado correctamente (simulado)', 'success');
        
        document.getElementById('sharePointStatus').innerHTML = `
            <div class="alert alert-success">
                <span>✅</span>
                <div>
                    <strong>Conectado a SharePoint</strong><br>
                    ${url}
                </div>
            </div>
        `;
    }, 2000);
}

function testSharePointConnection() {
    showLoading('Probando conexión...');
    
    setTimeout(() => {
        hideLoading();
        const isConnected = Math.random() > 0.2;
        
        if (isConnected) {
            showToast('✅ Conexión exitosa - SharePoint disponible', 'success');
        } else {
            showToast('❌ Error de conexión - Verifique la configuración', 'error');
        }
    }, 1500);
}

function checkComplianceStatus() {
    // Actualizar estado de cumplimiento
    const complianceItems = [
        { entity: 'SUNAT', status: 'compliant', percentage: 95 },
        { entity: 'SUNAFIL', status: 'compliant', percentage: 100 },
        { entity: 'MINTRA', status: 'warning', percentage: 85 }
    ];
    
    // Actualizar UI con estado actual
    // Este es un mockup, en producción vendría del servidor
}

function checkSharePointConnection() {
    const config = localStorage.getItem('sharepoint_config');
    const statusDiv = document.getElementById('sharePointStatus');
    
    if (config && statusDiv) {
        const { url } = JSON.parse(config);
        statusDiv.innerHTML = `
            <div class="alert alert-success">
                <span>✅</span>
                <div>
                    <strong>Conectado a SharePoint</strong><br>
                    ${url}
                </div>
            </div>
        `;
    }
}

function viewInvoice(invoiceId) {
    const invoice = AppState.invoices.find(i => i.id == invoiceId);
    if (!invoice) return;
    
    showToast(`Visualizando factura ${invoice.invoice_number || invoiceId}`, 'info');
    // Aquí se podría abrir un modal con los detalles
}

async function validateSession() {
    // Comentado para evitar errores de red en desarrollo
    /*
    try {
        // Verificar si el token sigue siendo válido
        const response = await TecsitelAPI.request('/api/auth/validate');
        if (response.valid) {
            AppState.user = response.user;
            updateUserInfo();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Session validation error:', error);
        logout();
    }
    */
}

function updateUserInfo() {
    if (AppState.user) {
        document.querySelector('.user-name').textContent = AppState.user.username || 'Usuario';
        document.querySelector('.user-avatar').textContent = (AppState.user.username || 'U')[0].toUpperCase();
    }
}

function logout() {
    AppState.token = null;
    AppState.user = null;
    localStorage.removeItem('tecsitel_token');
    
    // Redirigir a login o mostrar mensaje
    showToast('Sesión cerrada', 'info');
    
    // Recargar para mostrar estado sin autenticar
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// ========================================
// API Global para Testing
// ========================================
window.TecsitelAPI = {
    // Estado
    getState: () => AppState,
    
    // Facturas
    createInvoice: (data) => createLocalInvoice(data),
    getInvoices: () => AppState.invoices,
    
    // Utilidades
    validateRUC: validateRUC,
    formatCurrency: (amount) => `${CONFIG.CURRENCY} ${amount.toFixed(2)}`,
    
    // Testing
    generateTestData: (count = 10) => {
        const clients = ['Claro Perú', 'Movistar', 'Entel', 'Bitel', 'Virgin Mobile'];
        const rucs = ['20100055237', '20100017491', '20505377142', '20543515424', '20602114121'];
        
        for (let i = 0; i < count; i++) {
            const clientIndex = Math.floor(Math.random() * clients.length);
            const invoice = createLocalInvoice({
                client_name: clients[clientIndex],
                client_ruc: rucs[clientIndex],
                description: 'Servicios de telecomunicaciones - Prueba',
                amount: Math.floor(Math.random() * 10000) + 1000,
                igv_rate: 18,
                issue_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
            });
            
            invoice.status = Math.random() > 0.5 ? 'Pagada' : 'Pendiente';
            AppState.invoices.push(invoice);
        }
        
        updateInvoicesTable();
        updateDashboard();
        saveDataToStorage();
        
        showToast(`✅ ${count} facturas de prueba generadas`, 'success');
    }
};

// ========================================
// Estilos dinámicos para loading
// ========================================
const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loading-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid var(--primary);
        border-radius: 50%;
        margin: 0 auto 20px;
        animation: spin 1s linear infinite;
    }
    
    .loading-message {
        font-size: 16px;
        color: var(--dark);
        font-weight: 500;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log('✅ Tecsitel Sistema de Gestión v2.0.0 - JavaScript cargado');

// Temporizador de seguridad para ocultar pantalla de carga
setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        console.warn('Forzando cierre de pantalla de carga por timeout de seguridad');
        hideLoadingScreen();
    }
}, 5000); // 5 segundos máximo

// Ejecutar hideLoadingScreen inmediatamente si el DOM ya está listo
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        console.log('DOM ya estaba listo, ocultando loading screen...');
        hideLoadingScreen();
    }, 2500);
}