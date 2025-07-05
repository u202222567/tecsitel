// ========================================
// Configuración Global
// ========================================
const CONFIG = {
    // La API ahora apunta a nuestra Netlify Function.
    // Esta es la única URL que necesitamos para comunicarnos con el backend.
    API_URL: '/.netlify/functions/database',
    VERSION: '2.1.0',
    CURRENCY: 'S/',
    IGV_DEFAULT: 18,
};

// ========================================
// Estado de la Aplicación
// ========================================
// Este objeto centraliza todos los datos dinámicos de la aplicación.
const AppState = {
    user: null,
    invoices: [],
    transactions: [],
    invoiceCounter: 1,
    currentTab: 'dashboard',
};

// ========================================
// Inicialización (Lógica Corregida)
// ========================================
// Este evento se dispara cuando el HTML inicial ha sido cargado.
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Cargado. Iniciando sistema...');
    updateLoadingStatus('Inicializando sistema...');
    
    try {
        // La inicialización ahora es asíncrona (async/await).
        // La pantalla de carga se ocultará solo cuando esta función termine con éxito.
        // Esto soluciona el problema de que la app aparecía antes de estar lista.
        await initializeApp();
        updateLoadingStatus('¡Sistema listo!');
        console.log('✅ Tecsitel Sistema de Gestión iniciado correctamente.');
    } catch (error) {
        console.error('Error fatal durante la inicialización:', error);
        updateLoadingStatus('Error al cargar. Intente refrescar la página.');
        // En caso de error, la pantalla de carga se queda con el mensaje de error.
        return; // Detenemos la ejecución si hay un error crítico.
    }
    
    // Ocultamos la pantalla de carga DESPUÉS de que todo haya terminado con éxito.
    setTimeout(hideLoadingScreen, 300); // Pequeño delay para que el usuario vea el mensaje "listo".
});

/**
 * Función principal que orquesta la carga inicial de la aplicación.
 */
async function initializeApp() {
    updateLoadingStatus('Conectando con el servidor...');
    await loadDataFromServer(); // Carga datos desde la API de Netlify/GitHub.
    
    updateLoadingStatus('Preparando interfaz...');
    setupEventListeners(); // Configura todos los clics y eventos.
    setDefaultDates(); // Pone las fechas de hoy en los formularios.
    
    // Renderiza la información inicial en la pantalla.
    updateDashboard();
    updateUserInfo();
    updateInvoicesTable();
}

/**
 * Actualiza el texto en la pantalla de carga.
 * @param {string} message - El mensaje a mostrar.
 */
function updateLoadingStatus(message) {
    const statusElement = document.querySelector('.loading-status');
    if (statusElement) statusElement.textContent = message;
}

/**
 * Oculta la pantalla de carga con una transición suave.
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');

    if (loadingScreen && appContainer) {
        loadingScreen.style.opacity = '0';
        appContainer.style.display = 'flex'; // Primero lo hacemos visible
        
        // Luego aplicamos la clase para la animación de opacidad
        setTimeout(() => appContainer.classList.add('loaded'), 50);

        // Finalmente, lo eliminamos del DOM para que no interfiera
        setTimeout(() => loadingScreen.style.display = 'none', 500); // Coincide con la duración de la transición CSS
    }
}

// ========================================
// API y Comunicación (MODIFICADO)
// ========================================
// Esta clase encapsula toda la comunicación con nuestro backend.
class TecsitelAPI {
    /**
     * Lee toda la base de datos (database.json) desde nuestra Netlify Function.
     * @returns {Promise<object>} - El objeto JSON con todos los datos.
     */
    static async getData() {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
        return response.json();
    }

    /**
     * Guarda (sobrescribe) toda la base de datos con el nuevo estado de la aplicación.
     * @param {object} fullData - El objeto AppState completo para guardar.
     * @returns {Promise<object>} - La respuesta del servidor.
     */
    static async saveData(fullData) {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Usamos pretty print (null, 2) para que el JSON en GitHub sea legible para un humano.
            body: JSON.stringify(fullData, null, 2), 
        });
        if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
        return response.json();
    }
}

// ========================================
// Carga y Guardado de Datos (MODIFICADO)
// ========================================
/**
 * Carga los datos iniciales desde el servidor y los vuelca en AppState.
 */
async function loadDataFromServer() {
    try {
        const data = await TecsitelAPI.getData();
        AppState.invoices = data.invoices || [];
        AppState.transactions = data.transactions || [];
        AppState.invoiceCounter = data.invoiceCounter || 1;
        AppState.user = data.user || { username: 'Usuario', avatar: 'U' };
    } catch (error) {
        showToast('❌ No se pudieron cargar los datos del servidor.', 'error');
        console.error("Fallo en loadDataFromServer:", error);
        throw error; // Propagamos el error para detener la inicialización y mostrar el error.
    }
}

/**
 * Guarda el estado COMPLETO de la app en el backend.
 */
async function persistData() {
    showLoading('Guardando cambios...');
    try {
        const fullData = {
            invoices: AppState.invoices,
            transactions: AppState.transactions,
            invoiceCounter: AppState.invoiceCounter,
            user: AppState.user,
        };
        await TecsitelAPI.saveData(fullData);
        showToast('✅ Datos guardados en el servidor.', 'success');
    } catch (error) {
        showToast('❌ Error al guardar los datos.', 'error');
        console.error("Fallo en persistData:", error);
    } finally {
        hideLoading();
    }
}

// ========================================
// Gestión de Facturas (MODIFICADO)
// ========================================
/**
 * Maneja el evento de guardar una nueva factura.
 * @param {Event} event - El evento del formulario.
 */
async function saveInvoice(event) {
    event.preventDefault();
    
    const formData = {
        client_ruc: document.getElementById('clientRuc').value.trim(),
        client_name: document.getElementById('clientName').value.trim(),
        description: document.getElementById('description').value.trim(),
        amount: parseFloat(document.getElementById('amount').value) || 0,
        igv_rate: parseFloat(document.getElementById('igvRate').value) || CONFIG.IGV_DEFAULT,
        issue_date: document.getElementById('issueDate').value,
        due_date: document.getElementById('dueDate').value,
    };

    // Validaciones simples
    if (!/^\d{11}$/.test(formData.client_ruc) || !formData.client_name || formData.amount <= 0) {
        showToast('Por favor, complete los campos correctamente.', 'error');
        return;
    }

    const newInvoice = createLocalInvoice(formData);
    AppState.invoices.push(newInvoice);

    // **Mejora de UX (Optimistic UI):**
    // 1. Actualizamos la interfaz inmediatamente. El usuario ve el resultado al instante.
    updateInvoicesTable();
    updateDashboard();
    
    // 2. Cerramos el modal y limpiamos el formulario.
    closeModal('newInvoice');
    document.getElementById('invoiceForm').reset();
    showToast(`Factura ${newInvoice.invoice_number} creada. Guardando...`, 'info');

    // 3. Guardamos los datos en el backend en segundo plano.
    await persistData();
}

/**
 * Crea un objeto de factura localmente con todos los datos calculados.
 * @param {object} formData - Los datos del formulario.
 * @returns {object} - El nuevo objeto de factura.
 */
function createLocalInvoice(formData) {
    const invoiceNumber = `F001-${String(AppState.invoiceCounter++).padStart(8, '0')}`;
    const amount = formData.amount;
    const igv = amount * (formData.igv_rate / 100);
    const total = amount + igv;

    return {
        id: Date.now(), // Usamos un timestamp como ID único simple.
        invoice_number: invoiceNumber,
        ...formData,
        igv_amount: igv,
        total: total,
        status: 'Pendiente',
        created_at: new Date().toISOString(),
    };
}

// ========================================
// UI y Navegación (Funciones de Soporte)
// ========================================
function showTab(tabName) {
    AppState.currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName)?.classList.add('active');
    
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    const title = { dashboard: 'Dashboard', invoices: 'Facturas', accounting: 'Contabilidad' }[tabName] || 'Dashboard';
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('breadcrumb').textContent = title;

    if (window.innerWidth <= 1024) closeSidebar();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('active'); }

function showModal(modalId) {
    const modal = document.getElementById(modalId + 'Modal');
    if(modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId + 'Modal');
    if(modal) modal.classList.remove('active');
}

function calculateTotal() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const igvRate = parseFloat(document.getElementById('igvRate').value) || CONFIG.IGV_DEFAULT;
    const igv = amount * (igvRate / 100);
    const total = amount + igv;
    document.getElementById('igvAmount').value = `${CONFIG.CURRENCY} ${igv.toFixed(2)}`;
    document.getElementById('totalAmount').value = `${CONFIG.CURRENCY} ${total.toFixed(2)}`;
}

function updateUserInfo() {
    if (AppState.user) {
        document.querySelector('.user-name').textContent = AppState.user.username;
        document.querySelector('.user-avatar').textContent = AppState.user.avatar;
    }
}

function updateDashboard() {
    const monthlyIncome = AppState.invoices
        .filter(i => i.status === 'Pagada')
        .reduce((sum, i) => sum + (i.total || 0), 0);
    const pendingInvoicesCount = AppState.invoices.filter(i => i.status === 'Pendiente').length;
    
    document.getElementById('totalIncome').textContent = `${CONFIG.CURRENCY} ${monthlyIncome.toFixed(2)}`;
    document.getElementById('pendingInvoices').textContent = pendingInvoicesCount;
    // Aquí se pueden añadir más cálculos para Egresos y Saldo Neto si se gestionan las transacciones.
}

function updateInvoicesTable() {
    const tbody = document.querySelector('#invoicesTable tbody');
    if (!tbody) return;
    
    if (AppState.invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay facturas registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = AppState.invoices
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(inv => `
            <tr>
                <td><strong>${inv.invoice_number}</strong></td>
                <td>${inv.client_name}</td>
                <td class="hide-mobile">${inv.client_ruc}</td>
                <td><strong>${CONFIG.CURRENCY} ${inv.total.toFixed(2)}</strong></td>
                <td><span class="badge badge-${inv.status === 'Pagada' ? 'success' : 'warning'}">${inv.status}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="viewInvoice(${inv.id})">Ver</button></td>
            </tr>
        `).join('');
}

function viewInvoice(id) {
    const invoice = AppState.invoices.find(i => i.id === id);
    if (invoice) {
        // En una aplicación real, esto abriría un modal con detalles.
        alert(`Detalles de la Factura ${invoice.invoice_number}:\nCliente: ${invoice.client_name}\nTotal: ${CONFIG.CURRENCY} ${invoice.total.toFixed(2)}`);
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    document.getElementById('dueDate').value = dueDate.toISOString().split('T')[0];
}

function setupEventListeners() {
    // Cierra modales al hacer clic en el fondo oscuro.
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.closest('.modal')?.classList.remove('active');
        }
    });
}

// ========================================
// Utilidades (Toast, Loading, etc.)
// ========================================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

function showLoading(message = 'Procesando...') {
    let loadingOverlay = document.getElementById('globalLoading');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'globalLoading';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content-inner">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            </div>`;
        document.body.appendChild(loadingOverlay);
    }
}

function hideLoading() {
    document.getElementById('globalLoading')?.remove();
}
