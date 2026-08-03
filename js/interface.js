// interface.js - application script.
function getRequestedDeviceIdFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const queryId = parseInt(params.get('device') || params.get('dispositivo'));
            if (queryId) return queryId;

            const match = window.location.pathname.match(/\/dispositivo\/(\d+)\/?$/);
            return match ? parseInt(match[1], 10) : null;
        }

        function getDeviceDetailUrl(deviceId) {
            const origin = window.location.origin;
            const basePath = window.location.pathname
                .replace(/\/dispositivo\/\d+\/?$/, '/')
                .replace(/\/(index\.html)?$/, '/');
            return `${origin}${basePath.replace(/\/$/, '')}/dispositivo/${deviceId}`;
        }

        function ensureDeviceLabelFields() {
            const typeSelect = document.getElementById('deviceType');
            const form = document.getElementById('deviceForm');
            if (!typeSelect || !form || document.getElementById('deviceBrand')) return;

            typeSelect.closest('.form-group')?.insertAdjacentHTML('afterend', `
                <div class="form-group">
                    <label class="form-label">Marca</label>
                    <input type="text" id="deviceBrand" class="form-input" placeholder="Ex: Lenovo, Samsung, Positivo">
                </div>
                <div class="form-group">
                    <label class="form-label">Modelo</label>
                    <input type="text" id="deviceModel" class="form-input" placeholder="Ex: ThinkPad E14, Galaxy Tab A">
                </div>
            `);

            document.getElementById('deviceGroup')?.closest('.form-group')?.insertAdjacentHTML('afterend', `
                <div class="form-group">
                    <label class="form-label">Nome da escola</label>
                    <input type="text" id="deviceSchoolName" class="form-input" placeholder="Escola Percio">
                    <small class="field-hint">Usado no topo e rodapé da etiqueta patrimonial.</small>
                </div>
            `);

            const actions = form.querySelector('button[type="submit"]')?.parentElement;
            if (actions && !document.getElementById('deviceLabelButton')) {
                actions.insertAdjacentHTML('beforeend', `
                    <div class="form-group" style="margin-bottom: 0; flex: 1 1 180px;">
                        <label class="form-label">Tamanho da etiqueta</label>
                        <select id="deviceModalLabelSize" class="form-input" data-label-size-control onchange="setLabelSizeValue(this.value)">
                            <option value="100x70">100 x 70 mm</option>
                            <option value="90x60">90 x 60 mm</option>
                            <option value="80x50">80 x 50 mm</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-secondary btn-full" id="deviceLabelButton" onclick="generateCurrentDeviceLabelPdf()">
                        <i class="fas fa-tag"></i>
                        Gerar etiqueta
                    </button>
                `);
                syncLabelSizeControls();
            }
        }

        function getScannerLabel(fieldId) {
            if (fieldId === 'devicePatrimony') return 'patrimônio';
            if (fieldId === 'deviceImei') return 'IMEI';
            return 'número de série';
        }

        function initScannerDetector() {
            if (scannerDetector) return scannerDetector;
            if (!('BarcodeDetector' in window)) return null;
            try {
                scannerDetector = new BarcodeDetector({
                    formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix', 'pdf417']
                });
            } catch (error) {
                console.warn('BarcodeDetector indisponível:', error);
                scannerDetector = null;
            }
            return scannerDetector;
        }

        async function openScanner(fieldId) {
            activeScannerField = fieldId;
            scannerLastValue = '';
            document.getElementById('scannerResult').value = '';
            document.getElementById('scannerStatus').textContent = `Aponte a câmera para o ${getScannerLabel(fieldId)}.`;
            document.getElementById('scannerModal').classList.add('active');

            if (!navigator.mediaDevices?.getUserMedia) {
                document.getElementById('scannerStatus').textContent = 'Seu navegador nao suporta acesso a camera.';
                return;
            }

            await startScanner();
        }

        async function startScanner() {
            stopScanner();
            const video = document.getElementById('scannerVideo');
            const status = document.getElementById('scannerStatus');
            const detector = initScannerDetector();

            try {
                scannerStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' }
                    },
                    audio: false
                });

                video.srcObject = scannerStream;
                await video.play();

                if (!detector) {
                    status.textContent = 'A câmera foi aberta, mas seu navegador nao suporta leitura automática. Se precisar, digite o valor manualmente.';
                    return;
                }

                status.textContent = 'Procurando código na imagem...';
                scannerInterval = setInterval(scanScannerFrame, 450);
            } catch (error) {
                console.error('Erro ao abrir camera:', error);
                status.textContent = 'Nao foi possivel abrir a camera. Verifique a permissao do navegador.';
            }
        }

        async function scanScannerFrame() {
            if (!scannerDetector || !scannerStream) return;
            const video = document.getElementById('scannerVideo');
            if (video.readyState < 2) return;

            try {
                const codes = await scannerDetector.detect(video);
                if (!codes || !codes.length) return;
                const value = (codes[0].rawValue || '').trim();
                if (!value || value === scannerLastValue) return;
                scannerLastValue = value;
                document.getElementById('scannerResult').value = value;
                document.getElementById('scannerStatus').textContent = `Detectado: ${value}`;
            } catch (error) {
                console.warn('Falha ao detectar codigo:', error);
            }
        }

        function useScannerValue() {
            const value = document.getElementById('scannerResult').value.trim();
            if (!value) {
                alert('Nenhum valor foi identificado ainda.');
                return;
            }

            if (activeScannerField) {
                const target = document.getElementById(activeScannerField);
                target.value = value;
                target.focus();
            }
            closeScanner();
        }

        function stopScanner() {
            if (scannerInterval) {
                clearInterval(scannerInterval);
                scannerInterval = null;
            }
            if (scannerStream) {
                scannerStream.getTracks().forEach(track => track.stop());
                scannerStream = null;
            }
            const video = document.getElementById('scannerVideo');
            if (video) {
                video.srcObject = null;
            }
        }

        function closeScanner() {
            stopScanner();
            document.getElementById('scannerModal').classList.remove('active');
            activeScannerField = null;
        }

// ------------------------------
        // 6. Navegação
        // ------------------------------
        function showScreen(screenId) {
            if (isAlunoAccess() && !['dashboard', 'loan', 'return', 'device-detail'].includes(screenId)) {
                screenId = 'loan';
            }
            if (['users', 'admin-prints', 'organization'].includes(screenId) && !canManageDevices()) {
                screenId = 'dashboard';
            }
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById(screenId).classList.add('active');
            const navItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
            if (navItem) navItem.classList.add('active');
            if (screenId === 'loan') setLoanDueMinimum();
            closeSidebar();
        }

        // ------------------------------
        // 7. Atualizações de UI
        // ------------------------------
        function updateAll() {
            updateStats();
            updateProfileDashboard();
            updateSelects();
            updateActiveLoans();
            updateLoanDeadlineAlerts();
            updateWeeklyReservations();
            updateMaintenanceCenter();
            updateLatestLoans();
            updateHistoryTable();
            updateDevicesTable();
            updateDevicesCards();
            updateLocationInventory();
            updateOrganizationScreen();
            renderSelectedDeviceDetails();
            updateClassesList();
            updateClassesCards();
            updateTeachersList();
            updateTeachersCards();
            updateUsersList();
            updateAdminPrintPage();
            syncLabelSizeControls();
            updateReturnSelect();
            applyRoleRestrictions();
        }

        function getInventoryStatusCounts(devices) {
            return devices.reduce((counts, device) => {
                const status = normalizeDeviceText(device.status);
                if (status === 'disponivel') counts.available += 1;
                else if (status === 'em uso') counts.inUse += 1;
                else if (status === 'manutencao') counts.maintenance += 1;
                else if (status === 'fora de uso') counts.outOfUse += 1;
                return counts;
            }, { available: 0, inUse: 0, maintenance: 0, outOfUse: 0 });
        }

        function getLocationInventoryGroups() {
            const locations = new Map();

            data.devices.forEach(device => {
                const trimmedGroup = (device.group || '').trim();
                const locationKey = normalizeDeviceText(trimmedGroup) || '__sem_agrupamento__';
                if (!locations.has(locationKey)) {
                    locations.set(locationKey, {
                        name: trimmedGroup || 'Sem agrupamento',
                        devices: []
                    });
                }
                locations.get(locationKey).devices.push(device);
            });

            return [...locations.values()].sort((a, b) =>
                a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
            );
        }

        function getInventoryTypes(devices) {
            const types = new Map();

            devices.forEach(device => {
                const typeName = (device.type || 'Outros').trim();
                const typeKey = normalizeDeviceText(typeName);
                if (!types.has(typeKey)) {
                    types.set(typeKey, { name: typeName, devices: [] });
                }
                types.get(typeKey).devices.push(device);
            });

            return [...types.values()]
                .map(type => ({
                    ...type,
                    status: getInventoryStatusCounts(type.devices)
                }))
                .sort((a, b) => {
                    const orderDifference = getDeviceTypeOrder(a.name) - getDeviceTypeOrder(b.name);
                    return orderDifference || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
                });
        }

        function renderInventoryStatusPill(label, value, colorClass) {
            if (!value) return '';
            return `<span class="inventory-status-pill ${colorClass}">${value} ${label}</span>`;
        }

        function updateLocationInventory() {
            const overview = document.getElementById('inventoryOverview');
            const grid = document.getElementById('inventoryLocationGrid');
            if (!overview || !grid) return;

            const searchTerm = normalizeDeviceText(
                document.getElementById('inventorySearchInput')?.value || ''
            );
            const allLocations = getLocationInventoryGroups();
            const allTypes = getInventoryTypes(data.devices);
            const visibleLocations = allLocations.map(location => {
                const types = getInventoryTypes(location.devices);
                const locationMatches = normalizeDeviceText(location.name).includes(searchTerm);
                const visibleTypes = !searchTerm || locationMatches
                    ? types
                    : types.filter(type => normalizeDeviceText(type.name).includes(searchTerm));
                return { ...location, types: visibleTypes };
            }).filter(location => location.types.length);

            overview.innerHTML = `
                <div class="inventory-overview-card">
                    <span>Locais</span>
                    <strong>${allLocations.length}</strong>
                </div>
                <div class="inventory-overview-card">
                    <span>Dispositivos</span>
                    <strong>${data.devices.length}</strong>
                </div>
                <div class="inventory-overview-card inventory-overview-types">
                    <span>Totais por tipo</span>
                    <div class="inventory-type-totals">
                        ${allTypes.map(type => `
                            <span>${escapeHtml(type.name)} <strong>${type.devices.length}</strong></span>
                        `).join('')}
                    </div>
                </div>
            `;

            if (!visibleLocations.length) {
                grid.innerHTML = '<div class="admin-empty inventory-empty">Nenhum local ou tipo encontrado.</div>';
                return;
            }

            grid.innerHTML = visibleLocations.map(location => {
                const locationStatus = getInventoryStatusCounts(location.devices);
                return `
                    <section class="inventory-location-card">
                        <div class="inventory-location-header">
                            <div>
                                <div class="inventory-location-title">
                                    <i class="fas fa-location-dot"></i>
                                    ${escapeHtml(location.name)}
                                </div>
                                <div class="inventory-location-status">
                                    ${renderInventoryStatusPill('disponíveis', locationStatus.available, 'green')}
                                    ${renderInventoryStatusPill('em uso', locationStatus.inUse, 'yellow')}
                                    ${renderInventoryStatusPill('manutenção', locationStatus.maintenance, 'orange')}
                                    ${renderInventoryStatusPill('fora de uso', locationStatus.outOfUse, 'gray')}
                                </div>
                            </div>
                            <span class="inventory-location-total">${location.devices.length}</span>
                        </div>
                        <div class="inventory-type-list">
                            ${location.types.map(type => `
                                <div class="inventory-type-row">
                                    <div class="inventory-type-main">
                                        <span class="inventory-type-icon">
                                            <i class="fas fa-${getDeviceIcon(type.name)}"></i>
                                        </span>
                                        <span>${escapeHtml(type.name)}</span>
                                    </div>
                                    <div class="inventory-type-detail">
                                        ${renderInventoryStatusPill('disp.', type.status.available, 'green')}
                                        ${renderInventoryStatusPill('em uso', type.status.inUse, 'yellow')}
                                        ${renderInventoryStatusPill('manut.', type.status.maintenance, 'orange')}
                                        ${renderInventoryStatusPill('fora', type.status.outOfUse, 'gray')}
                                        <strong class="inventory-type-count">${type.devices.length}</strong>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                `;
            }).join('');
        }

        function clearLocationInventorySearch() {
            const input = document.getElementById('inventorySearchInput');
            if (input) input.value = '';
            updateLocationInventory();
        }

        function updateProfileDashboard() {
            const panel = document.getElementById('profileDashboardPanel');
            if (!panel) return;

            const activeLoans = data.loans.filter(loan => !loan.returned);
            const available = data.devices.filter(device => device.status === 'Disponível').length;
            const maintenance = data.devices.filter(device => device.status === 'Manutenção').length;
            const overdueLoans = activeLoans.filter(loan => getLoanDeadlineInfo(loan).key === 'overdue').length;

            if (isAlunoAccess()) {
                panel.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <div class="quick-actions">
                                <div class="quick-action primary" onclick="openGeneralLoanScreen()">
                                    <i class="fas fa-plus"></i>
                                    <span>Novo empréstimo</span>
                                    <span style="font-size: 11px; opacity: 0.9; margin-top: 4px; display: block;">Retirar dispositivos</span>
                                </div>
                                <div class="quick-action success" onclick="showScreen('return')">
                                    <i class="fas fa-undo"></i>
                                    <span>Devolução</span>
                                    <span style="font-size: 11px; opacity: 0.9; margin-top: 4px; display: block;">Registrar retorno</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            const adminExtra = canManageDevices()
                ? `<div class="quick-action purple" onclick="showScreen('users')">
                        <i class="fas fa-user-shield"></i>
                        <span>Usuários</span>
                        <span style="font-size: 11px; opacity: 0.9; margin-top: 4px; display: block;">Gerenciar perfis</span>
                   </div>`
                : '';
            const adminNoticeTodoPanel = canManageDevices()
                ? `
                    <div class="admin-workspace">
                        <div class="admin-workspace-header">
                            <div>
                                <div class="admin-workspace-title">
                                    <i class="fas fa-clipboard-list"></i>
                                    Avisos e afazeres
                                </div>
                                <div class="admin-workspace-subtitle">Combine lembretes da equipe, tarefas com prazo e avisos importantes em um unico lugar.</div>
                            </div>
                            <div class="admin-workspace-tabs">
                                <button type="button" class="btn btn-small btn-secondary" id="adminTodoTab" onclick="setAdminNoticeTodoTab('todo')">
                                    <i class="fas fa-list-check"></i>
                                    Afazeres <span id="adminTodoCount">0</span>
                                </button>
                                <button type="button" class="btn btn-small btn-secondary" id="adminNoticeTab" onclick="setAdminNoticeTodoTab('notice')">
                                    <i class="fas fa-bullhorn"></i>
                                    Avisos <span id="adminNoticeCount">0</span>
                                </button>
                            </div>
                        </div>

                        <div class="admin-workspace-stats">
                            <div class="admin-workspace-stat">
                                <strong id="adminTodoOpenCount">0</strong>
                                <span>Afazeres abertos</span>
                            </div>
                            <div class="admin-workspace-stat">
                                <strong id="adminTodoDoneCount">0</strong>
                                <span>Concluidos</span>
                            </div>
                            <div class="admin-workspace-stat">
                                <strong id="adminHighPriorityCount">0</strong>
                                <span>Prioridade alta</span>
                            </div>
                        </div>

                        <form id="adminNoticeTodoForm" class="admin-workspace-form" onsubmit="addAdminNoticeTodoItem(event)">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Tipo</label>
                                <select class="form-input" id="adminNoticeTodoType">
                                    <option value="todo">Afazer</option>
                                    <option value="notice">Aviso</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Texto</label>
                                <input class="form-input" id="adminNoticeTodoText" type="text" maxlength="180" placeholder="Ex: Conferir notebooks da Base 2" required>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Prioridade</label>
                                <select class="form-input" id="adminNoticeTodoPriority">
                                    <option value="normal">Normal</option>
                                    <option value="high">Alta</option>
                                    <option value="low">Baixa</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Prazo</label>
                                <input class="form-input" id="adminNoticeTodoDueDate" type="date">
                            </div>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-plus"></i>
                                Adicionar
                            </button>
                        </form>

                        <div id="adminNoticeTodoList" class="admin-workspace-list"></div>
                    </div>
                `
                : '';

            panel.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="alert-item" style="margin-bottom: 16px;">
                            <div class="alert-icon info"><i class="fas fa-user-check"></i></div>
                            <div class="alert-content">
                                <div class="alert-title">Perfil: ${escapeHtml(getRoleLabel())}</div>
                                <div class="alert-desc">${activeLoans.length} empréstimo(s) ativo(s), ${overdueLoans} atrasado(s), ${available} dispositivo(s) disponíveis e ${maintenance} em manutenção.</div>
                            </div>
                        </div>
                        <div class="quick-actions">
                            <div class="quick-action primary" onclick="openGeneralLoanScreen()">
                                <i class="fas fa-plus"></i>
                                <span>Novo empréstimo</span>
                            </div>
                            <div class="quick-action success" onclick="showScreen('return')">
                                <i class="fas fa-undo"></i>
                                <span>Devolução</span>
                            </div>
                            ${adminExtra}
                        </div>
                        ${adminNoticeTodoPanel}
                    </div>
                </div>
            `;
            if (canManageDevices()) {
                updateAdminNoticeTodoPanel();
            }
        }

        function getAdminNoticeTodoItems() {
            if (adminNoticeTodoRemoteAvailable === true) {
                return data.adminNoticeTodos || [];
            }
            if (Array.isArray(data.adminNoticeTodos) && data.adminNoticeTodos.length) {
                return data.adminNoticeTodos;
            }
            return getLocalAdminNoticeTodoItems();
        }

        function saveAdminNoticeTodoItems(items) {
            data.adminNoticeTodos = items;
            localStorage.setItem(ADMIN_NOTICE_TODO_KEY, JSON.stringify(items));
        }

        function setAdminNoticeTodoTab(tab) {
            adminNoticeTodoTab = ['notice', 'todo'].includes(tab) ? tab : 'todo';
            updateAdminNoticeTodoPanel();
        }

        async function addAdminNoticeTodoItem(event) {
            event.preventDefault();
            if (!canManageDevices()) return;

            const typeInput = document.getElementById('adminNoticeTodoType');
            const textInput = document.getElementById('adminNoticeTodoText');
            const priorityInput = document.getElementById('adminNoticeTodoPriority');
            const dueDateInput = document.getElementById('adminNoticeTodoDueDate');
            const text = textInput?.value?.trim();
            const type = typeInput?.value === 'notice' ? 'notice' : 'todo';
            const priority = ['low', 'normal', 'high'].includes(priorityInput?.value) ? priorityInput.value : 'normal';
            const dueDate = dueDateInput?.value || null;

            if (!text) {
                alert('Digite o texto do aviso ou afazer.');
                return;
            }

            const newItem = {
                id: Date.now(),
                type,
                text,
                priority,
                due_date: dueDate,
                done: false,
                created_by: getCurrentActorName(),
                created_at: new Date().toISOString()
            };

            try {
                if (adminNoticeTodoRemoteAvailable !== false) {
                    const { data: insertedItem, error } = await client
                        .from('admin_notice_todos')
                        .insert({
                            type,
                            text,
                            priority,
                            due_date: dueDate,
                            done: false,
                            created_by: getCurrentActorName()
                        })
                        .select('id, type, text, priority, due_date, done, created_by, created_at, done_at')
                        .single();
                    if (error) throw error;
                    adminNoticeTodoRemoteAvailable = true;
                    data.adminNoticeTodos = [insertedItem, ...(data.adminNoticeTodos || [])];
                    localStorage.removeItem(ADMIN_NOTICE_TODO_KEY);
                } else {
                    saveAdminNoticeTodoItems([newItem, ...getAdminNoticeTodoItems()]);
                }
            } catch (error) {
                adminNoticeTodoRemoteAvailable = false;
                console.warn('Nao foi possivel salvar no Supabase, salvando localmente:', error.message || error);
                saveAdminNoticeTodoItems([newItem, ...getAdminNoticeTodoItems()]);
            }

            adminNoticeTodoTab = type;
            if (textInput) textInput.value = '';
            if (typeInput) typeInput.value = type;
            if (priorityInput) priorityInput.value = 'normal';
            if (dueDateInput) dueDateInput.value = '';
            updateAdminNoticeTodoPanel();
        }

        async function toggleAdminTodoItem(itemId, checked) {
            if (!canManageDevices()) return;

            const doneAt = checked ? new Date().toISOString() : null;
            const updateLocalState = () => {
                const items = getAdminNoticeTodoItems().map(item => {
                    if (parseInt(item.id) !== parseInt(itemId)) return item;
                    return { ...item, done: checked, done_at: doneAt };
                });
                saveAdminNoticeTodoItems(items);
            };

            if (adminNoticeTodoRemoteAvailable === true) {
                try {
                    const { error } = await client
                        .from('admin_notice_todos')
                        .update({ done: checked, done_at: doneAt })
                        .eq('id', parseInt(itemId));
                    if (error) throw error;
                    data.adminNoticeTodos = (data.adminNoticeTodos || []).map(item => {
                        if (parseInt(item.id) !== parseInt(itemId)) return item;
                        return { ...item, done: checked, done_at: doneAt };
                    });
                } catch (error) {
                    console.error('Erro ao atualizar afazer:', error);
                    alert('Erro ao atualizar afazer: ' + error.message);
                }
            } else {
                updateLocalState();
            }
            updateAdminNoticeTodoPanel();
        }

        async function deleteAdminNoticeTodoItem(itemId) {
            if (!canManageDevices()) return;

            const removeLocalItem = () => {
                const items = getAdminNoticeTodoItems()
                    .filter(item => parseInt(item.id) !== parseInt(itemId));
                saveAdminNoticeTodoItems(items);
            };

            if (adminNoticeTodoRemoteAvailable === true) {
                try {
                    const { error } = await client
                        .from('admin_notice_todos')
                        .delete()
                        .eq('id', parseInt(itemId));
                    if (error) throw error;
                    data.adminNoticeTodos = (data.adminNoticeTodos || [])
                        .filter(item => parseInt(item.id) !== parseInt(itemId));
                } catch (error) {
                    console.error('Erro ao remover item:', error);
                    alert('Erro ao remover item: ' + error.message);
                }
            } else {
                removeLocalItem();
            }
            updateAdminNoticeTodoPanel();
        }

        function getAdminPrintFiles() {
            if (adminPrintFilesRemoteAvailable === true) {
                return data.adminPrintFiles || [];
            }
            if (Array.isArray(data.adminPrintFiles) && data.adminPrintFiles.length) {
                return data.adminPrintFiles;
            }
            return getLocalAdminPrintFiles();
        }

        function saveAdminPrintFiles(files) {
            data.adminPrintFiles = files;
            localStorage.setItem(ADMIN_PRINT_FILES_KEY, JSON.stringify(files));
        }

        function formatFileSize(bytes) {
            const size = Number(bytes || 0);
            if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            if (size >= 1024) return `${Math.round(size / 1024)} KB`;
            return `${size} B`;
        }

        function readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.'));
                reader.readAsDataURL(file);
            });
        }

        async function addAdminPrintFile(event) {
            event.preventDefault();
            if (!canManageDevices()) return;

            const titleInput = document.getElementById('adminPrintFileTitle');
            const fileInput = document.getElementById('adminPrintFileInput');
            const notesInput = document.getElementById('adminPrintFileNotes');
            const file = fileInput?.files?.[0];
            const title = titleInput?.value?.trim();

            if (!title || !file) {
                alert('Informe o titulo e selecione um arquivo.');
                return;
            }

            if (file.size > ADMIN_PRINT_FILE_MAX_BYTES) {
                alert('Arquivo muito grande. Use arquivos de ate 4 MB.');
                return;
            }

            let pendingFile = null;
            try {
                const fileData = await readFileAsDataUrl(file);
                const newFile = {
                    id: Date.now(),
                    title,
                    file_name: file.name,
                    mime_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    file_data: fileData,
                    notes: notesInput?.value?.trim() || null,
                    created_by: getCurrentActorName(),
                    created_at: new Date().toISOString()
                };
                pendingFile = newFile;

                if (adminPrintFilesRemoteAvailable !== false) {
                    const { data: insertedFile, error } = await client
                        .from('admin_print_files')
                        .insert({
                            title: newFile.title,
                            file_name: newFile.file_name,
                            mime_type: newFile.mime_type,
                            file_size: newFile.file_size,
                            file_data: newFile.file_data,
                            notes: newFile.notes,
                            created_by: newFile.created_by
                        })
                        .select('id, title, file_name, mime_type, file_size, file_data, notes, created_by, created_at')
                        .single();
                    if (error) throw error;
                    adminPrintFilesRemoteAvailable = true;
                    data.adminPrintFiles = [insertedFile, ...(data.adminPrintFiles || [])];
                    localStorage.removeItem(ADMIN_PRINT_FILES_KEY);
                } else {
                    saveAdminPrintFiles([newFile, ...getAdminPrintFiles()]);
                }

                if (titleInput) titleInput.value = '';
                if (fileInput) fileInput.value = '';
                if (notesInput) notesInput.value = '';
                updateAdminPrintPage();
            } catch (error) {
                adminPrintFilesRemoteAvailable = false;
                if (pendingFile) {
                    saveAdminPrintFiles([pendingFile, ...getAdminPrintFiles()]);
                    if (titleInput) titleInput.value = '';
                    if (fileInput) fileInput.value = '';
                    if (notesInput) notesInput.value = '';
                    updateAdminPrintPage();
                    console.warn('Nao foi possivel salvar impresso no Supabase, salvando localmente:', error.message || error);
                    return;
                }
                alert('Nao foi possivel salvar o arquivo: ' + error.message);
            }
        }

        async function deleteAdminPrintFile(fileId) {
            if (!canManageDevices()) return;
            if (!confirm('Remover este arquivo de impressao?')) return;

            const removeLocalFile = () => {
                const files = getAdminPrintFiles()
                    .filter(file => parseInt(file.id) !== parseInt(fileId));
                saveAdminPrintFiles(files);
            };

            if (adminPrintFilesRemoteAvailable === true) {
                try {
                    const { error } = await client
                        .from('admin_print_files')
                        .delete()
                        .eq('id', parseInt(fileId));
                    if (error) throw error;
                    data.adminPrintFiles = (data.adminPrintFiles || [])
                        .filter(file => parseInt(file.id) !== parseInt(fileId));
                } catch (error) {
                    console.error('Erro ao remover arquivo:', error);
                    alert('Erro ao remover arquivo: ' + error.message);
                }
            } else {
                removeLocalFile();
            }

            updateAdminPrintPage();
        }

        function openAdminPrintFile(fileId, shouldPrint = false) {
            const file = getAdminPrintFiles().find(item => parseInt(item.id) === parseInt(fileId));
            if (!file?.file_data) return;

            const title = escapeHtml(file.title || file.file_name || 'Arquivo');
            const fileName = escapeHtml(file.file_name || 'arquivo');
            const win = window.open('', '_blank');
            if (!win) {
                alert('Permita pop-ups para abrir o arquivo.');
                return;
            }

            if ((file.mime_type || '').startsWith('image/')) {
                win.document.write(`
                    <html><head><title>${title}</title></head>
                    <body style="margin:0; display:flex; min-height:100vh; align-items:center; justify-content:center;">
                        <img src="${file.file_data}" alt="${fileName}" style="max-width:100%; max-height:100vh;">
                        <script>
                            window.onload = function() { ${shouldPrint ? 'window.print();' : ''} };
                        <\/script>
                    </body></html>
                `);
                win.document.close();
                return;
            }

            if ((file.mime_type || '').includes('pdf')) {
                win.location.href = file.file_data;
                if (shouldPrint) {
                    setTimeout(() => {
                        try { win.print(); } catch (error) {}
                    }, 1000);
                }
                return;
            }

            win.document.write(`
                <html><head><title>${title}</title></head>
                <body style="font-family: Arial, sans-serif; padding: 24px;">
                    <h1>${title}</h1>
                    <p>Arquivo: ${fileName}</p>
                    <p>Use o botao abaixo para baixar/abrir o arquivo e imprimir pelo aplicativo correspondente.</p>
                    <a href="${file.file_data}" download="${fileName}" style="display:inline-block; padding:12px 16px; background:#1e40af; color:white; text-decoration:none; border-radius:8px;">Baixar arquivo</a>
                </body></html>
            `);
            win.document.close();
        }

        function renderAdminPrintFilesList(containerId) {
            const list = document.getElementById(containerId);
            if (!list) return;

            const printFiles = getAdminPrintFiles();
            if (!canManageDevices()) {
                list.innerHTML = `
                    <div class="admin-empty">
                        <div style="font-weight: 800; color: var(--text-dark); margin-bottom: 5px;">Acesso restrito</div>
                        <div>Apenas administradores podem gerenciar impressos.</div>
                    </div>
                `;
                return;
            }

            if (!printFiles.length) {
                list.innerHTML = `
                    <div class="admin-empty">
                        <div style="font-weight: 800; color: var(--text-dark); margin-bottom: 5px;">Nenhum impresso salvo</div>
                        <div>Suba regras, avisos e documentos usados com frequencia para imprimir quando precisar.</div>
                    </div>
                `;
                return;
            }

            list.innerHTML = printFiles.map(file => {
                const createdAt = file.created_at ? formatDateTimeBR(new Date(file.created_at)) : '';
                const createdBy = file.created_by ? `por ${escapeHtml(file.created_by)}` : '';
                const mimeType = file.mime_type || '';
                const isImage = mimeType.startsWith('image/');
                const isPdf = mimeType.includes('pdf');
                const isPrintable = isImage || isPdf;
                const typeLabel = isImage ? 'Imagem' : (isPdf ? 'PDF' : 'Arquivo');
                const preview = isImage && file.file_data
                    ? `<div class="admin-print-preview"><img src="${file.file_data}" alt="${escapeHtml(file.title || file.file_name || 'Impresso')}"></div>`
                    : `<div class="admin-print-preview admin-print-placeholder"><i class="fas fa-${isPdf ? 'file-pdf' : 'file-lines'}"></i><span>${typeLabel}</span></div>`;

                return `
                    <div class="admin-workspace-item admin-print-item">
                        ${preview}
                        <div>
                            <div class="admin-workspace-item-title">${escapeHtml(file.title || file.file_name || 'Arquivo')}</div>
                            <div class="admin-workspace-meta">
                                <span class="badge blue"><i class="fas fa-paperclip"></i> ${escapeHtml(file.file_name || '-')}</span>
                                <span class="badge gray">${escapeHtml(formatFileSize(file.file_size))}</span>
                                ${file.notes ? `<span><i class="fas fa-note-sticky"></i> ${escapeHtml(file.notes)}</span>` : ''}
                                <span><i class="fas fa-clock"></i> ${createdAt ? `Salvo em ${escapeHtml(createdAt)}` : 'Salvo recentemente'}</span>
                                ${createdBy ? `<span><i class="fas fa-user"></i> ${createdBy}</span>` : ''}
                            </div>
                        </div>
                        <div class="admin-workspace-actions">
                            <button type="button" class="btn btn-small btn-secondary" onclick="openAdminPrintFile(${parseInt(file.id)}, false)" title="Abrir">
                                <i class="fas fa-up-right-from-square"></i>
                            </button>
                            <button type="button" class="btn btn-small btn-primary" onclick="openAdminPrintFile(${parseInt(file.id)}, true)" title="${isPrintable ? 'Imprimir' : 'Baixar'}">
                                <i class="fas fa-${isPrintable ? 'print' : 'download'}"></i>
                            </button>
                            <button type="button" class="btn btn-small btn-secondary" onclick="deleteAdminPrintFile(${parseInt(file.id)})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function updateAdminPrintPage() {
            renderAdminPrintFilesList('adminPrintPageList');
        }

        function updateAdminNoticeTodoPanel() {
            const list = document.getElementById('adminNoticeTodoList');
            const todoTab = document.getElementById('adminTodoTab');
            const noticeTab = document.getElementById('adminNoticeTab');
            const typeInput = document.getElementById('adminNoticeTodoType');
            const todoCount = document.getElementById('adminTodoCount');
            const noticeCount = document.getElementById('adminNoticeCount');
            const todoOpenCount = document.getElementById('adminTodoOpenCount');
            const todoDoneCount = document.getElementById('adminTodoDoneCount');
            const highPriorityCount = document.getElementById('adminHighPriorityCount');
            if (!list) return;

            const allItems = getAdminNoticeTodoItems();
            const todos = allItems.filter(item => item.type === 'todo');
            const notices = allItems.filter(item => item.type === 'notice');
            const openTodos = todos.filter(item => !item.done);
            const doneTodos = todos.filter(item => item.done);
            const highPriorityItems = allItems.filter(item => item.priority === 'high' && !item.done);

            if (todoCount) todoCount.textContent = todos.length;
            if (noticeCount) noticeCount.textContent = notices.length;
            if (todoOpenCount) todoOpenCount.textContent = openTodos.length;
            if (todoDoneCount) todoDoneCount.textContent = doneTodos.length;
            if (highPriorityCount) highPriorityCount.textContent = highPriorityItems.length;

            if (typeInput) {
                typeInput.value = adminNoticeTodoTab === 'notice' ? 'notice' : 'todo';
            }

            if (todoTab && noticeTab) {
                todoTab.classList.toggle('btn-primary', adminNoticeTodoTab === 'todo');
                todoTab.classList.toggle('btn-secondary', adminNoticeTodoTab !== 'todo');
                noticeTab.classList.toggle('btn-primary', adminNoticeTodoTab === 'notice');
                noticeTab.classList.toggle('btn-secondary', adminNoticeTodoTab !== 'notice');
            }

            const items = allItems
                .filter(item => item.type === adminNoticeTodoTab)
                .sort((a, b) => {
                    if (adminNoticeTodoTab === 'todo' && Boolean(a.done) !== Boolean(b.done)) {
                        return a.done ? 1 : -1;
                    }
                    const priorityOrder = { high: 0, normal: 1, low: 2 };
                    if ((priorityOrder[a.priority] ?? 1) !== (priorityOrder[b.priority] ?? 1)) {
                        return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
                    }
                    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
                        return new Date(a.due_date) - new Date(b.due_date);
                    }
                    if (a.due_date && !b.due_date) return -1;
                    if (!a.due_date && b.due_date) return 1;
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                });

            if (!items.length) {
                list.innerHTML = `
                    <div class="admin-empty">
                        <div style="font-weight: 800; color: var(--text-dark); margin-bottom: 5px;">${adminNoticeTodoTab === 'todo' ? 'Nenhum afazer cadastrado' : 'Nenhum aviso cadastrado'}</div>
                        <div>Use o formulario acima para adicionar o primeiro item compartilhado com os administradores.</div>
                    </div>
                `;
                return;
            }

            list.innerHTML = items.map(item => {
                const createdAt = item.created_at ? formatDateTimeBR(new Date(item.created_at)) : '';
                const createdBy = item.created_by ? `por ${escapeHtml(item.created_by)}` : '';
                const priority = item.priority || 'normal';
                const priorityBadge = {
                    high: '<span class="badge red"><i class="fas fa-arrow-up"></i> Alta</span>',
                    normal: '<span class="badge blue"><i class="fas fa-minus"></i> Normal</span>',
                    low: '<span class="badge gray"><i class="fas fa-arrow-down"></i> Baixa</span>'
                }[priority] || '<span class="badge blue"><i class="fas fa-minus"></i> Normal</span>';
                const dueDate = item.due_date ? new Date(`${item.due_date}T00:00:00`) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = dueDate && dueDate < today && !item.done;
                const dueBadge = dueDate
                    ? `<span class="badge ${isOverdue ? 'red' : 'yellow'}"><i class="fas fa-calendar-day"></i> ${escapeHtml(formatDateBR(dueDate))}</span>`
                    : '';
                const statusBadge = item.type === 'todo'
                    ? `<label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer;">
                            <input class="admin-workspace-check" type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleAdminTodoItem(${parseInt(item.id)}, this.checked)">
                            Feito
                       </label>`
                    : `<span class="badge blue"><i class="fas fa-bullhorn"></i> Aviso</span>`;

                return `
                    <div class="admin-workspace-item ${item.done ? 'done' : ''}">
                        <div class="alert-icon ${item.type === 'todo' ? 'warning' : 'info'}">
                            <i class="fas fa-${item.type === 'todo' ? 'clipboard-check' : 'bullhorn'}"></i>
                        </div>
                        <div>
                            <div class="admin-workspace-item-title">${escapeHtml(item.text)}</div>
                            <div class="admin-workspace-meta">
                                ${priorityBadge}
                                ${dueBadge}
                                <span><i class="fas fa-clock"></i> ${createdAt ? `Criado em ${escapeHtml(createdAt)}` : 'Criado recentemente'}</span>
                                ${createdBy ? `<span><i class="fas fa-user"></i> ${createdBy}</span>` : ''}
                            </div>
                        </div>
                        <div class="admin-workspace-actions">
                            ${statusBadge}
                            <button type="button" class="btn btn-small btn-secondary" onclick="deleteAdminNoticeTodoItem(${parseInt(item.id)})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function updateUsersList() {
            const tableBody = document.getElementById('users-table');
            const cards = document.getElementById('users-cards');
            if (!tableBody || !cards) return;

            if (!canManageDevices()) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">Apenas administradores podem gerenciar usuários.</td></tr>';
                cards.innerHTML = '';
                return;
            }

            const profiles = [...(data.userProfiles || [])].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
            if (!profiles.length) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum perfil encontrado. Execute controle_acesso_usuarios.sql no Supabase.</td></tr>';
                cards.innerHTML = '<div class="simple-card"><div style="color: var(--text-muted); font-weight: 600;">Nenhum perfil encontrado</div></div>';
                return;
            }

            const roleSelect = (profile) => `
                <select class="form-input" style="min-width: 150px;" onchange="updateUserRole('${profile.id}', this.value)">
                    <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Administrador</option>
                    <option value="funcionario" ${profile.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
                    <option value="aluno" ${profile.role === 'aluno' ? 'selected' : ''}>Aluno</option>
                </select>
            `;

            tableBody.innerHTML = profiles.map(profile => `
                <tr>
                    <td style="font-weight: 600;">${escapeHtml(profile.name || '-')}</td>
                    <td>${escapeHtml(profile.email || '-')}</td>
                    <td>${roleSelect(profile)}</td>
                    <td>${profile.created_at ? escapeHtml(formatDateTimeBR(new Date(profile.created_at))) : '-'}</td>
                </tr>
            `).join('');

            cards.innerHTML = profiles.map(profile => `
                <div class="simple-card">
                    <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(profile.name || profile.email || '-')}</div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">${escapeHtml(profile.email || '-')}</div>
                    ${roleSelect(profile)}
                </div>
            `).join('');
        }

        async function updateUserRole(userId, role) {
            if (!canManageDevices()) return;
            if (!['admin', 'funcionario', 'aluno'].includes(role)) return;

            try {
                const { error } = await client
                    .from('user_profiles')
                    .update({ role, updated_at: new Date().toISOString() })
                    .eq('id', userId);
                if (error) throw error;
                await loadData();
                alert('Perfil atualizado com sucesso!');
            } catch (error) {
                console.error('Erro ao atualizar perfil:', error);
                alert('Erro ao atualizar perfil: ' + error.message);
                updateUsersList();
            }
        }
        function getLatestMaintenanceEntry(deviceId) {
            return getDeviceMaintenanceHistory(deviceId)
                .find(item => item.new_status === 'Manutenção' || item.new_status === 'ManutenÃ§Ã£o') || null;
        }

        function getMaintenanceAgeLabel(entry) {
            if (!entry?.created_at) return '-';
            const start = new Date(entry.created_at);
            if (Number.isNaN(start.getTime())) return '-';
            const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
            if (days === 0) return 'Hoje';
            if (days === 1) return '1 dia';
            return `${days} dias`;
        }

        function updateMaintenanceCenter() {
            const tableBody = document.getElementById('maintenance-table');
            const cards = document.getElementById('maintenance-cards');
            if (!tableBody || !cards) return;

            const devicesInMaintenance = sortDevicesForDisplay(data.devices).filter(device => device.status === 'Manutenção');
            const entries = devicesInMaintenance.map(device => ({ device, entry: getLatestMaintenanceEntry(device.id) }));
            const oldestEntry = entries.map(item => item.entry).filter(Boolean).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

            document.getElementById('maintenance-total').textContent = devicesInMaintenance.length;
            document.getElementById('maintenance-oldest').textContent = getMaintenanceAgeLabel(oldestEntry);
            document.getElementById('maintenance-handled').textContent = (data.deviceMaintenanceHistory || []).length;

            if (!devicesInMaintenance.length) {
                const empty = 'Nenhum dispositivo em manutenção no momento';
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">${empty}</td></tr>`;
                cards.innerHTML = `<div class="device-card"><div style="text-align:center; color: var(--text-muted); font-weight: 700;">${empty}</div></div>`;
                return;
            }

            const actionButtons = (device) => `
                <button class="btn btn-secondary btn-small" onclick="openDeviceDetails(${device.id})">
                    <i class="fas fa-circle-info"></i>
                    Detalhes
                </button>
                ${canManageDevices() ? `
                    <button class="btn btn-success btn-small" onclick="resolveMaintenance(${device.id})">
                        <i class="fas fa-check"></i>
                        Resolver
                    </button>
                ` : ''}
            `;

            tableBody.innerHTML = entries.map(({ device, entry }) => `
                <tr>
                    <td style="font-weight: 800;">${escapeHtml(device.type || '-')}</td>
                    <td>${escapeHtml(device.patrimony || device.counter_number || '-')}</td>
                    <td>${escapeHtml(device.group || '-')}</td>
                    <td>${entry?.created_at ? escapeHtml(formatDateTimeBR(new Date(entry.created_at))) : '-'}</td>
                    <td>${escapeHtml(entry?.changed_by || '-')}</td>
                    <td>${escapeHtml(entry?.notes || device.observations || '-')}</td>
                    <td><div style="display: flex; gap: 8px; flex-wrap: wrap;">${actionButtons(device)}</div></td>
                </tr>
            `).join('');

            cards.innerHTML = entries.map(({ device, entry }) => `
                <div class="device-card device-card-clickable" onclick="openDeviceDetails(${device.id})">
                    <div class="device-card-top">
                        <div class="device-card-title">
                            <i class="fas fa-${getDeviceIcon(device.type)}"></i>
                            <span>${escapeHtml(device.type || '-')}</span>
                        </div>
                        <span class="badge yellow">${getMaintenanceAgeLabel(entry)}</span>
                    </div>
                    <div class="device-card-meta">
                        <div class="device-card-field"><small>Patrimônio</small><span>${escapeHtml(device.patrimony || device.counter_number || '-')}</span></div>
                        <div class="device-card-field"><small>Agrupamento</small><span>${escapeHtml(device.group || '-')}</span></div>
                        <div class="device-card-field"><small>Entrada</small><span>${entry?.created_at ? escapeHtml(formatDateTimeBR(new Date(entry.created_at))) : '-'}</span></div>
                        <div class="device-card-field"><small>Responsável</small><span>${escapeHtml(entry?.changed_by || '-')}</span></div>
                        <div class="device-card-field" style="grid-column: 1 / -1;"><small>Motivo / observações</small><span>${escapeHtml(entry?.notes || device.observations || '-')}</span></div>
                    </div>
                    <div class="device-card-actions" onclick="event.stopPropagation()">${actionButtons(device)}</div>
                </div>
            `).join('');
        }

        async function resolveMaintenance(deviceId) {
            if (!requireDeviceAdminPermission()) return;
            const device = data.devices.find(item => parseInt(item.id) === parseInt(deviceId));
            if (!device) return;
            if (device.status !== 'Manutenção') {
                alert('Este dispositivo não está em manutenção.');
                return;
            }
            await toggleMaintenance(deviceId);
        }
        function updateStats() {
            const available = data.devices.filter(d => d.status === 'Disponível').length;
            const inUse = data.loans
                .filter(loan => !loan.returned)
                .reduce((sum, loan) => sum + getLoanPendingQuantity(loan), 0);
            const maintenance = data.devices.filter(d => d.status === 'Manutenção').length;
            const outOfUse = data.devices.filter(d => d.status === 'Fora de uso').length;
            const total = data.devices.length;

            document.getElementById('stat-available').textContent = available || 0;
            document.getElementById('stat-inuse').textContent = inUse || 0;
            document.getElementById('stat-maintenance').textContent = maintenance || 0;
            const outOfUseEl = document.getElementById('stat-outofuse');
            if (outOfUseEl) outOfUseEl.textContent = outOfUse || 0;
            document.getElementById('stat-total').textContent = total || 0;
        }

        function updateSelects() {
            // Turmas
            let classOptions = '<option value="">Selecione uma turma</option>';
            data.classes.forEach(c => classOptions += `<option value="${c.id}">${c.name} (${c.shift})</option>`);
            document.getElementById('loanClass').innerHTML = classOptions;
            document.getElementById('filterClass').innerHTML = '<option value="">Todas as turmas</option>' + classOptions;
            document.getElementById('reservationClass').innerHTML = classOptions;

            // Professores
            let teacherOptions = '<option value="">Selecione um professor</option>';
            data.teachers.forEach(t => teacherOptions += `<option value="${t.id}">${t.name}</option>`);
            document.getElementById('loanTeacher').innerHTML = teacherOptions;
            document.getElementById('filterTeacher').innerHTML = '<option value="">Todos os professores</option>' + teacherOptions;
            document.getElementById('reservationTeacher').innerHTML = teacherOptions;

            // Grupos
            const groups = [...new Set(data.devices
                .filter(d => !isFixedDevice(d.type) || isTechCartGroup(d.group))
                .map(d => d.group)
                .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
            let groupOptions = '<option value="">Selecione um agrupamento</option>';
            groups.forEach(g => {
                const availableCount = data.devices.filter(d =>
                    (!isFixedDevice(d.type) || isTechCartGroup(g)) &&
                    d.group === g &&
                    d.status === 'DisponÃ­vel'
                ).length;
                groupOptions += `<option value="${escapeHtml(g)}">${escapeHtml(g)}${availableCount ? ` (${availableCount} disponiveis)` : ''}</option>`;
            });
            document.getElementById('loanGroup').innerHTML = groupOptions;

            const datalist = document.getElementById('deviceGroupSuggestions');
            if (datalist) {
                const baseSuggestions = ['Fora', 'Base 1', 'Base 2', 'Base 3', 'Anexo', 'Sala de Informatica'];
                const suggestions = [...new Set([...baseSuggestions, ...groups])];
                datalist.innerHTML = suggestions.map(group => `<option value="${escapeHtml(group)}"></option>`).join('');
            }
            updateReservationGroupOptions();
        }

        const WEEKDAY_LABELS = [
            'Domingo',
            'Segunda-feira',
            'Terça-feira',
            'Quarta-feira',
            'Quinta-feira',
            'Sexta-feira',
            'Sábado'
        ];

        function updateReservationGroupOptions() {
            const typeSelect = document.getElementById('reservationDeviceType');
            const groupSelect = document.getElementById('reservationGroup');
            if (!typeSelect || !groupSelect) return;

            const currentValue = groupSelect.value;
            const groups = [...new Set(data.devices
                .filter(device =>
                    !isFixedDevice(device.type) &&
                    device.type === typeSelect.value &&
                    device.group
                )
                .map(device => device.group)
            )].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));

            groupSelect.innerHTML = '<option value="">Selecione uma base</option>' +
                groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
            if (groups.includes(currentValue)) groupSelect.value = currentValue;
        }

        function formatReservationTime(value) {
            return (value || '').toString().slice(0, 5) || '--:--';
        }

        function getReservationClassName(reservation) {
            return data.classes.find(item => parseInt(item.id) === parseInt(reservation.class_id))?.name || '-';
        }

        function getReservationTeacherName(reservation) {
            return data.teachers.find(item => parseInt(item.id) === parseInt(reservation.teacher_id))?.name || '-';
        }

        function formatReservationOccurrenceDate(occurrence) {
            return [
                occurrence.getFullYear(),
                String(occurrence.getMonth() + 1).padStart(2, '0'),
                String(occurrence.getDate()).padStart(2, '0')
            ].join('-');
        }

        function getReservationLoanMarker(reservation, occurrence) {
            return `[Agendamento #${reservation.id} · ${formatReservationOccurrenceDate(occurrence)}]`;
        }

        function isReservationOccurrenceRegistered(reservation, occurrence) {
            const marker = getReservationLoanMarker(reservation, occurrence);
            return (data.loans || []).some(loan => String(loan.observations || '').includes(marker));
        }

        function getActionableReservationOccurrence(reservation, referenceDate = new Date()) {
            if (Number(reservation.weekday) !== referenceDate.getDay()) return null;

            const [hours, minutes] = formatReservationTime(reservation.start_time).split(':').map(Number);
            if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

            const occurrence = new Date(referenceDate);
            occurrence.setHours(hours, minutes, 0, 0);
            const distance = occurrence.getTime() - referenceDate.getTime();
            const reminderWindow = (Number(reservation.reminder_minutes) || 10) * 60000;
            return distance <= reminderWindow && distance >= -15 * 60000 ? occurrence : null;
        }

        function updateWeeklyReservations() {
            const container = document.getElementById('weeklyReservationsList');
            if (!container) return;

            const canManage = canManageWeeklyReservations();
            const form = document.getElementById('weeklyReservationForm');
            const hint = document.getElementById('reservationPermissionHint');
            form.style.display = canManage ? '' : 'none';
            hint.style.display = canManage ? 'none' : 'block';
            hint.textContent = 'Entre com uma conta de funcionário ou administrador para criar e alterar agendamentos.';

            const reservations = [...(data.weeklyReservations || [])]
                .sort((a, b) =>
                    Number(a.weekday) - Number(b.weekday) ||
                    String(a.start_time).localeCompare(String(b.start_time))
                );
            const activeCount = reservations.filter(item => item.active).length;
            document.getElementById('reservationActiveCount').textContent = `${activeCount} ativo(s)`;

            container.innerHTML = [1, 2, 3, 4, 5].map(weekday => {
                const dayReservations = reservations.filter(item => Number(item.weekday) === weekday);
                const itemsHtml = dayReservations.length
                    ? dayReservations.map(reservation => {
                        const className = getReservationClassName(reservation);
                        const teacherName = getReservationTeacherName(reservation);
                        const actionableOccurrence = reservation.active
                            ? getActionableReservationOccurrence(reservation)
                            : null;
                        const occurrenceRegistered = actionableOccurrence
                            ? isReservationOccurrenceRegistered(reservation, actionableOccurrence)
                            : false;
                        const actionHtml = canManage
                            ? `
                                <div class="schedule-item-actions">
                                    ${actionableOccurrence ? `
                                        <button
                                            type="button"
                                            class="btn btn-small ${occurrenceRegistered ? 'btn-secondary' : 'btn-success'}"
                                            onclick="registerReservationLoanFromSchedule(${reservation.id}, ${actionableOccurrence.getTime()})"
                                            ${occurrenceRegistered ? 'disabled' : ''}
                                        >
                                            <i class="fas fa-${occurrenceRegistered ? 'circle-check' : 'truck-ramp-box'}"></i>
                                            ${occurrenceRegistered ? 'Empréstimo registrado' : 'Já levei'}
                                        </button>
                                    ` : ''}
                                    <button type="button" class="btn btn-small btn-secondary" onclick="toggleWeeklyReservation(${reservation.id}, ${!reservation.active})">
                                        <i class="fas fa-${reservation.active ? 'pause' : 'play'}"></i>
                                        ${reservation.active ? 'Pausar' : 'Ativar'}
                                    </button>
                                    <button type="button" class="btn btn-small btn-danger" onclick="deleteWeeklyReservation(${reservation.id})">
                                        <i class="fas fa-trash"></i>
                                        Remover
                                    </button>
                                </div>
                            `
                            : '';
                        return `
                            <div class="schedule-item ${reservation.active ? '' : 'inactive'} ${occurrenceRegistered ? 'completed' : ''}">
                                <div class="schedule-item-time">${escapeHtml(formatReservationTime(reservation.start_time))}</div>
                                <div class="schedule-item-title">${escapeHtml(reservation.group_name)} → ${escapeHtml(className)}</div>
                                <div class="schedule-item-meta">
                                    ${escapeHtml(teacherName)}<br>
                                    ${escapeHtml(reservation.device_type)} · aviso ${escapeHtml(String(reservation.reminder_minutes))} min antes
                                    ${reservation.notes ? `<br>${escapeHtml(reservation.notes)}` : ''}
                                    ${occurrenceRegistered ? '<br><strong>Empréstimo desta aula já registrado</strong>' : ''}
                                    ${reservation.active ? '' : '<br><strong>Pausado</strong>'}
                                </div>
                                ${actionHtml}
                            </div>
                        `;
                    }).join('')
                    : '<div class="schedule-item-meta" style="padding: 10px;">Nenhum agendamento.</div>';

                return `
                    <div class="schedule-day">
                        <div class="schedule-day-header">${WEEKDAY_LABELS[weekday]}</div>
                        <div class="schedule-day-body">${itemsHtml}</div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('weeklyReservationForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            if (!canManageWeeklyReservations()) {
                alert('Entre com uma conta de funcionário ou administrador para salvar agendamentos.');
                return;
            }

            const reservation = {
                weekday: parseInt(document.getElementById('reservationWeekday').value),
                start_time: document.getElementById('reservationStartTime').value,
                class_id: parseInt(document.getElementById('reservationClass').value),
                teacher_id: parseInt(document.getElementById('reservationTeacher').value),
                device_type: document.getElementById('reservationDeviceType').value,
                group_name: document.getElementById('reservationGroup').value,
                reminder_minutes: parseInt(document.getElementById('reservationReminderMinutes').value) || 10,
                notes: document.getElementById('reservationNotes').value.trim() || null,
                active: true,
                created_by: getCurrentActorName()
            };

            const duplicate = (data.weeklyReservations || []).find(item =>
                item.active &&
                Number(item.weekday) === reservation.weekday &&
                formatReservationTime(item.start_time) === reservation.start_time &&
                item.group_name === reservation.group_name
            );
            if (duplicate && !confirm('Essa base já possui um agendamento ativo no mesmo dia e horário. Deseja salvar mesmo assim?')) {
                return;
            }

            try {
                const { error } = await client.from('weekly_reservations').insert(reservation);
                if (error) throw error;
                await showAppAlert('Agendamento semanal salvo com sucesso!', { type: 'success' });
                this.reset();
                document.getElementById('reservationReminderMinutes').value = '10';
                updateReservationGroupOptions();
                await loadData();
            } catch (error) {
                console.error('Erro ao salvar agendamento:', error);
                const message = error.message?.includes('weekly_reservations')
                    ? 'Execute o arquivo agendamentos_reservas_semanais.sql no Supabase antes de usar os agendamentos.'
                    : error.message;
                alert('Erro ao salvar agendamento: ' + message);
            }
        });

        async function toggleWeeklyReservation(reservationId, active) {
            if (!canManageWeeklyReservations()) return;
            try {
                const { error } = await client
                    .from('weekly_reservations')
                    .update({ active, updated_at: new Date().toISOString() })
                    .eq('id', reservationId);
                if (error) throw error;
                await loadData();
            } catch (error) {
                alert('Erro ao atualizar agendamento: ' + error.message);
            }
        }

        async function deleteWeeklyReservation(reservationId) {
            if (!canManageWeeklyReservations()) return;
            if (!confirm('Remover este agendamento semanal?')) return;
            try {
                const { error } = await client
                    .from('weekly_reservations')
                    .delete()
                    .eq('id', reservationId);
                if (error) throw error;
                await loadData();
            } catch (error) {
                alert('Erro ao remover agendamento: ' + error.message);
            }
        }

        function getWeeklyReservationOccurrence(reservation, referenceDate = new Date()) {
            const [hours, minutes] = formatReservationTime(reservation.start_time)
                .split(':')
                .map(Number);
            if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

            const occurrence = new Date(referenceDate);
            occurrence.setHours(hours, minutes, 0, 0);
            const daysAhead = (Number(reservation.weekday) - referenceDate.getDay() + 7) % 7;
            occurrence.setDate(referenceDate.getDate() + daysAhead);

            if (daysAhead === 0 && occurrence.getTime() < referenceDate.getTime() - 15 * 60000) {
                occurrence.setDate(occurrence.getDate() + 7);
            }
            return occurrence;
        }

        function getSeenReservationReminders() {
            try {
                const parsed = JSON.parse(localStorage.getItem(RESERVATION_REMINDER_STORAGE_KEY) || '{}');
                const cutoff = Date.now() - 14 * 86400000;
                return Object.fromEntries(
                    Object.entries(parsed).filter(([, timestamp]) => Number(timestamp) >= cutoff)
                );
            } catch (error) {
                return {};
            }
        }

        function getReservationReminderKey(reservation, occurrence) {
            return `${reservation.id}:${occurrence.getFullYear()}-${occurrence.getMonth() + 1}-${occurrence.getDate()}-${formatReservationTime(reservation.start_time)}`;
        }

        function checkScheduledReservationNotifications() {
            if (!currentUser || !(data.weeklyReservations || []).length) return;

            const now = new Date();
            const seen = getSeenReservationReminders();
            let seenChanged = false;
            const queuedKeys = new Set(reservationReminderQueue.map(item => item.key));
            if (activeReservationReminder) queuedKeys.add(activeReservationReminder.key);

            (data.weeklyReservations || [])
                .filter(reservation => reservation.active)
                .forEach(reservation => {
                    const occurrence = getWeeklyReservationOccurrence(reservation, now);
                    if (!occurrence) return;

                    const remainingMilliseconds = occurrence.getTime() - now.getTime();
                    const reminderWindow = (Number(reservation.reminder_minutes) || 10) * 60000;
                    if (remainingMilliseconds > reminderWindow || remainingMilliseconds < -15 * 60000) return;

                    const key = getReservationReminderKey(reservation, occurrence);
                    if (seen[key] || queuedKeys.has(key) || isReservationOccurrenceRegistered(reservation, occurrence)) return;

                    seen[key] = Date.now();
                    seenChanged = true;
                    queuedKeys.add(key);
                    reservationReminderQueue.push({ reservation, occurrence, key });
                });

            if (seenChanged) {
                localStorage.setItem(RESERVATION_REMINDER_STORAGE_KEY, JSON.stringify(seen));
            }
            showNextReservationReminder();
        }

        function showNextReservationReminder() {
            if (
                activeReservationReminder ||
                activeLoanDurationReminder ||
                !reservationReminderQueue.length
            ) return;

            activeReservationReminder = reservationReminderQueue.shift();
            const { reservation, occurrence } = activeReservationReminder;
            const currentReservation = (data.weeklyReservations || []).find(item =>
                parseInt(item.id) === parseInt(reservation.id) && item.active
            );
            if (!currentReservation) {
                activeReservationReminder = null;
                showNextReservationReminder();
                return;
            }
            const remainingMinutes = Math.ceil((occurrence.getTime() - Date.now()) / 60000);
            const className = getReservationClassName(reservation);
            const teacherName = getReservationTeacherName(reservation);
            const alreadyRegistered = isReservationOccurrenceRegistered(reservation, occurrence);

            document.getElementById('reservationReminderKicker').textContent = remainingMinutes > 1
                ? `Aula em ${remainingMinutes} minutos`
                : remainingMinutes === 1
                    ? 'Aula em 1 minuto'
                    : remainingMinutes === 0
                        ? 'Aula começando agora'
                        : `Aula iniciada há ${Math.abs(remainingMinutes)} minuto(s)`;
            document.getElementById('reservationReminderTitle').textContent =
                `Levar ${reservation.group_name} para ${className}`;
            document.getElementById('reservationReminderMessage').textContent =
                `${teacherName} · ${formatReservationTime(reservation.start_time)} · ${reservation.device_type}` +
                (reservation.notes ? ` — ${reservation.notes}` : '');
            const deliveredButton = document.getElementById('reservationAlreadyDeliveredButton');
            deliveredButton.style.display = canManageWeeklyReservations() ? '' : 'none';
            deliveredButton.disabled = alreadyRegistered;
            deliveredButton.innerHTML = alreadyRegistered
                ? '<i class="fas fa-circle-check"></i> Empréstimo registrado'
                : '<i class="fas fa-truck-ramp-box"></i> Já levei';
            const modal = document.getElementById('reservationReminderModal');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }

        async function registerReservationLoan(reservation, occurrence) {
            if (!canManageWeeklyReservations()) {
                alert('Entre com uma conta de funcionário ou administrador para registrar o empréstimo.');
                return;
            }
            if (!reservation?.active || !occurrence) return;

            const registrationKey = getReservationReminderKey(reservation, occurrence);
            if (
                reservationLoanRegistrationsInProgress.has(registrationKey) ||
                isReservationOccurrenceRegistered(reservation, occurrence)
            ) {
                await showAppAlert('O empréstimo desta aula já foi registrado.', { type: 'info' });
                return;
            }

            reservationLoanRegistrationsInProgress.add(registrationKey);
            const deliveredButton = document.getElementById('reservationAlreadyDeliveredButton');
            if (deliveredButton) {
                deliveredButton.disabled = true;
                deliveredButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
            }
            updateWeeklyReservations();

            try {
                const result = await registerLoanFromWeeklyReservation(reservation, occurrence);
                if (
                    activeReservationReminder &&
                    parseInt(activeReservationReminder.reservation.id) === parseInt(reservation.id)
                ) {
                    closeReservationReminder();
                }
                await loadData();
                await showAppAlert(
                    result.merged
                        ? `${result.quantity} dispositivo(s) da ${reservation.group_name} foram adicionados ao empréstimo em aberto.`
                        : `Empréstimo da ${reservation.group_name} registrado automaticamente com ${result.quantity} dispositivo(s).`,
                    { type: 'success' }
                );
            } catch (error) {
                console.error('Erro ao registrar empréstimo do agendamento:', error);
                alert(getLoanRegistrationErrorMessage(error));
                await loadData();
            } finally {
                reservationLoanRegistrationsInProgress.delete(registrationKey);
                if (deliveredButton && activeReservationReminder) {
                    deliveredButton.disabled = false;
                    deliveredButton.innerHTML = '<i class="fas fa-truck-ramp-box"></i> Já levei';
                }
                updateWeeklyReservations();
            }
        }

        async function registerActiveReservationLoan() {
            if (!activeReservationReminder) return;
            const { reservation, occurrence } = activeReservationReminder;
            await registerReservationLoan(reservation, occurrence);
        }

        async function registerReservationLoanFromSchedule(reservationId, occurrenceTimestamp) {
            const reservation = (data.weeklyReservations || []).find(item =>
                parseInt(item.id) === parseInt(reservationId)
            );
            if (!reservation) return;
            await registerReservationLoan(reservation, new Date(Number(occurrenceTimestamp)));
        }

        function closeReservationReminder() {
            const modal = document.getElementById('reservationReminderModal');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            activeReservationReminder = null;
            setTimeout(showNextReservationReminder, 200);
            setTimeout(showNextLongRunningLoanReminder, 200);
        }

        function openSchedulesFromReminder() {
            closeReservationReminder();
            showScreen('schedules');
        }

        function getDeviceTypeOrder(type) {
            const order = {
                Notebook: 0,
                'Notebook Positivo (Novos)': 1,
                'Notebook Ultra': 2,
                Tablet: 3,
                Desktop: 4,
                'Desktop Gestão': 5
            };
            return order[type] ?? 99;
        }

        function getDeviceIcon(type) {
            if (type === 'Tablet') return 'tablet-alt';
            if (type === 'Desktop' || type === 'Desktop Gestão') return 'desktop';
            return 'laptop';
        }

        function isFixedDevice(type) {
            return type === 'Desktop' || type === 'Desktop Gestão';
        }

        function isTechCartGroup(groupName) {
            return normalizeDeviceText(groupName) === 'carrinho tec';
        }

        function getDeviceStatusBadgeColor(status) {
            if (status === 'Disponível') return 'green';
            if (status === 'Em uso') return 'yellow';
            if (status === 'Fora de uso') return 'gray';
            return 'red';
        }

        function normalizeDeviceText(value) {
            return (value || '')
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        }

        function findDeviceWithSameSerial(serialNumber, currentDeviceId = '') {
            const normalizedSerial = normalizeDeviceText(serialNumber);
            const parsedCurrentId = currentDeviceId ? parseInt(currentDeviceId) : null;
            if (!normalizedSerial) return null;

            return data.devices.find(device => {
                if (parsedCurrentId && device.id === parsedCurrentId) return false;
                return normalizeDeviceText(device.serial_number) === normalizedSerial;
            }) || null;
        }

        function findDeviceWithSameCounterNumber(type, counterNumber, currentDeviceId = '') {
            const normalizedCounter = normalizeDeviceText(counterNumber);
            const parsedCurrentId = currentDeviceId ? parseInt(currentDeviceId) : null;
            if (!type || !normalizedCounter || normalizedCounter === 's/n' || normalizedCounter === 'sn') return null;

            return data.devices.find(device => {
                if (device.type !== type) return false;
                if (parsedCurrentId && parseInt(device.id) === parsedCurrentId) return false;
                return normalizeDeviceText(device.counter_number) === normalizedCounter;
            }) || null;
        }

        function escapeHtml(value) {
            return (value ?? '-').toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function escapeJsString(value) {
            return (value ?? '').toString()
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        }

        function renderDetailInfoItem(label, value) {
            return `
                <div class="detail-info-item">
                    <small>${escapeHtml(label)}</small>
                    <span>${escapeHtml(value || '-')}</span>
                </div>
            `;
        }

        function getAllDeviceMaintenanceHistory() {
            try {
                const parsed = JSON.parse(localStorage.getItem(DEVICE_MAINTENANCE_HISTORY_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function saveAllDeviceMaintenanceHistory(history) {
            localStorage.setItem(DEVICE_MAINTENANCE_HISTORY_KEY, JSON.stringify(history));
        }

        function getDeviceMaintenanceHistory(deviceId) {
            const remoteHistory = (data.deviceMaintenanceHistory || [])
                .filter(item => parseInt(item.device_id) === parseInt(deviceId));
            const localHistory = getAllDeviceMaintenanceHistory()
                .filter(item => parseInt(item.device_id) === parseInt(deviceId));

            return [...remoteHistory, ...localHistory]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        function getCurrentActorName() {
            if (!currentUser) return null;
            if (isQuickAccess) return currentUser.name || currentUser.role || null;
            return currentUserProfile?.name || currentUser.user_metadata?.name || currentUser.email || null;
        }

        function summarizeDeviceForHistory(device) {
            if (!device) return null;
            return {
                id: device.id,
                type: device.type || null,
                serial_number: device.serial_number || null,
                patrimony: device.patrimony || null,
                counter_number: device.counter_number || null,
                group: device.group || null,
                status: device.status || null,
                brand: device.brand || null,
                model: device.model || null,
                observations: device.observations || null
            };
        }

        async function recordDeviceChangeEvent(action, device, previousData = null, newData = null, notes = null) {
            if (!device?.id) return;

            const eventData = {
                device_id: device.id,
                action,
                changed_by: getCurrentActorName(),
                previous_data: previousData ? summarizeDeviceForHistory(previousData) : null,
                new_data: newData ? summarizeDeviceForHistory(newData) : null,
                notes
            };

            try {
                const { data: insertedHistory, error } = await client
                    .from('device_change_history')
                    .insert(eventData)
                    .select()
                    .single();
                if (error) throw error;
                data.deviceChangeHistory = [insertedHistory, ...(data.deviceChangeHistory || [])];
            } catch (error) {
                console.warn('Histórico de alterações de dispositivos indisponível:', error.message || error);
            }
        }

        async function recordDeviceMaintenanceEvent(device, previousStatus, newStatus, notes = null) {
            if (!device || previousStatus === newStatus) return;
            if (![previousStatus, newStatus].includes('Manutenção')) return;

            const eventData = {
                device_id: device.id,
                previous_status: previousStatus,
                new_status: newStatus,
                notes: notes || device.observations || null,
                changed_by: getCurrentActorName()
            };

            try {
                const { data: insertedHistory, error } = await client
                    .from('device_maintenance_history')
                    .insert(eventData)
                    .select()
                    .single();
                if (error) throw error;
                data.deviceMaintenanceHistory = [insertedHistory, ...(data.deviceMaintenanceHistory || [])];
            } catch (error) {
                console.warn('Histórico de manutenção indisponível:', error.message || error);
            }

            await recordDeviceChangeEvent(newStatus === 'Manutenção' ? 'maintenance_in' : 'maintenance_out', device, { ...device, status: previousStatus }, { ...device, status: newStatus }, eventData.notes);
        }

        function getDeviceRelatedLoans(device) {
            if (!device) return [];
            const exactLoanIds = new Set((data.loanDevices || [])
                .filter(item => parseInt(item.device_id) === parseInt(device.id))
                .map(item => parseInt(item.loan_id)));
            const deviceType = normalizeDeviceText(device.type);
            const deviceGroup = normalizeDeviceText(device.group);
            const relatedMap = new Map();

            data.loans.forEach(loan => {
                const isExact = exactLoanIds.has(parseInt(loan.id));
                const isApproximate =
                    normalizeDeviceText(loan.device_type) === deviceType &&
                    (!loan.group_name || normalizeDeviceText(loan.group_name) === deviceGroup);

                if (isExact || isApproximate) {
                    relatedMap.set(loan.id, loan);
                }
            });

            return [...relatedMap.values()].sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        function getCurrentDeviceResponsible(device, relatedLoans = null) {
            const loans = relatedLoans || getDeviceRelatedLoans(device);
            const activeLoan = loans.find(loan =>
                !loan.returned && isDevicePendingInLoan(device.id, loan.id)
            );
            if (!activeLoan) return '-';
            const className = data.classes.find(c => c.id === activeLoan.class_id)?.name || '-';
            const teacherName = data.teachers.find(t => t.id === activeLoan.teacher_id)?.name || '-';
            return `${teacherName} (${className})`;
        }

        function renderSelectedDeviceDetails() {
            if (!selectedDeviceId) return;
            const device = data.devices.find(d => d.id === selectedDeviceId);
            if (!device) {
                selectedDeviceId = null;
                return;
            }
            renderDeviceDetails(device);
        }

        function openDeviceDetails(deviceId) {
            const device = data.devices.find(d => d.id === deviceId);
            if (!device) return;
            selectedDeviceId = deviceId;
            renderDeviceDetails(device);
            showScreen('device-detail');
        }

        function renderDeviceDetails(device) {
            const container = document.getElementById('deviceDetailContent');
            if (!container) return;

            const badgeColor = getDeviceStatusBadgeColor(device.status);
            const icon = getDeviceIcon(device.type);
            const relatedLoans = getDeviceRelatedLoans(device);
            const maintenanceHistory = getDeviceMaintenanceHistory(device.id);
            const changeHistory = (data.deviceChangeHistory || []).filter(item => parseInt(item.device_id) === parseInt(device.id));
            const currentResponsible = getCurrentDeviceResponsible(device, relatedLoans);
            const isCurrentlyMaintenance = device.status === 'Manutenção';
            const activeLoan = relatedLoans.find(loan =>
                !loan.returned && isDevicePendingInLoan(device.id, loan.id)
            );
            const quickDeviceActionHtml = activeLoan
                ? `<button class="btn btn-success btn-full" onclick="startReturnFromDevice(${device.id})">
                        <i class="fas fa-undo"></i>
                        Devolver este dispositivo
                   </button>`
                : (device.status === 'Disponível' && !isFixedDevice(device.type)
                    ? `<button class="btn btn-primary btn-full" onclick="startLoanFromDevice(${device.id})">
                            <i class="fas fa-sign-out-alt"></i>
                            Emprestar este dispositivo
                       </button>`
                    : '');

            const loanHtml = relatedLoans.length
                ? `<div class="detail-timeline">
                    ${relatedLoans.map(loan => {
                        const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                        const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                        const deviceLoanLink = (data.loanDevices || []).find(item =>
                            parseInt(item.loan_id) === parseInt(loan.id) &&
                            parseInt(item.device_id) === parseInt(device.id)
                        );
                        const individualStatus = deviceLoanLink
                            ? getLoanDeviceReturnStatus(deviceLoanLink, loan)
                            : null;
                        const statusText = individualStatus === 'returned'
                            ? 'Devolvido'
                            : individualStatus === 'damaged'
                                ? 'Com danos'
                                : loan.returned
                                    ? (loan.return_status === 'complete' ? 'Devolvido' : loan.return_status === 'incomplete' ? 'Incompleto' : 'Com danos')
                                    : 'Em uso';
                        const statusColor = statusText === 'Devolvido'
                            ? 'green'
                            : statusText === 'Com danos'
                                ? 'red'
                                : 'yellow';
                        return `
                            <div class="detail-timeline-item">
                                <div class="detail-timeline-title">
                                    <span>${escapeHtml(className)} - ${escapeHtml(teacherName)}</span>
                                    <span class="badge ${statusColor}">${escapeHtml(statusText)}</span>
                                </div>
                                <div class="detail-timeline-meta">
                                    ${escapeHtml(loan.date_time)} - ${escapeHtml(loan.quantity)} dispositivo(s) - ${escapeHtml(loan.loan_type === 'full' ? (loan.group_name || device.group) : 'Quantidade específica')}
                                    ${deviceLoanLink?.returned_at ? `<br>Este dispositivo foi processado em: ${escapeHtml(formatDateTimeBR(new Date(deviceLoanLink.returned_at)))}` : ''}
                                    ${loan.return_date_time ? `<br>Devolução: ${escapeHtml(loan.return_date_time)} (${escapeHtml(loan.return_quantity || loan.quantity)} dispositivo(s))` : ''}
                                    ${loan.observations ? `<br>Obs. saída: ${escapeHtml(loan.observations)}` : ''}
                                    ${loan.return_observations ? `<br>Obs. devolução: ${escapeHtml(loan.return_observations)}` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>`
                : '<div class="detail-empty">Nenhum empréstimo relacionado encontrado.</div>';

            const maintenanceHtml = maintenanceHistory.length
                ? `<div class="detail-timeline">
                    ${maintenanceHistory.map(item => `
                        <div class="detail-timeline-item">
                            <div class="detail-timeline-title">
                                <span>${escapeHtml(item.previous_status)} -> ${escapeHtml(item.new_status)}</span>
                                <span>${escapeHtml(formatDateTimeBR(new Date(item.created_at)))}</span>
                            </div>
                            <div class="detail-timeline-meta">
                                ${escapeHtml(item.new_status === 'Manutenção' ? 'Entrada em manutenção' : 'Saída de manutenção')}
                                ${(item.notes || item.observations) ? `<br>Observações do dispositivo: ${escapeHtml(item.notes || item.observations)}` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>`
                : `<div class="detail-empty">${isCurrentlyMaintenance ? 'Status atual: em manutenção. Ainda não há registros anteriores salvos.' : 'Nenhum registro de manutenção salvo para este dispositivo.'}</div>`;

            const changeActionLabels = {
                created: 'Criado',
                updated: 'Editado',
                deleted: 'Apagado',
                maintenance_in: 'Entrada em manutenção',
                maintenance_out: 'Saída de manutenção'
            };
            const changeHtml = changeHistory.length
                ? `<div class="detail-timeline">
                    ${changeHistory.map(item => `
                        <div class="detail-timeline-item">
                            <div class="detail-timeline-title">
                                <span>${escapeHtml(changeActionLabels[item.action] || item.action || 'Alteração')}</span>
                                <span>${item.created_at ? escapeHtml(formatDateTimeBR(new Date(item.created_at))) : '-'}</span>
                            </div>
                            <div class="detail-timeline-meta">
                                ${item.changed_by ? `Por: ${escapeHtml(item.changed_by)}` : 'Responsável não registrado'}
                                ${item.notes ? `<br>${escapeHtml(item.notes)}` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>`
                : '<div class="detail-empty">Nenhuma alteração administrativa registrada.</div>';
            container.innerHTML = `
                <div class="device-detail-layout">
                    <aside class="device-detail-panel">
                        <div class="device-detail-title">
                            <i class="fas fa-${icon}"></i>
                            <span>${escapeHtml(device.type)}</span>
                        </div>
                        <div class="device-detail-subtitle">
                            <span class="badge ${badgeColor}">${escapeHtml(device.status)}</span>
                        </div>
                        <div class="detail-info-grid">
                            ${renderDetailInfoItem('ID', device.id)}
                            ${renderDetailInfoItem('Número de série', device.serial_number)}
                            ${renderDetailInfoItem('Patrimônio', device.patrimony)}
                            ${renderDetailInfoItem('Marca', device.brand)}
                            ${renderDetailInfoItem('Modelo', device.model)}
                            ${device.type === 'Tablet' ? renderDetailInfoItem('IMEI', device.imei) : ''}
                            ${renderDetailInfoItem('Número contador / S/N', device.counter_number)}
                            ${renderDetailInfoItem('Agrupamento / Sala', device.group)}
                            ${renderDetailInfoItem('Escola', getLabelSchoolName(device))}
                            ${renderDetailInfoItem('Responsável atual', currentResponsible)}
                            ${renderDetailInfoItem('Criado em', device.created_at ? formatDateTimeBR(new Date(device.created_at)) : '-')}
                            ${renderDetailInfoItem('Observações', device.observations)}
                        </div>
                        <div style="display: grid; gap: 10px; margin-top: 16px;">
                            ${quickDeviceActionHtml}
                            <button class="btn btn-primary btn-full" onclick="editDevice(${device.id})">
                                <i class="fas fa-edit"></i>
                                Editar dispositivo
                            </button>
                            <button class="btn btn-secondary btn-full" onclick="generateSingleDeviceLabelPdf(${device.id})">
                                <i class="fas fa-tag"></i>
                                Gerar etiqueta
                            </button>
                            <button class="btn btn-secondary btn-full" style="background: #fef3c7; color: #92400e;" onclick="toggleMaintenance(${device.id})">
                                <i class="fas fa-wrench"></i>
                                ${device.status === 'Manutenção' ? 'Retirar da manutenção' : 'Colocar em manutenção'}
                            </button>
                        </div>
                    </aside>

                    <div class="device-detail-stack">
                        <section class="device-detail-section">
                            <div class="device-detail-section-header">
                                <div class="device-detail-section-title">Empréstimos anteriores</div>
                                <span class="badge blue">${relatedLoans.length}</span>
                            </div>
                            <div class="device-detail-section-body">${loanHtml}</div>
                        </section>

                        <section class="device-detail-section">
                            <div class="device-detail-section-header">
                                <div class="device-detail-section-title">Histórico de manutenção</div>
                                <span class="badge yellow">${maintenanceHistory.length}</span>
                            </div>
                            <div class="device-detail-section-body">${maintenanceHtml}</div>
                        </section>
                        <section class="device-detail-section">
                            <div class="device-detail-section-header">
                                <div class="device-detail-section-title">Histórico de alterações</div>
                                <span class="badge blue">${changeHistory.length}</span>
                            </div>
                            <div class="device-detail-section-body">${changeHtml}</div>
                        </section>
                    </div>
                </div>
            `;
        }

        function getDeviceDisplayGroupKey(device) {
            if (isFixedDevice(device?.type)) {
                return `${device.type || 'Outros'}::${device.group || 'Sem agrupamento'}`;
            }
            return device?.type || 'Outros';
        }

        function getDeviceDisplayGroupLabel(device) {
            if (isFixedDevice(device?.type)) {
                return `${device.type || 'Outros'} - ${device.group || 'Sem agrupamento'}`;
            }
            return device?.type || 'Outros';
        }

        function getFilteredDevices() {
            const selectedType = document.getElementById('deviceTypeFilter')?.value || '';
            const searchTerm = normalizeDeviceText(document.getElementById('deviceSearchInput')?.value || '');
            const selectedStatus = deviceStatusFilter;
            const sortedDevices = sortDevicesForDisplay(data.devices);

            return sortedDevices.filter(device => {
                const matchesType = !selectedType || device.type === selectedType;
                if (!matchesType) return false;
                const matchesStatus = !selectedStatus || device.status === selectedStatus;
                if (!matchesStatus) return false;

                if (!searchTerm) return true;

                const searchableValues = [
                    device.id,
                    device.serial_number,
                    device.counter_number,
                    device.patrimony,
                    device.group,
                    device.type,
                    device.status
                ]
                    .map(normalizeDeviceText)
                    .join(' ');

                return searchableValues.includes(searchTerm);
            });
        }

        function getDeviceIdentityLabel(device) {
            return [
                device.counter_number ? `Contador ${device.counter_number}` : '',
                device.patrimony ? `Patrimonio ${device.patrimony}` : '',
                device.serial_number ? `Serie ${device.serial_number}` : '',
                `ID ${device.id}`
            ].filter(Boolean).join(' - ');
        }

        function getOrganizationGroups() {
            const map = new Map();
            data.devices.forEach(device => {
                const groupName = (device.group || 'Sem agrupamento').trim();
                if (!map.has(groupName)) {
                    map.set(groupName, {
                        name: groupName,
                        total: 0,
                        available: 0,
                        inUse: 0,
                        types: new Set()
                    });
                }
                const item = map.get(groupName);
                item.total += 1;
                if (device.status === 'DisponÃ­vel') item.available += 1;
                if (device.status === 'Em uso') item.inUse += 1;
                item.types.add(device.type || 'Outros');
            });

            return [...map.values()]
                .map(item => ({ ...item, types: [...item.types].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
        }

        function getVisibleOrganizationDevices() {
            const selectedType = document.getElementById('organizationTypeFilter')?.value || '';
            const searchTerm = normalizeDeviceText(document.getElementById('organizationSearchInput')?.value || '');
            return sortDevicesForDisplay(data.devices).filter(device => {
                if (selectedType && normalizeDeviceText(device.type) !== normalizeDeviceText(selectedType)) return false;
                if (!searchTerm) return true;

                const searchableValues = [
                    device.id,
                    device.serial_number,
                    device.counter_number,
                    device.patrimony,
                    device.group,
                    device.type,
                    device.status
                ].map(normalizeDeviceText).join(' ');
                return searchableValues.includes(searchTerm);
            });
        }

        function setOrganizationGroup(groupName) {
            organizationActiveGroupName = (groupName || '').trim();
            organizationDraftGroupName = organizationActiveGroupName;
            const input = document.getElementById('organizationGroupName');
            if (input) input.value = organizationDraftGroupName;
            organizationSelectedDeviceIds = new Set(
                data.devices
                    .filter(device => normalizeDeviceText(device.group) === normalizeDeviceText(organizationActiveGroupName))
                    .map(device => parseInt(device.id))
            );
            updateOrganizationScreen();
        }

        function handleOrganizationGroupNameInput() {
            const value = document.getElementById('organizationGroupName')?.value || '';
            organizationDraftGroupName = value.trim();
            renderOrganizationGroups();
            renderOrganizationSummary();
        }

        function toggleOrganizationDevice(deviceId, checked) {
            const parsedId = parseInt(deviceId);
            if (checked) {
                organizationSelectedDeviceIds.add(parsedId);
            } else {
                organizationSelectedDeviceIds.delete(parsedId);
            }
            renderOrganizationSummary();
            const item = document.querySelector(`[data-organization-device-id="${parsedId}"]`);
            if (item) item.classList.toggle('selected', checked);
        }

        function selectVisibleOrganizationDevices(checked) {
            getVisibleOrganizationDevices().forEach(device => {
                const parsedId = parseInt(device.id);
                if (checked) {
                    organizationSelectedDeviceIds.add(parsedId);
                } else {
                    organizationSelectedDeviceIds.delete(parsedId);
                }
            });
            renderOrganizationDevices();
            renderOrganizationSummary();
        }

        function renderOrganizationGroups() {
            const container = document.getElementById('organizationGroupList');
            const count = document.getElementById('organizationGroupCount');
            if (!container) return;

            const groups = getOrganizationGroups();
            if (count) count.textContent = groups.length;

            if (!groups.length) {
                container.innerHTML = '<div class="admin-empty">Nenhum agrupamento encontrado.</div>';
                return;
            }

            const activeName = normalizeDeviceText(organizationActiveGroupName);
            container.innerHTML = groups.map(group => {
                const isActive = normalizeDeviceText(group.name) === activeName;
                return `
                    <button type="button" class="organization-group-button ${isActive ? 'active' : ''}" onclick="setOrganizationGroup(${escapeHtml(JSON.stringify(group.name))})">
                        <span class="organization-group-name">${escapeHtml(group.name)}</span>
                        <span class="organization-group-meta">
                            <span>${group.total} disp.</span>
                            <span>${group.available} disponiveis</span>
                            ${group.inUse ? `<span>${group.inUse} em uso</span>` : ''}
                        </span>
                        <span class="organization-group-meta">${escapeHtml(group.types.join(', '))}</span>
                    </button>
                `;
            }).join('');
        }

        function renderOrganizationSummary() {
            const container = document.getElementById('organizationSummary');
            if (!container) return;

            const groupName = (document.getElementById('organizationGroupName')?.value || organizationDraftGroupName || organizationActiveGroupName || '').trim();
            const selectedDevices = data.devices.filter(device => organizationSelectedDeviceIds.has(parseInt(device.id)));
            const selectedAvailable = selectedDevices.filter(device => device.status === 'DisponÃ­vel').length;
            const selectedByType = selectedDevices.reduce((acc, device) => {
                acc[device.type || 'Outros'] = (acc[device.type || 'Outros'] || 0) + 1;
                return acc;
            }, {});
            const typeText = Object.entries(selectedByType)
                .map(([type, total]) => `${total} ${type}`)
                .join(', ');

            container.innerHTML = `
                <span class="badge ${groupName ? 'blue' : 'gray'}">${groupName ? escapeHtml(groupName) : 'Informe um agrupamento'}</span>
                <span>${selectedDevices.length} dispositivo(s) selecionado(s)</span>
                <span>${selectedAvailable} disponivel(is) para emprestimo</span>
                ${typeText ? `<span>${escapeHtml(typeText)}</span>` : ''}
            `;
        }

        function renderOrganizationDevices() {
            const container = document.getElementById('organizationDeviceList');
            if (!container) return;

            const devices = getVisibleOrganizationDevices();
            if (!devices.length) {
                container.innerHTML = '<div class="admin-empty" style="grid-column: 1 / -1;">Nenhum dispositivo encontrado.</div>';
                renderOrganizationSummary();
                return;
            }

            container.innerHTML = devices.map(device => {
                const parsedId = parseInt(device.id);
                const checked = organizationSelectedDeviceIds.has(parsedId);
                const badgeColor = getDeviceStatusBadgeColor(device.status);
                return `
                    <label class="organization-device-item ${checked ? 'selected' : ''}" data-organization-device-id="${parsedId}">
                        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleOrganizationDevice(${parsedId}, this.checked)">
                        <span>
                            <span class="organization-device-title">
                                <i class="fas fa-${getDeviceIcon(device.type)}"></i>
                                ${escapeHtml(device.type || '-')}
                            </span>
                            <span class="organization-device-meta">
                                <span>${escapeHtml(getDeviceIdentityLabel(device))}</span>
                                <span>Atual: ${escapeHtml(device.group || '-')}</span>
                                <span><span class="badge ${badgeColor}">${escapeHtml(device.status || '-')}</span></span>
                            </span>
                        </span>
                    </label>
                `;
            }).join('');
            renderOrganizationSummary();
        }

        function updateOrganizationScreen() {
            const input = document.getElementById('organizationGroupName');
            if (!input) return;

            if (!organizationActiveGroupName) {
                const firstGroup = getOrganizationGroups()[0]?.name || '';
                if (firstGroup) {
                    organizationActiveGroupName = firstGroup;
                    organizationDraftGroupName = firstGroup;
                    input.value = organizationDraftGroupName;
                    organizationSelectedDeviceIds = new Set(
                        data.devices
                            .filter(device => normalizeDeviceText(device.group) === normalizeDeviceText(firstGroup))
                            .map(device => parseInt(device.id))
                    );
                }
            } else if (!input.value) {
                organizationDraftGroupName = organizationDraftGroupName || organizationActiveGroupName;
                input.value = organizationDraftGroupName;
            }

            renderOrganizationGroups();
            renderOrganizationDevices();
        }

        async function saveOrganizationGroup() {
            if (!requireDeviceAdminPermission()) return;

            const groupName = (document.getElementById('organizationGroupName')?.value || '').trim();
            if (!groupName) {
                alert('Informe o nome da base, anexo ou sala.');
                document.getElementById('organizationGroupName')?.focus();
                return;
            }

            const selectedIds = [...organizationSelectedDeviceIds];
            const activeGroupName = (organizationActiveGroupName || '').trim();
            if (!selectedIds.length && !activeGroupName) {
                alert('Selecione ao menos um dispositivo ou clique em uma base/sala para organizar.');
                return;
            }

            const selectedDevices = data.devices.filter(device => selectedIds.includes(parseInt(device.id)));
            const devicesInActiveGroup = activeGroupName
                ? data.devices.filter(device => normalizeDeviceText(device.group) === normalizeDeviceText(activeGroupName))
                : [];
            const selectedIdSet = new Set(selectedIds.map(id => parseInt(id)));
            const devicesToMoveIntoGroup = selectedDevices.filter(device => device.group !== groupName);
            const devicesToMoveOut = devicesInActiveGroup.filter(device =>
                !selectedIdSet.has(parseInt(device.id)) &&
                normalizeDeviceText(device.group) !== normalizeDeviceText('Fora')
            );
            const totalChanges = devicesToMoveIntoGroup.length + devicesToMoveOut.length;

            if (!totalChanges) {
                alert('Nenhuma alteracao para salvar nessa organizacao.');
                return;
            }

            try {
                if (devicesToMoveIntoGroup.length) {
                    const { error } = await client
                        .from('devices')
                        .update({ group: groupName })
                        .in('id', devicesToMoveIntoGroup.map(device => device.id));
                    if (error) throw error;
                }

                if (devicesToMoveOut.length) {
                    const { error } = await client
                        .from('devices')
                        .update({ group: 'Fora' })
                        .in('id', devicesToMoveOut.map(device => device.id));
                    if (error) throw error;
                }

                await Promise.all([
                    ...devicesToMoveIntoGroup.map(device =>
                        recordDeviceChangeEvent('updated', device, device, { ...device, group: groupName }, `Movido para ${groupName} pela organizacao`)
                    ),
                    ...devicesToMoveOut.map(device =>
                        recordDeviceChangeEvent('updated', device, device, { ...device, group: 'Fora' }, `Removido de ${activeGroupName} pela organizacao`)
                    )
                ]);

                organizationActiveGroupName = groupName;
                organizationDraftGroupName = groupName;
                organizationSelectedDeviceIds = new Set(selectedIds.map(id => parseInt(id)));
                const outMessage = devicesToMoveOut.length ? ` ${devicesToMoveOut.length} removido(s) para Fora.` : '';
                await showAppAlert(`${devicesToMoveIntoGroup.length} dispositivo(s) em ${groupName}.${outMessage}`, { type: 'success' });
                await loadData();
            } catch (error) {
                console.error('Erro ao salvar organizacao:', error);
                alert('Erro ao salvar organizacao: ' + error.message);
            }
        }

        async function renameOrganizationGroup() {
            if (!requireDeviceAdminPermission()) return;

            const oldGroupName = (organizationActiveGroupName || '').trim();
            if (!oldGroupName) {
                alert('Clique em uma base ou sala antes de renomear.');
                return;
            }

            const devicesInGroup = data.devices.filter(device => normalizeDeviceText(device.group) === normalizeDeviceText(oldGroupName));
            if (!devicesInGroup.length) {
                alert('Nenhum dispositivo encontrado nessa base ou sala.');
                return;
            }

            const currentInputValue = (document.getElementById('organizationGroupName')?.value || '').trim();
            const suggestedName = currentInputValue && normalizeDeviceText(currentInputValue) !== normalizeDeviceText(oldGroupName)
                ? currentInputValue
                : oldGroupName;
            const newGroupName = (prompt(`Novo nome para "${oldGroupName}":`, suggestedName) || '').trim();
            if (!newGroupName) return;

            if (newGroupName === oldGroupName) {
                alert('O novo nome e igual ao nome atual.');
                return;
            }

            const targetExists = data.devices.some(device =>
                normalizeDeviceText(device.group) === normalizeDeviceText(newGroupName) &&
                normalizeDeviceText(device.group) !== normalizeDeviceText(oldGroupName)
            );
            if (targetExists && !confirm(`Ja existe um agrupamento chamado "${newGroupName}". Deseja juntar os dispositivos de "${oldGroupName}" nele?`)) {
                return;
            }

            try {
                const { error } = await client
                    .from('devices')
                    .update({ group: newGroupName })
                    .eq('group', oldGroupName);
                if (error) throw error;

                await Promise.all(devicesInGroup.map(device =>
                    recordDeviceChangeEvent('updated', device, device, { ...device, group: newGroupName }, `Agrupamento renomeado de ${oldGroupName} para ${newGroupName}`)
                ));

                organizationActiveGroupName = newGroupName;
                organizationDraftGroupName = newGroupName;
                organizationSelectedDeviceIds = new Set(devicesInGroup.map(device => parseInt(device.id)));
                const input = document.getElementById('organizationGroupName');
                if (input) input.value = newGroupName;
                await showAppAlert(`"${oldGroupName}" foi renomeado para "${newGroupName}".`, { type: 'success' });
                await loadData();
            } catch (error) {
                console.error('Erro ao renomear agrupamento:', error);
                alert('Erro ao renomear base/sala: ' + error.message);
            }
        }

        function applyDeviceFilters() {
            updateDevicesTable();
            updateDevicesCards();
        }

        function clearDeviceFilters() {
            const searchInput = document.getElementById('deviceSearchInput');
            const typeFilter = document.getElementById('deviceTypeFilter');
            if (searchInput) searchInput.value = '';
            if (typeFilter) typeFilter.value = '';
            deviceStatusFilter = '';
            applyDeviceFilters();
        }

        function openDevicesByStatus(status) {
            const searchInput = document.getElementById('deviceSearchInput');
            const typeFilter = document.getElementById('deviceTypeFilter');
            if (searchInput) searchInput.value = '';
            if (typeFilter) typeFilter.value = '';
            deviceStatusFilter = status || '';
            showScreen('devices');
            applyDeviceFilters();
        }
