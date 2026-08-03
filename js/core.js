// core.js - application script.
// ------------------------------
        // 1. Configuração do Supabase
        // ------------------------------
        const APP_CONFIG = window.APP_CONFIG || {};
        const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || "";
        const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || "";

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.warn('Configuração do Supabase ausente. Verifique o arquivo config.js.');
        }

        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ------------------------------
        // 2. Estado do Sistema
        // ------------------------------
        let data = {
            classes: [],
            teachers: [],
            devices: [],
            loans: [],
            loanDevices: [],
            deviceMaintenanceHistory: [],
            deviceChangeHistory: [],
            userProfiles: [],
            adminNoticeTodos: [],
            adminPrintFiles: [],
            weeklyReservations: []
        };
        let currentLoanType = 'quantity';
        let pendingSpecificLoanDeviceId = null;
        let currentUser = null;
        let isQuickAccess = false;
        let currentUserProfile = null;
        let currentAccessRole = 'Funcionário';
        let appAlertResolver = null;
        let appAlertReturnFocus = null;
        let deviceSchemaReady = null;
        let deviceLabelSchemaReady = null;
        let loadDataInProgress = false;
        let loadDataQueued = false;
        let loadDataRefreshTimer = null;
        let secondaryDataLoadPromise = null;
        let devicesRealtimeChannel = null;
        let activeScannerField = null;
        let scannerStream = null;
        let scannerInterval = null;
        let scannerDetector = null;
        let scannerLastValue = '';
        let deviceStatusFilter = '';
        let selectedDeviceId = null;
        let selectedLabelDeviceIds = new Set();
        let organizationSelectedDeviceIds = new Set();
        let organizationActiveGroupName = '';
        let organizationDraftGroupName = '';
        let mobileDeviceCardLimit = 10;
        let mobileHistoryCardLimit = 10;
        let mobileActiveLoanCardLimit = 10;
        let mobileMaintenanceCardLimit = 10;
        let mobileOrganizationDeviceLimit = 12;
        let mobileInventoryLocationLimit = 6;
        let pendingDeviceDetailId = null;
        let reservationReminderQueue = [];
        let activeReservationReminder = null;
        const reservationLoanRegistrationsInProgress = new Set();
        let loanDurationReminderQueue = [];
        let activeLoanDurationReminder = null;
        const DEVICE_MAINTENANCE_HISTORY_KEY = 'deviceMaintenanceHistory';
        const ADMIN_NOTICE_TODO_KEY = 'adminNoticeTodoItems';
        const ADMIN_PRINT_FILES_KEY = 'adminPrintFiles';
        const LABEL_SIZE_KEY = 'patrimonyLabelSize';
        const ADMIN_PRINT_FILE_MAX_BYTES = 4 * 1024 * 1024;
        const RESERVATION_REMINDER_STORAGE_KEY = 'weeklyReservationRemindersSeen';
        const LOAN_DURATION_REMINDER_STORAGE_KEY = 'loanDurationRemindersSeen';
        const APP_DATA_CACHE_KEY = 'controleDispositivosFastCache';
        const APP_DATA_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
        let adminNoticeTodoTab = 'todo';
        let adminNoticeTodoRemoteAvailable = null;
        let adminPrintFilesRemoteAvailable = null;
        let lastAutoCounterSuggestion = '';

        function inferAlertType(message) {
            const text = (message || '').toLowerCase();
            if (text.includes('erro')) return 'error';
            if (text.includes('sucesso') || text.includes('criado') || text.includes('atualizado') || text.includes('removido') || text.includes('registrado')) return 'success';
            if (text.includes('aten') || text.includes('preencha') || text.includes('nã') || text.includes('nao')) return 'warning';
            return 'info';
        }

        function getAlertIcon(type) {
            return {
                success: 'fas fa-circle-check',
                error: 'fas fa-triangle-exclamation',
                warning: 'fas fa-circle-exclamation',
                info: 'fas fa-circle-info'
            }[type] || 'fas fa-circle-info';
        }

        function getAlertTitle(type) {
            return {
                success: 'Tudo certo',
                error: 'Algo deu errado',
                warning: 'Atenção',
                info: 'Aviso'
            }[type] || 'Aviso';
        }

        function closeAppAlert() {
            const overlay = document.getElementById('appAlertOverlay');
            const activeElement = document.activeElement;

            if (activeElement && overlay.contains(activeElement)) {
                activeElement.blur();
            }

            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('alert-open');

            if (appAlertResolver) {
                const resolve = appAlertResolver;
                appAlertResolver = null;
                resolve();
            }

            if (appAlertReturnFocus && typeof appAlertReturnFocus.focus === 'function') {
                appAlertReturnFocus.focus();
            }
            appAlertReturnFocus = null;
            setTimeout(showNextLongRunningLoanReminder, 200);
            setTimeout(showNextReservationReminder, 200);
        }

        function showAppAlert(message, options = {}) {
            const type = options.type || inferAlertType(message);
            const title = options.title || getAlertTitle(type);
            const overlay = document.getElementById('appAlertOverlay');
            const box = document.getElementById('appAlertBox');
            const icon = document.getElementById('appAlertIcon');
            const titleNode = document.getElementById('appAlertTitle');
            const messageNode = document.getElementById('appAlertMessage');

            box.className = `app-alert ${type}`;
            icon.innerHTML = `<i class="${getAlertIcon(type)}"></i>`;
            titleNode.textContent = title;
            messageNode.textContent = message;
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('alert-open');
            appAlertReturnFocus = document.activeElement;
            document.getElementById('appAlertOk').focus();

            return new Promise(resolve => {
                appAlertResolver = resolve;
            });
        }

        window.alert = (message) => {
            showAppAlert(message);
        };

        document.getElementById('appAlertOk').addEventListener('click', closeAppAlert);
        document.getElementById('appAlertOverlay').addEventListener('click', (event) => {
            if (event.target.id === 'appAlertOverlay') {
                closeAppAlert();
            }
        });
        document.getElementById('scannerModal').addEventListener('click', (event) => {
            if (event.target.id === 'scannerModal') {
                closeScanner();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeSidebar();
                if (document.getElementById('scannerModal').classList.contains('active')) {
                    closeScanner();
                }
            }
        });

        // ------------------------------
        // Modo Escuro
        // ------------------------------
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            updateDarkModeIcon(isDark);
        }

        function updateDarkModeIcon(isDark) {
            const icon = document.getElementById('darkModeIcon');
            if (isDark) {
                icon.className = 'fas fa-sun';
            } else {
                icon.className = 'fas fa-moon';
            }
        }

        function loadDarkModePreference() {
            const saved = localStorage.getItem('darkMode');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            if (saved === 'true' || (!saved && prefersDark)) {
                document.body.classList.add('dark-mode');
                updateDarkModeIcon(true);
            } else {
                document.body.classList.remove('dark-mode');
                updateDarkModeIcon(false);
            }
        }

        // ------------------------------
        // 3. Inicialização
        // ------------------------------
        document.addEventListener('DOMContentLoaded', async () => {
            loadDarkModePreference();
            document.addEventListener('click', handleUserMenuOutsideClick);
            document.addEventListener('keydown', handleUserMenuKeydown);
            window.addEventListener('resize', closeUserMenu);
            pendingDeviceDetailId = getRequestedDeviceIdFromUrl();
            ensureDeviceLabelFields();
            const reportUsageDate = document.getElementById('reportUsageDate');
            if (reportUsageDate && !reportUsageDate.value) {
                reportUsageDate.value = new Date().toISOString().split('T')[0];
            }
            setupDevicesRealtime();
            await checkAuth();
            setupLoginForms();
            window.setInterval(() => {
                if (!currentUser) return;
                updateLoanDeadlineAlerts();
                updateActiveLoans();
                checkScheduledReservationNotifications();
                checkLongRunningLoanNotifications();
            }, 30000);

            // Registrar Service Worker para PWA
            if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('./service-worker.js');
                    console.log('Service Worker registrado com sucesso!');
                } catch (error) {
                    console.log('Erro ao registrar Service Worker:', error);
                }
            }
        });

        // ------------------------------
        // 4. Autenticação
        // ------------------------------
        function showLogin() {
            closeUserMenu();
            closeUserProfileDialog();
            document.getElementById('loginContainer').classList.remove('hidden');
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('mobileMenuToggle').classList.add('hidden');
            document.body.classList.remove('sidebar-open');
        }

        function setQuickAccessRole(role) {
            document.getElementById('quickAccessRole').value = role;
            document.querySelectorAll('#quickAccessRoleChoices .choice-button').forEach(button => {
                button.classList.toggle('active', button.dataset.role === role);
            });
        }

        function normalizeRole(role) {
            return (role || '')
                .toString()
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        }

        function isAlunoAccess() {
            return normalizeRole(currentAccessRole).includes('aluno');
        }

        function isAdminAccess() {
            const role = normalizeRole(currentAccessRole);
            return role === 'admin' || role === 'adm' || role === 'administrador';
        }

        function isFuncionarioAccess() {
            return normalizeRole(currentAccessRole).includes('funcion');
        }

        function canManageDevices() {
            return isAdminAccess();
        }

        function canManageWeeklyReservations() {
            return !isQuickAccess && (isAdminAccess() || isFuncionarioAccess());
        }

        function getRoleLabel(role = currentAccessRole) {
            const normalized = normalizeRole(role);
            if (normalized.includes('aluno')) return 'Aluno';
            if (normalized === 'admin' || normalized === 'adm' || normalized === 'administrador') return 'Administrador';
            return 'Funcionário';
        }

        function requireDeviceAdminPermission() {
            if (canManageDevices()) return true;
            alert('Apenas administradores podem adicionar, editar, apagar ou colocar dispositivos em manutenção.');
            return false;
        }

        async function getSupabaseUserProfile(user) {
            if (!user?.id) return null;

            try {
                const { data: profileById, error: errorById } = await client
                    .from('user_profiles')
                    .select('id, email, name, role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!errorById && profileById) {
                    return profileById;
                }

                const { data: profileByEmail, error: errorByEmail } = await client
                    .from('user_profiles')
                    .select('id, email, name, role')
                    .eq('email', user.email)
                    .maybeSingle();

                if (!errorByEmail && profileByEmail) {
                    return profileByEmail;
                }
            } catch (error) {
                console.warn('Não foi possível carregar perfil do usuário:', error);
            }

            return null;
        }

        function applyRoleRestrictions() {
            document.body.classList.toggle('student-access', isAlunoAccess());
            const hiddenForAluno = ['history', 'active', 'schedules', 'maintenance', 'devices', 'inventory', 'organization', 'classes', 'teachers'];
            hiddenForAluno.forEach(screenId => {
                const navItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
                if (navItem) {
                    navItem.style.display = isAlunoAccess() ? 'none' : '';
                }
            });

            document.getElementById('dashboardInUseCard').style.display = isAlunoAccess() ? 'none' : '';
            document.getElementById('dashboardAlertCard').style.display = isAlunoAccess() ? 'none' : '';
            document.getElementById('latestLoansCard').style.display = isAlunoAccess() ? 'none' : '';
            document.getElementById('dashboardActionsCard').style.display = '';
            const dashboardStatsGrid = document.getElementById('dashboardStatsGrid');
            if (dashboardStatsGrid) {
                dashboardStatsGrid.style.display = isAlunoAccess() ? 'none' : '';
            }

            const dashboardQuickActions = document.querySelectorAll('#dashboardActionsCard .quick-action');
            dashboardQuickActions.forEach((action, index) => {
                action.style.display = isAlunoAccess() && index === 2 ? 'none' : '';
            });

            const historyButtons = document.querySelectorAll('[onclick*="showScreen(\'history\')"]');
            historyButtons.forEach(button => {
                button.style.display = isAlunoAccess() ? 'none' : '';
            });

            document.querySelectorAll('[data-admin-only="true"]').forEach(element => {
                element.style.display = canManageDevices() ? '' : 'none';
            });

            document.querySelectorAll('[data-not-student="true"]').forEach(element => {
                element.style.display = isAlunoAccess() ? 'none' : '';
            });

            document.querySelectorAll('button[onclick*="openDeviceModal"], button[onclick*="editDevice"], button[onclick*="toggleMaintenance"], button[onclick*="deleteDevice"]').forEach(button => {
                button.style.display = canManageDevices() ? '' : 'none';
            });
        }

        function setupLoginForms() {
            // Elementos
            const loginToggle = document.getElementById('loginToggle');
            const quickAccessToggle = document.getElementById('quickAccessToggle');
            const backToLoginToggle = document.getElementById('backToLoginToggle');
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            const quickAccessForm = document.getElementById('quickAccessForm');

            // Função para resetar o estado dos formulários
            function showLoginForm() {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                quickAccessForm.classList.add('hidden');
                loginToggle.classList.remove('hidden');
                quickAccessToggle.classList.remove('hidden');
                backToLoginToggle.classList.add('hidden');
                loginToggle.innerHTML = 'Não tem conta? <strong>Criar conta</strong>';
                setQuickAccessRole('');
            }

            function showRegisterForm() {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
                quickAccessForm.classList.add('hidden');
                loginToggle.classList.remove('hidden');
                quickAccessToggle.classList.add('hidden');
                backToLoginToggle.classList.remove('hidden');
                loginToggle.innerHTML = 'Já tem conta? <strong>Entrar</strong>';
            }

            function showQuickAccessForm() {
                loginForm.classList.add('hidden');
                registerForm.classList.add('hidden');
                quickAccessForm.classList.remove('hidden');
                loginToggle.classList.add('hidden');
                quickAccessToggle.classList.add('hidden');
                backToLoginToggle.classList.remove('hidden');
                if (!document.getElementById('quickAccessRole').value) {
                    setQuickAccessRole('Aluno');
                }
            }

            // Event listeners
            loginToggle.addEventListener('click', () => {
                if (loginForm.classList.contains('hidden')) {
                    showLoginForm();
                } else {
                    showRegisterForm();
                }
            });

            quickAccessToggle.addEventListener('click', showQuickAccessForm);
            backToLoginToggle.addEventListener('click', showLoginForm);

            // Login
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;

                try {
                    const { error } = await client.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    await checkAuth();
                } catch (error) {
                    alert('Erro ao entrar: ' + error.message);
                }
            });

            // Cadastro
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('registerName').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;

                try {
                    const { data: signUpData, error } = await client.auth.signUp({ 
                        email, 
                        password,
                        options: {
                            data: { name }
                        }
                    });
                    if (error) throw error;
                    if (signUpData?.user?.id) {
                        const { error: profileError } = await client.from('user_profiles').upsert({
                            id: signUpData.user.id,
                            email,
                            name,
                            role: 'funcionario'
                        });
                        if (profileError) {
                            console.warn('Perfil de acesso não foi criado automaticamente:', profileError);
                        }
                    }
                    alert('Conta criada com sucesso! Verifique seu email para confirmar o cadastro.');
                } catch (error) {
                    alert('Erro ao criar conta: ' + error.message);
                }
            });

            // Acesso Rápido
            quickAccessForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('quickAccessName').value;
                const role = document.getElementById('quickAccessRole').value;

                if (!name || !role) {
                    alert('Por favor, preencha todos os campos!');
                    return;
                }

                // Salvar no localStorage
                localStorage.setItem('quickAccessUser', JSON.stringify({ name, role }));
                isQuickAccess = true;
                currentUser = { name, role, email: '' }; // Simulação de usuário
                currentUserProfile = null;
                currentAccessRole = role;
                showApp();
                await loadData();
            });
        }

        async function logout() {
            try {
                closeUserMenu();
                closeUserProfileDialog();
                // Se for acesso rápido, só limpar o localStorage
                if (isQuickAccess) {
                    localStorage.removeItem('quickAccessUser');
                    isQuickAccess = false;
                    currentUser = null;
                    currentUserProfile = null;
                    currentAccessRole = 'Funcionário';
                    showLogin();
                } else {
                    await client.auth.signOut();
                    currentUser = null;
                    currentUserProfile = null;
                    currentAccessRole = 'Funcionário';
                    showLogin();
                }
            } catch (error) {
                alert('Erro ao sair: ' + error.message);
            }
        }

        // Atualiza checkAuth para verificar também o quickAccess
        async function checkAuth() {
            // Primeiro verifica se há usuário de acesso rápido
            const savedQuickAccess = localStorage.getItem('quickAccessUser');
            if (savedQuickAccess) {
                const quickUser = JSON.parse(savedQuickAccess);
                isQuickAccess = true;
                currentUser = quickUser;
                currentUserProfile = null;
                currentAccessRole = quickUser.role || 'Funcionário';
                showApp();
                await loadData();
                return;
            }

            // Depois verifica o Supabase auth
            const { data: { user } } = await client.auth.getUser();
            if (user) {
                currentUser = user;
                isQuickAccess = false;
                currentUserProfile = await getSupabaseUserProfile(user);
                currentAccessRole = currentUserProfile?.role || user.user_metadata?.role || 'funcionario';
                showApp();
                await loadData();
            } else if (pendingDeviceDetailId) {
                isQuickAccess = true;
                currentUser = { name: 'Consulta por QR Code', role: 'Aluno', email: '' };
                currentUserProfile = null;
                currentAccessRole = 'Aluno';
                showApp();
                await loadData();
            } else {
                showLogin();
            }
        }

        // Atualiza o showApp para exibir corretamente as informações do usuário
        function showApp() {
            document.getElementById('loginContainer').classList.add('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
            document.getElementById('mobileMenuToggle').classList.remove('hidden');
            
            // Atualiza informações do usuário
            if (currentUser) {
                if (isQuickAccess) {
                    // Acesso rápido
                    document.getElementById('userName').textContent = currentUser.name;
                    document.getElementById('userEmail').textContent = currentUser.role;
                } else {
                    // Usuário do Supabase
                    const email = currentUser.email || 'email@exemplo.com';
                    const name = currentUserProfile?.name || currentUser.user_metadata?.name || email.split('@')[0];
                    document.getElementById('userName').textContent = name;
                    document.getElementById('userEmail').textContent = `${getRoleLabel()} - ${email}`;
                }

                const displayName = document.getElementById('userName').textContent || 'Usuário';
                const displayRole = getRoleLabel();
                const initials = displayName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(part => part.charAt(0).toUpperCase())
                    .join('') || 'U';
                const topUserName = document.getElementById('topUserName');
                const topUserRole = document.getElementById('topUserRole');
                const topUserAvatar = document.getElementById('topUserAvatar');
                const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
                const mobileUserAvatar = document.getElementById('mobileUserAvatar');
                const mobileDashboardGreeting = document.getElementById('mobileDashboardGreeting');
                const dashboardWelcome = document.getElementById('dashboardWelcome');
                if (topUserName) topUserName.textContent = displayName;
                if (topUserRole) topUserRole.textContent = displayRole;
                if (topUserAvatar) topUserAvatar.textContent = initials;
                if (sidebarUserAvatar) sidebarUserAvatar.textContent = initials;
                if (mobileUserAvatar) mobileUserAvatar.textContent = initials;
                if (dashboardWelcome) {
                    const firstName = displayName.split(/\s+/).filter(Boolean)[0] || displayName;
                    dashboardWelcome.textContent =
                        `Olá, ${firstName}! Veja o resumo do controle de dispositivos da escola.`;
                    if (mobileDashboardGreeting) {
                        mobileDashboardGreeting.textContent = `Olá, ${firstName}! 👋`;
                    }
                }
            }

            applyRoleRestrictions();
            showScreen(isAlunoAccess() ? 'loan' : 'dashboard');
        }

        function toggleSidebar() {
            document.body.classList.toggle('sidebar-open');
        }

        function closeSidebar() {
            document.body.classList.remove('sidebar-open');
        }

        function getCurrentUserMenuData() {
            const name = document.getElementById('topUserName')?.textContent
                || document.getElementById('userName')?.textContent
                || 'Usuário';
            const role = document.getElementById('topUserRole')?.textContent || getRoleLabel();
            const email = isQuickAccess
                ? 'Acesso rápido'
                : (currentUser?.email || currentUserProfile?.email || 'Acesso ao sistema');
            const initials = document.getElementById('topUserAvatar')?.textContent
                || name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
                || 'U';
            return { name, role, email, initials };
        }

        function syncUserAccountMenu() {
            const account = getCurrentUserMenuData();
            const values = {
                accountMenuAvatar: account.initials,
                accountMenuName: account.name,
                accountMenuRole: account.role,
                accountMenuEmail: account.email,
                profileModalAvatar: account.initials,
                profileModalName: account.name,
                profileModalRole: account.role,
                profileModalEmail: account.email,
                profileModalPermission: account.role
            };
            Object.entries(values).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });

            const darkMode = document.body.classList.contains('dark-mode');
            const themeLabel = document.getElementById('accountMenuThemeLabel');
            const themeIcon = document.getElementById('accountMenuThemeIcon');
            if (themeLabel) themeLabel.textContent = darkMode ? 'Modo claro' : 'Modo escuro';
            if (themeIcon) themeIcon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
        }

        function setUserMenuTriggersExpanded(expanded, activeTrigger = null) {
            ['topbarUserMenuTrigger', 'sidebarUserMenuTrigger'].forEach(id => {
                const trigger = document.getElementById(id);
                if (trigger) trigger.setAttribute('aria-expanded', String(expanded && trigger === activeTrigger));
            });
        }

        function positionUserMenu(trigger, source) {
            const menu = document.getElementById('userAccountMenu');
            if (!menu || !trigger) return;
            const rect = trigger.getBoundingClientRect();
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            const viewportGap = 12;
            let left;
            let top;

            if (source === 'sidebar') {
                const fitsToRight = rect.right + menuWidth + 10 <= window.innerWidth;
                left = fitsToRight ? rect.right + 8 : Math.max(viewportGap, Math.min(rect.left, window.innerWidth - menuWidth - viewportGap));
                top = Math.max(viewportGap, Math.min(rect.bottom - menuHeight, window.innerHeight - menuHeight - viewportGap));
            } else {
                left = Math.max(viewportGap, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportGap));
                top = rect.bottom + 9;
                if (top + menuHeight > window.innerHeight - viewportGap) {
                    top = Math.max(viewportGap, rect.top - menuHeight - 9);
                }
            }

            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;

            let correctedLeft = parseFloat(menu.style.left) || 0;
            let correctedTop = parseFloat(menu.style.top) || 0;
            for (let attempt = 0; attempt < 4; attempt++) {
                const renderedRect = menu.getBoundingClientRect();
                if (renderedRect.left < viewportGap) correctedLeft += viewportGap - renderedRect.left;
                if (renderedRect.right > window.innerWidth - viewportGap) correctedLeft -= renderedRect.right - (window.innerWidth - viewportGap);
                if (renderedRect.top < viewportGap) correctedTop += viewportGap - renderedRect.top;
                if (renderedRect.bottom > window.innerHeight - viewportGap) correctedTop -= renderedRect.bottom - (window.innerHeight - viewportGap);
                menu.style.left = `${correctedLeft}px`;
                menu.style.top = `${correctedTop}px`;
            }
        }

        function toggleUserMenu(event, source = 'topbar') {
            event?.preventDefault();
            event?.stopPropagation();
            const menu = document.getElementById('userAccountMenu');
            const trigger = event?.currentTarget;
            if (!menu || !trigger) return;

            const isOpenFromThisTrigger =
                !menu.classList.contains('hidden') &&
                menu.dataset.source === source;
            if (isOpenFromThisTrigger) {
                closeUserMenu();
                return;
            }

            syncUserAccountMenu();
            menu.dataset.source = source;
            menu.classList.remove('hidden');
            menu.setAttribute('aria-hidden', 'false');
            setUserMenuTriggersExpanded(true, trigger);
            positionUserMenu(trigger, source);
            menu.querySelector('button')?.focus({ preventScroll: true });
        }

        function closeUserMenu() {
            const menu = document.getElementById('userAccountMenu');
            if (!menu) return;
            menu.classList.add('hidden');
            menu.setAttribute('aria-hidden', 'true');
            menu.removeAttribute('data-source');
            setUserMenuTriggersExpanded(false);
        }

        function handleUserMenuOutsideClick(event) {
            const menu = document.getElementById('userAccountMenu');
            if (!menu || menu.classList.contains('hidden')) return;
            if (menu.contains(event.target) || event.target.closest?.('#topbarUserMenuTrigger, #sidebarUserMenuTrigger')) return;
            closeUserMenu();
        }

        function handleUserMenuKeydown(event) {
            if (event.key !== 'Escape') return;
            const profileModal = document.getElementById('userProfileModal');
            if (profileModal?.classList.contains('active')) {
                closeUserProfileDialog();
                return;
            }
            closeUserMenu();
        }

        function openUserProfileDialog() {
            syncUserAccountMenu();
            closeUserMenu();
            const modal = document.getElementById('userProfileModal');
            if (!modal) return;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            modal.querySelector('.user-profile-close')?.focus({ preventScroll: true });
        }

        function closeUserProfileDialog() {
            const modal = document.getElementById('userProfileModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }

        function handleUserProfileOverlayClick(event) {
            if (event.target?.id === 'userProfileModal') {
                closeUserProfileDialog();
            }
        }

        function openDashboardFromUserMenu() {
            closeUserMenu();
            closeSidebar();
            showScreen('dashboard');
        }

        function toggleUserMenuTheme() {
            toggleDarkMode();
            syncUserAccountMenu();
        }

        function refreshFromUserMenu() {
            closeUserMenu();
            forceRefreshApp();
        }

        function logoutFromUserMenu() {
            closeUserMenu();
            logout();
        }

        async function forceRefreshApp() {
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((registration) => registration.update()));
                }

                window.location.reload();
            } catch (error) {
                console.error('Erro ao atualizar app:', error);
                window.location.reload();
            }
        }
