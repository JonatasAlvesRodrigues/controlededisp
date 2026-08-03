// database.js - application script.
function scheduleDataReload(delay = 250) {
            if (loadDataRefreshTimer) {
                clearTimeout(loadDataRefreshTimer);
            }

            loadDataRefreshTimer = setTimeout(() => {
                loadDataRefreshTimer = null;
                loadData();
            }, delay);
        }

        function setupDevicesRealtime() {
            if (devicesRealtimeChannel || !client?.channel) return;

            devicesRealtimeChannel = client
                .channel('devices-auto-refresh')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'devices' },
                    () => {
                        scheduleDataReload(200);
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'weekly_reservations' },
                    () => {
                        scheduleDataReload(200);
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'loans' },
                    () => {
                        scheduleDataReload(200);
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'loan_devices' },
                    () => {
                        scheduleDataReload(200);
                    }
                )
                .subscribe();

            window.addEventListener('focus', () => scheduleDataReload(150));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    scheduleDataReload(150);
                }
            });
        }

// ------------------------------
        // 5. Carregamento de Dados
        // ------------------------------
        async function fetchOptionalTable(tableName, select = '*', options = {}) {
            try {
                let query = client.from(tableName).select(select);
                if (options.orderBy) {
                    query = query.order(options.orderBy, { ascending: options.ascending ?? false });
                }
                const { data: tableData, error } = await query;
                if (error) {
                    console.warn(`Tabela opcional indisponível (${tableName}):`, error.message);
                    return [];
                }
                return tableData || [];
            } catch (error) {
                console.warn(`Tabela opcional indisponível (${tableName}):`, error);
                return [];
            }
        }

        function getLocalAdminNoticeTodoItems() {
            try {
                const parsed = JSON.parse(localStorage.getItem(ADMIN_NOTICE_TODO_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function getLocalAdminPrintFiles() {
            try {
                const parsed = JSON.parse(localStorage.getItem(ADMIN_PRINT_FILES_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        async function fetchAdminNoticeTodoItems() {
            if (!canManageDevices()) return [];

            try {
                const { data: items, error } = await client
                    .from('admin_notice_todos')
                    .select('id, type, text, priority, due_date, done, created_by, created_at, done_at')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                adminNoticeTodoRemoteAvailable = true;
                const localItems = getLocalAdminNoticeTodoItems();
                if (localItems.length) {
                    const rows = localItems.map(item => ({
                        type: item.type === 'notice' ? 'notice' : 'todo',
                        text: item.text,
                        priority: item.priority || 'normal',
                        due_date: item.due_date || null,
                        done: Boolean(item.done),
                        created_by: item.created_by || getCurrentActorName(),
                        created_at: item.created_at || new Date().toISOString(),
                        done_at: item.done_at || null
                    })).filter(item => item.text);

                    if (rows.length) {
                        const { data: migratedItems, error: migrateError } = await client
                            .from('admin_notice_todos')
                            .insert(rows)
                            .select('id, type, text, priority, due_date, done, created_by, created_at, done_at');
                        if (!migrateError) {
                            localStorage.removeItem(ADMIN_NOTICE_TODO_KEY);
                            return [...(migratedItems || []), ...(items || [])]
                                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                        }
                        console.warn('Nao foi possivel migrar avisos/afazeres locais:', migrateError.message || migrateError);
                    }
                }
                return items || [];
            } catch (error) {
                adminNoticeTodoRemoteAvailable = false;
                console.warn('Tabela de avisos/afazeres indisponivel, usando armazenamento local:', error.message || error);
                return getLocalAdminNoticeTodoItems();
            }
        }

        async function fetchAdminPrintFiles() {
            if (!canManageDevices()) return [];

            try {
                const { data: files, error } = await client
                    .from('admin_print_files')
                    .select('id, title, file_name, mime_type, file_size, file_data, notes, created_by, created_at')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                adminPrintFilesRemoteAvailable = true;

                const localFiles = getLocalAdminPrintFiles();
                if (localFiles.length) {
                    const rows = localFiles.map(file => ({
                        title: file.title || file.file_name || 'Arquivo para impressao',
                        file_name: file.file_name,
                        mime_type: file.mime_type || 'application/octet-stream',
                        file_size: file.file_size || 0,
                        file_data: file.file_data,
                        notes: file.notes || null,
                        created_by: file.created_by || getCurrentActorName(),
                        created_at: file.created_at || new Date().toISOString()
                    })).filter(file => file.file_name && file.file_data);

                    if (rows.length) {
                        const { data: migratedFiles, error: migrateError } = await client
                            .from('admin_print_files')
                            .insert(rows)
                            .select('id, title, file_name, mime_type, file_size, file_data, notes, created_by, created_at');
                        if (!migrateError) {
                            localStorage.removeItem(ADMIN_PRINT_FILES_KEY);
                            return [...(migratedFiles || []), ...(files || [])]
                                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                        }
                        console.warn('Nao foi possivel migrar impressos locais:', migrateError.message || migrateError);
                    }
                }

                return files || [];
            } catch (error) {
                adminPrintFilesRemoteAvailable = false;
                console.warn('Tabela de impressos indisponivel, usando armazenamento local:', error.message || error);
                return getLocalAdminPrintFiles();
            }
        }

        function saveFastDataCache() {
            try {
                localStorage.setItem(APP_DATA_CACHE_KEY, JSON.stringify({
                    savedAt: Date.now(),
                    classes: data.classes || [],
                    teachers: data.teachers || [],
                    devices: data.devices || [],
                    loans: data.loans || [],
                    loanDevices: data.loanDevices || [],
                    weeklyReservations: data.weeklyReservations || []
                }));
            } catch (error) {
                console.warn('Nao foi possivel salvar o cache rapido:', error);
            }
        }

        function hydrateFastDataCache() {
            if (data.devices.length || data.loans.length) return false;
            try {
                const cached = JSON.parse(localStorage.getItem(APP_DATA_CACHE_KEY) || 'null');
                if (!cached?.savedAt || Date.now() - cached.savedAt > APP_DATA_CACHE_MAX_AGE) {
                    localStorage.removeItem(APP_DATA_CACHE_KEY);
                    return false;
                }

                data = {
                    ...data,
                    classes: Array.isArray(cached.classes) ? cached.classes : [],
                    teachers: Array.isArray(cached.teachers) ? cached.teachers : [],
                    devices: Array.isArray(cached.devices) ? cached.devices : [],
                    loans: Array.isArray(cached.loans) ? cached.loans : [],
                    loanDevices: Array.isArray(cached.loanDevices) ? cached.loanDevices : [],
                    weeklyReservations: Array.isArray(cached.weeklyReservations) ? cached.weeklyReservations : []
                };
                updateAll();
                return true;
            } catch (error) {
                localStorage.removeItem(APP_DATA_CACHE_KEY);
                return false;
            }
        }

        function loadSecondaryDataInBackground() {
            if (secondaryDataLoadPromise) return secondaryDataLoadPromise;

            secondaryDataLoadPromise = Promise.all([
                client
                    .from('device_maintenance_history')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .then(({ data: history, error }) => {
                        if (error) {
                            console.warn('Historico de manutencao indisponivel:', error.message);
                            return data.deviceMaintenanceHistory || [];
                        }
                        return history || [];
                    }),
                fetchOptionalTable('device_change_history', '*', { orderBy: 'created_at' }),
                canManageDevices()
                    ? fetchOptionalTable('user_profiles', 'id, email, name, role, created_at, updated_at', { orderBy: 'created_at', ascending: true })
                    : Promise.resolve([]),
                canManageDevices() ? fetchAdminNoticeTodoItems() : Promise.resolve([]),
                canManageDevices() ? fetchAdminPrintFiles() : Promise.resolve([])
            ]).then(([
                deviceMaintenanceHistory,
                deviceChangeHistory,
                userProfiles,
                adminNoticeTodos,
                adminPrintFiles
            ]) => {
                data = {
                    ...data,
                    deviceMaintenanceHistory,
                    deviceChangeHistory,
                    userProfiles,
                    adminNoticeTodos,
                    adminPrintFiles
                };
                const activeScreenId = document.querySelector('.screen.active')?.id;
                if (activeScreenId) refreshScreenView(activeScreenId);
            }).catch(error => {
                console.warn('Dados secundarios nao puderam ser carregados:', error);
            }).finally(() => {
                secondaryDataLoadPromise = null;
            });

            return secondaryDataLoadPromise;
        }

        async function loadData() {
            if (loadDataInProgress) {
                loadDataQueued = true;
                return;
            }

            loadDataInProgress = true;
            hydrateFastDataCache();
            try {
                const [
                    classesResult,
                    teachersResult,
                    devicesResult,
                    loansResult,
                    loanDevicesResult,
                    weeklyReservations
                ] = await Promise.all([
                    client.from('classes').select('*'),
                    client.from('teachers').select('*'),
                    client.from('devices').select('*'),
                    client.from('loans').select('*'),
                    client.from('loan_devices').select('*'),
                    fetchOptionalTable('weekly_reservations', '*', { orderBy: 'start_time', ascending: true })
                ]);

                const requiredResults = [
                    ['turmas', classesResult],
                    ['professores', teachersResult],
                    ['dispositivos', devicesResult],
                    ['emprestimos', loansResult],
                    ['vinculos de dispositivos', loanDevicesResult]
                ];
                const failedResult = requiredResults.find(([, result]) => result.error);
                if (failedResult) {
                    throw new Error(`Falha ao carregar ${failedResult[0]}: ${failedResult[1].error.message}`);
                }

                data = {
                    ...data,
                    classes: classesResult.data || [],
                    teachers: teachersResult.data || [],
                    devices: devicesResult.data || [],
                    loans: loansResult.data || [],
                    loanDevices: loanDevicesResult.data || [],
                    weeklyReservations
                };
                saveFastDataCache();
                updateAll();
                checkScheduledReservationNotifications();
                checkLongRunningLoanNotifications();
                if (deviceSchemaReady === null) void verifyDeviceSchema();
                if (deviceLabelSchemaReady === null) void verifyDeviceLabelSchema();
                void loadSecondaryDataInBackground();
                if (pendingDeviceDetailId) {
                    const deviceId = pendingDeviceDetailId;
                    pendingDeviceDetailId = null;
                    openDeviceDetails(deviceId);
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
                alert('Erro ao carregar dados: ' + error.message);
            } finally {
                loadDataInProgress = false;
                if (loadDataQueued) {
                    loadDataQueued = false;
                    scheduleDataReload(50);
                }
            }
        }

        async function verifyDeviceSchema() {
            const { error } = await client.from('devices').select('counter_number, imei').limit(1);
            deviceSchemaReady = !error;
            return deviceSchemaReady;
        }

        async function verifyDeviceLabelSchema() {
            const { error } = await client.from('devices').select('brand, model, school_name').limit(1);
            deviceLabelSchemaReady = !error;
            return deviceLabelSchemaReady;
        }
