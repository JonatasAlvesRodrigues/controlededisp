// management.js - application script.
// ------------------------------
        // 10. Listas e CRUD de Turmas e Professores
        // ------------------------------
        function updateClassesList() {
            let html = '';
            if (data.classes.length === 0) {
                html = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma turma cadastrada</td></tr>';
            } else {
                data.classes.forEach(c => {
                    html += `<tr>
                        <td><i class="fas fa-door-open"></i> ${c.name}</td>
                        <td>${c.shift}</td>
                        <td>${c.students || '-'}</td>
                        <td>
                            <button class="btn btn-small btn-primary" onclick="editClass(${c.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small" style="background: #fee2e2; color: #991b1b;" onclick="deleteClass(${c.id})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                });
            }
            document.getElementById('classes-table').innerHTML = html;
        }

        function updateClassesCards() {
            const container = document.getElementById('classes-cards');
            if (!container) return;

            let html = '';
            if (data.classes.length === 0) {
                html = '<div class="simple-card"><div style="text-align:center; color: var(--text-muted); font-weight: 600;">Nenhuma turma cadastrada</div></div>';
            } else {
                data.classes.forEach(c => {
                    html += `
                        <div class="simple-card">
                            <div class="simple-card-header">
                                <div>
                                    <div class="simple-card-title"><i class="fas fa-door-open"></i> ${c.name}</div>
                                    <div class="simple-card-subtitle">${c.shift}</div>
                                </div>
                                <span class="badge green">${c.students || '-'} alunos</span>
                            </div>
                            <div class="simple-card-actions">
                                <button class="btn btn-primary btn-small" onclick="editClass(${c.id})">
                                    <i class="fas fa-edit"></i>
                                    Editar
                                </button>
                                <button class="btn btn-danger btn-small" onclick="deleteClass(${c.id})">
                                    <i class="fas fa-trash"></i>
                                    Remover
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        }

        function updateTeachersList() {
            let html = '';
            if (data.teachers.length === 0) {
                html = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum professor cadastrado</td></tr>';
            } else {
                data.teachers.forEach(t => {
                    html += `<tr>
                        <td><i class="fas fa-chalkboard-teacher"></i> ${t.name}</td>
                        <td>${t.subject || '-'}</td>
                        <td>
                            <button class="btn btn-small btn-primary" onclick="editTeacher(${t.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small" style="background: #fee2e2; color: #991b1b;" onclick="deleteTeacher(${t.id})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                });
            }
            document.getElementById('teachers-table').innerHTML = html;
        }

        function updateTeachersCards() {
            const container = document.getElementById('teachers-cards');
            if (!container) return;

            let html = '';
            if (data.teachers.length === 0) {
                html = '<div class="simple-card"><div style="text-align:center; color: var(--text-muted); font-weight: 600;">Nenhum professor cadastrado</div></div>';
            } else {
                data.teachers.forEach(t => {
                    html += `
                        <div class="simple-card">
                            <div class="simple-card-header">
                                <div>
                                    <div class="simple-card-title"><i class="fas fa-chalkboard-teacher"></i> ${t.name}</div>
                                    <div class="simple-card-subtitle">${t.subject || 'Sem disciplina informada'}</div>
                                </div>
                            </div>
                            <div class="simple-card-actions">
                                <button class="btn btn-primary btn-small" onclick="editTeacher(${t.id})">
                                    <i class="fas fa-edit"></i>
                                    Editar
                                </button>
                                <button class="btn btn-danger btn-small" onclick="deleteTeacher(${t.id})">
                                    <i class="fas fa-trash"></i>
                                    Remover
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        }

        // --- Funções de Turma ---
        function openClassModal(classObj = null) {
            const modal = document.getElementById('classModal');
            const modalTitle = document.getElementById('classModalTitle');
            const form = document.getElementById('classForm');
            
            if (classObj) {
                modalTitle.textContent = 'Editar Turma';
                document.getElementById('classId').value = classObj.id;
                document.getElementById('className').value = classObj.name;
                document.getElementById('classShift').value = classObj.shift;
                document.getElementById('classStudents').value = classObj.students || '';
            } else {
                modalTitle.textContent = 'Nova Turma';
                form.reset();
                document.getElementById('classId').value = '';
            }
            
            modal.classList.add('active');
        }

        function closeClassModal() {
            document.getElementById('classModal').classList.remove('active');
        }

        function editClass(classId) {
            const classObj = data.classes.find(c => c.id === classId);
            if (classObj) {
                openClassModal(classObj);
            }
        }

        async function deleteClass(classId) {
            if (!confirm('Tem certeza que deseja remover esta turma?')) return;

            try {
                const { error } = await client.from('classes').delete().eq('id', classId);
                if (error) throw error;
                await loadData();
                alert('Turma removida com sucesso!');
            } catch (error) {
                console.error('Erro ao deletar turma:', error);
                alert('Erro ao remover turma: ' + error.message);
            }
        }

        document.getElementById('classForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const classId = document.getElementById('classId').value;
            const classData = {
                name: document.getElementById('className').value,
                shift: document.getElementById('classShift').value,
                students: parseInt(document.getElementById('classStudents').value) || null
            };

            try {
                if (classId) {
                    // Editar turma existente
                    const { error } = await client.from('classes').update(classData).eq('id', parseInt(classId));
                    if (error) throw error;
                    alert('Turma atualizada com sucesso!');
                } else {
                    // Criar nova turma
                    const { error } = await client.from('classes').insert(classData);
                    if (error) throw error;
                    alert('Turma criada com sucesso!');
                }
                
                closeClassModal();
                await loadData();
                this.reset();
            } catch (error) {
                console.error('Erro ao salvar turma:', error);
                alert('Erro ao salvar turma: ' + error.message);
            }
        });

        // --- Funções de Professor ---
        function openTeacherModal(teacher = null) {
            const modal = document.getElementById('teacherModal');
            const modalTitle = document.getElementById('teacherModalTitle');
            const form = document.getElementById('teacherForm');
            
            if (teacher) {
                modalTitle.textContent = 'Editar Professor';
                document.getElementById('teacherId').value = teacher.id;
                document.getElementById('teacherName').value = teacher.name;
                document.getElementById('teacherSubject').value = teacher.subject || '';
            } else {
                modalTitle.textContent = 'Novo Professor';
                form.reset();
                document.getElementById('teacherId').value = '';
            }
            
            modal.classList.add('active');
        }

        function closeTeacherModal() {
            document.getElementById('teacherModal').classList.remove('active');
        }

        function editTeacher(teacherId) {
            const teacher = data.teachers.find(t => t.id === teacherId);
            if (teacher) {
                openTeacherModal(teacher);
            }
        }

        async function deleteTeacher(teacherId) {
            if (!confirm('Tem certeza que deseja remover este professor?')) return;

            try {
                const { error } = await client.from('teachers').delete().eq('id', teacherId);
                if (error) throw error;
                await loadData();
                alert('Professor removido com sucesso!');
            } catch (error) {
                console.error('Erro ao deletar professor:', error);
                alert('Erro ao remover professor: ' + error.message);
            }
        }

        document.getElementById('teacherForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const teacherId = document.getElementById('teacherId').value;
            const teacherData = {
                name: document.getElementById('teacherName').value,
                subject: document.getElementById('teacherSubject').value || null
            };

            try {
                if (teacherId) {
                    // Editar professor existente
                    const { error } = await client.from('teachers').update(teacherData).eq('id', parseInt(teacherId));
                    if (error) throw error;
                    alert('Professor atualizado com sucesso!');
                } else {
                    // Criar novo professor
                    const { error } = await client.from('teachers').insert(teacherData);
                    if (error) throw error;
                    alert('Professor criado com sucesso!');
                }
                
                closeTeacherModal();
                await loadData();
                this.reset();
            } catch (error) {
                console.error('Erro ao salvar professor:', error);
                alert('Erro ao salvar professor: ' + error.message);
            }
        });

        function renderDeviceStatusOptions(type, selectedStatus = 'Disponível') {
            const statusSelect = document.getElementById('deviceStatus');
            const options = isFixedDevice(type)
                ? [
                    { value: 'Disponível', label: 'Disponível' },
                    { value: 'Manutenção', label: 'Manutenção' },
                    { value: 'Fora de uso', label: 'Fora de uso' }
                ]
                : [
                    { value: 'Disponível', label: 'Disponível' },
                    { value: 'Em uso', label: 'Em uso' },
                    { value: 'Manutenção', label: 'Manutenção' },
                    { value: 'Fora de uso', label: 'Fora de uso' }
                ];

            statusSelect.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
            statusSelect.value = options.some(option => option.value === selectedStatus) ? selectedStatus : options[0].value;
        }

        function getCounterNumberValue(counterNumber) {
            const raw = (counterNumber || '').toString().trim();
            if (!raw || raw.toLowerCase() === 's/n' || raw.toLowerCase() === 'sn') return null;

            if (!/^\d+$/.test(raw)) return null;

            const value = parseInt(raw, 10);
            return Number.isFinite(value) && value > 0 ? value : null;
        }

        function formatCounterNumber(value, type) {
            const sameTypeCounters = data.devices
                .filter(device => device.type === type)
                .map(device => (device.counter_number || '').toString().trim())
                .filter(counter => /^\d+$/.test(counter));
            const maxWidth = sameTypeCounters.reduce((width, counter) => Math.max(width, counter.length), 0);
            return String(value).padStart(Math.max(2, maxWidth, 3), '0');
        }

        function getNextAvailableCounterNumberForType(type, currentDeviceId = '') {
            const usedNumbers = new Set();
            const parsedCurrentId = currentDeviceId ? parseInt(currentDeviceId) : null;

            data.devices.forEach(device => {
                if (device.type !== type) return;
                if (parsedCurrentId && parseInt(device.id) === parsedCurrentId) return;

                const value = getCounterNumberValue(device.counter_number);
                if (value) usedNumbers.add(value);
            });

            let next = 1;
            while (usedNumbers.has(next)) {
                next += 1;
            }

            return formatCounterNumber(next, type);
        }

        function updateAutoCounterSuggestion(force = false) {
            const deviceId = document.getElementById('deviceId')?.value || '';
            if (deviceId) return;

            const type = document.getElementById('deviceType')?.value || '';
            const counterInput = document.getElementById('deviceCounter');
            if (!type || !counterInput) return;

            const currentCounter = counterInput.value.trim();
            const shouldReplace =
                force ||
                !currentCounter ||
                currentCounter.toLowerCase() === 's/n' ||
                currentCounter.toLowerCase() === 'sn' ||
                currentCounter === lastAutoCounterSuggestion;

            if (!shouldReplace) return;

            lastAutoCounterSuggestion = getNextAvailableCounterNumberForType(type);
            counterInput.value = lastAutoCounterSuggestion;
        }

        function handleDeviceTypeChange(preferredStatus = null) {
            const type = document.getElementById('deviceType').value;
            const groupInput = document.getElementById('deviceGroup');
            const imeiGroup = document.getElementById('deviceImeiGroup');
            const imeiInput = document.getElementById('deviceImei');
            const currentStatus = preferredStatus || document.getElementById('deviceStatus').value;

            groupInput.placeholder = isFixedDevice(type)
                ? 'Ex: Sala 17, Sala de Informática ou Gestão'
                : 'Ex: Base 1, Carrinho A, Sala 17';
            if (imeiGroup && imeiInput) {
                const isTablet = type === 'Tablet';
                imeiGroup.style.display = isTablet ? 'block' : 'none';
                imeiInput.required = isTablet;
                if (!isTablet) {
                    imeiInput.value = '';
                }
            }
            renderDeviceStatusOptions(type, currentStatus);
            updateAutoCounterSuggestion();
        }

        // Função para abrir o modal de novo dispositivo
        function openDeviceModal(device = null) {
            if (!requireDeviceAdminPermission()) return;

            ensureDeviceLabelFields();
            const modal = document.getElementById('deviceModal');
            const modalTitle = document.getElementById('modalTitle');
            const form = document.getElementById('deviceForm');
            
            if (device) {
                modalTitle.textContent = 'Editar Dispositivo';
                document.getElementById('deviceId').value = device.id;
                document.getElementById('deviceType').value = device.type;
                document.getElementById('deviceSerial').value = device.serial_number || '';
                document.getElementById('devicePatrimony').value = device.patrimony || '';
                document.getElementById('deviceImei').value = device.imei || '';
                document.getElementById('deviceBrand').value = device.brand || '';
                document.getElementById('deviceModel').value = device.model || '';
                document.getElementById('deviceSchoolName').value = device.school_name || getLabelSchoolName(device);
                document.getElementById('deviceCounter').value = device.counter_number || 's/n';
                document.getElementById('deviceGroup').value = device.group;
                document.getElementById('deviceObservations').value = device.observations || '';
            } else {
                modalTitle.textContent = 'Novo Dispositivo';
                form.reset();
                lastAutoCounterSuggestion = '';
                document.getElementById('deviceId').value = '';
                document.getElementById('deviceSerial').value = '';
                document.getElementById('deviceImei').value = '';
                document.getElementById('deviceBrand').value = '';
                document.getElementById('deviceModel').value = '';
                document.getElementById('deviceSchoolName').value = 'Escola Percio';
                document.getElementById('deviceCounter').value = '';
            }

            document.getElementById('deviceType').value = device?.type || 'Notebook';
            handleDeviceTypeChange(isFixedDevice(device?.type) && device?.status === 'Em uso' ? 'Disponível' : (device?.status || 'Disponível'));
            if (!device) {
                updateAutoCounterSuggestion(true);
            }
            
            modal.classList.add('active');
        }

        // Função para fechar o modal
        function closeDeviceModal() {
            document.getElementById('deviceModal').classList.remove('active');
        }

        // Função para editar dispositivo
        function editDevice(deviceId) {
            if (!requireDeviceAdminPermission()) return;

            const device = data.devices.find(d => d.id === deviceId);
            if (device) {
                openDeviceModal(device);
            }
        }

        // Função para alternar entre manutenção e disponível
        async function toggleMaintenance(deviceId) {
            if (!requireDeviceAdminPermission()) return;

            const device = data.devices.find(d => d.id === deviceId);
            if (!device) return;

            const newStatus = device.status === 'Manutenção' ? 'Disponível' : 'Manutenção';

            try {
                const { error } = await client.from('devices').update({ status: newStatus }).eq('id', deviceId);
                if (error) throw error;
                await recordDeviceMaintenanceEvent(device, device.status, newStatus);
                await loadData();
                renderSelectedDeviceDetails();
                alert(`Dispositivo ${newStatus === 'Manutenção' ? 'colocado em' : 'retirado de'} manutenção com sucesso!`);
            } catch (error) {
                console.error('Erro ao atualizar status:', error);
                alert('Erro ao atualizar status: ' + error.message);
            }
        }

        // Função para deletar dispositivo
        async function deleteDevice(deviceId) {
            if (!requireDeviceAdminPermission()) return;

            if (!confirm('Tem certeza que deseja remover este dispositivo?')) return;

            try {
                const device = data.devices.find(d => parseInt(d.id) === parseInt(deviceId));
                const { error } = await client.from('devices').delete().eq('id', deviceId);
                if (error) throw error;
                if (device) {
                    await recordDeviceChangeEvent('deleted', device, device, null, 'Dispositivo removido');
                }
                await loadData();
                alert('Dispositivo removido com sucesso!');
            } catch (error) {
                console.error('Erro ao deletar dispositivo:', error);
                alert('Erro ao remover dispositivo: ' + error.message);
            }
        }

        // Evento para salvar dispositivo (novo ou editado)
        document.getElementById('deviceForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!requireDeviceAdminPermission()) return;

            const deviceId = document.getElementById('deviceId').value;
            const selectedDeviceType = document.getElementById('deviceType').value;
            const serialNumber = document.getElementById('deviceSerial').value.trim();
            const imei = document.getElementById('deviceImei').value.trim();
            const counterNumber = document.getElementById('deviceCounter').value.trim();
            const previousDevice = deviceId ? data.devices.find(d => d.id === parseInt(deviceId)) : null;

            if (!counterNumber) {
                alert('Informe o numero contador ou S/N.');
                document.getElementById('deviceCounter').focus();
                return;
            }

            const duplicateCounterDevice = findDeviceWithSameCounterNumber(selectedDeviceType, counterNumber, deviceId);
            if (duplicateCounterDevice) {
                alert(`O numero contador "${counterNumber}" ja esta em uso em outro dispositivo do tipo ${selectedDeviceType}. Use o proximo numero disponivel.`);
                document.getElementById('deviceCounter').focus();
                return;
            }

            const duplicateSerialDevice = findDeviceWithSameSerial(serialNumber, deviceId);
            if (duplicateSerialDevice) {
                const duplicateLabel = [
                    duplicateSerialDevice.type,
                    duplicateSerialDevice.patrimony ? `patrimônio ${duplicateSerialDevice.patrimony}` : '',
                    duplicateSerialDevice.counter_number ? `contador ${duplicateSerialDevice.counter_number}` : ''
                ].filter(Boolean).join(' - ');
                const shouldContinue = confirm(`Já existe um dispositivo cadastrado com o N/S "${serialNumber}"${duplicateLabel ? ` (${duplicateLabel})` : ''}. Deseja realmente adicionar outro dispositivo com o mesmo número?`);
                if (!shouldContinue) {
                    document.getElementById('deviceSerial').focus();
                    return;
                }
            }

            if (deviceSchemaReady === false || (deviceSchemaReady === null && !(await verifyDeviceSchema()))) {
                alert('O banco ainda nao tem as colunas counter_number e/ou imei aplicadas. Execute atualizar_tabela_devices.sql no Supabase e recarregue a pagina.');
                return;
            }

            const deviceData = {
                type: selectedDeviceType,
                serial_number: serialNumber || null,
                patrimony: document.getElementById('devicePatrimony').value || null,
                imei: document.getElementById('deviceType').value === 'Tablet' ? (imei || null) : null,
                counter_number: counterNumber,
                group: document.getElementById('deviceGroup').value,
                status: document.getElementById('deviceStatus').value,
                observations: document.getElementById('deviceObservations').value || null
            };

            if (deviceLabelSchemaReady === null) {
                await verifyDeviceLabelSchema();
            }
            if (deviceLabelSchemaReady) {
                deviceData.brand = document.getElementById('deviceBrand')?.value || null;
                deviceData.model = document.getElementById('deviceModel')?.value || null;
                deviceData.school_name = document.getElementById('deviceSchoolName')?.value || null;
            }

            if (isFixedDevice(deviceData.type) && deviceData.status === 'Em uso') {
                deviceData.status = 'Disponível';
            }

            try {
                if (deviceId) {
                    // Editar dispositivo existente
                    const { error } = await client.from('devices').update(deviceData).eq('id', parseInt(deviceId));
                    if (error) throw error;
                    await recordDeviceChangeEvent('updated', previousDevice, previousDevice, { ...previousDevice, ...deviceData }, 'Dispositivo editado');
                    await recordDeviceMaintenanceEvent(previousDevice, previousDevice?.status, deviceData.status);
                    alert('Dispositivo atualizado com sucesso!');
                } else {
                    // Criar novo dispositivo
                    const { data: createdDevice, error } = await client.from('devices').insert(deviceData).select().single();
                    if (error) throw error;
                    await recordDeviceChangeEvent('created', createdDevice, null, createdDevice, 'Dispositivo criado');
                    alert('Dispositivo criado com sucesso!');
                }
                
                closeDeviceModal();
                await loadData();
                this.reset();
            } catch (error) {
                console.error('Erro ao salvar dispositivo:', error);
                alert('Erro ao salvar dispositivo: ' + error.message);
            }
        });

        function filterHistory() {
            const date = document.getElementById('filterDate').value;
            const classId = parseInt(document.getElementById('filterClass').value);
            const teacherId = parseInt(document.getElementById('filterTeacher').value);

            let filtered = [...data.loans];
            if (date) {
                filtered = filtered.filter(loan => {
                    const [loanDate] = (loan.date_time || '').split(' ');
                    const [day, month, year] = loanDate ? loanDate.split('/') : [];
                    if (!day || !month || !year) return false;
                    const normalizedLoanDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    return normalizedLoanDate === date;
                });
            }
            if (classId) filtered = filtered.filter(l => l.class_id === classId);
            if (teacherId) filtered = filtered.filter(l => l.teacher_id === teacherId);

            updateHistoryTableWithData(filtered);
        }

        function updateHistoryTable() {
            updateHistoryTableWithData(data.loans);
        }

        function updateHistoryTableWithData(loans) {
            let html = '';
            if (loans.length === 0) {
                html = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum empréstimo registrado</td></tr>';
            } else {
                loans.sort((a, b) => b.id - a.id).forEach(loan => {
                    const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                    const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                    let badgeColor = 'yellow';
                    let badgeText = 'Em uso';
                    if (loan.returned) {
                        badgeColor = loan.return_status === 'complete' ? 'green' : loan.return_status === 'incomplete' ? 'yellow' : 'red';
                        badgeText = loan.return_status === 'complete' ? 'Devolvido' : loan.return_status === 'incomplete' ? 'Incompleto' : 'Com danos';
                    } else {
                        const deadline = getLoanDeadlineInfo(loan);
                        badgeColor = deadline.badgeColor;
                        badgeText = deadline.shortLabel;
                    }
                    
                    html += `
                        <tr>
                            <td>${loan.date_time}</td>
                            <td style="font-weight: 600;">${className}</td>
                            <td>${teacherName}</td>
                            <td style="font-weight: 600;">${loan.quantity}</td>
                            <td><span class="badge ${badgeColor}">${badgeText}</span></td>
                        </tr>
                    `;
                });
            }
            document.getElementById('history-table').innerHTML = html;
            renderLoanCards('history-cards', [...loans].sort((a, b) => b.id - a.id), {
                showReleaser: true,
                emptyMessage: 'Nenhum empréstimo registrado',
                mobileLimit: mobileHistoryCardLimit,
                loadMoreAction: 'loadMoreHistoryCards()'
            });
        }

        function loadMoreHistoryCards() {
            mobileHistoryCardLimit += 10;
            filterHistory();
        }

        function updateDevicesTable() {
            const tableBody = document.getElementById('devices-table');
            const table = tableBody?.closest('table');
            const headerRow = table?.querySelector('thead tr');
            if (!tableBody) return;

            if (headerRow && headerRow.children.length !== 10) {
                headerRow.innerHTML = `
                    <th><input type="checkbox" id="selectAllLabelsToggle" onchange="toggleAllVisibleLabelDevices(this.checked)" title="Selecionar dispositivos visíveis"></th>
                    <th>Tipo</th>
                    <th>Nº Série</th>
                    <th>Patrimônio</th>
                    <th>IMEI</th>
                    <th>Nº Contador</th>
                    <th>Agrupamento</th>
                    <th>Estado</th>
                    <th>Observações</th>
                    <th>Ações</th>
                `;
            }

            const sortedDevices = getFilteredDevices();
            const hasFilters = !!(document.getElementById('deviceSearchInput')?.value?.trim() || document.getElementById('deviceTypeFilter')?.value || deviceStatusFilter);
            let html = '';

            if (sortedDevices.length === 0) {
                html = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">${hasFilters ? 'Nenhum dispositivo encontrado com os filtros aplicados' : 'Nenhum dispositivo cadastrado'}</td></tr>`;
            } else {
                let lastGroupKey = null;
                sortedDevices.forEach(d => {
                    const badgeColor = getDeviceStatusBadgeColor(d.status);
                    const isDesktop = isFixedDevice(d.type);
                    const icon = getDeviceIcon(d.type);
                    const groupKey = getDeviceDisplayGroupKey(d);
                    const adminDeviceActions = canManageDevices();

                    if (groupKey !== lastGroupKey) {
                        lastGroupKey = groupKey;
                        html += `<tr class="device-group-row"><td colspan="10">${getDeviceDisplayGroupLabel(d)}</td></tr>`;
                    }

                    html += `<tr class="device-row" onclick="openDeviceDetails(${d.id})" title="Abrir detalhes do dispositivo">
                        <td><input type="checkbox" data-label-device-id="${d.id}" ${selectedLabelDeviceIds.has(parseInt(d.id)) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleLabelDeviceSelection(${d.id}, this.checked)" title="Selecionar para etiqueta"></td>
                        <td>
                            <i class="fas fa-${icon}"></i> ${d.type}
                            ${isDesktop ? '<span class="device-fixed-badge"><i class="fas fa-building"></i> Fixo</span>' : ''}
                        </td>
                        <td>${d.serial_number || '-'}</td>
                        <td>${d.patrimony || '-'}</td>
                        <td>${d.type === 'Tablet' ? (d.imei || '-') : '-'}</td>
                        <td>${d.counter_number || '-'}</td>
                        <td>${d.group}</td>
                        <td><span class="badge ${badgeColor}">${d.status}</span></td>
                        <td>${d.observations ? d.observations.substring(0, 30) + (d.observations.length > 30 ? '...' : '') : '-'}</td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); openDeviceDetails(${d.id})" title="Detalhes">
                                <i class="fas fa-circle-info"></i>
                            </button>
                            <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); generateSingleDeviceLabelPdf(${d.id})" title="Gerar etiqueta">
                                <i class="fas fa-tag"></i>
                            </button>
                            <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); editDevice(${d.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${isDesktop ? `
                                <button class="btn btn-small" style="background: #fef3c7; color: #92400e;" onclick="event.stopPropagation(); toggleMaintenance(${d.id})" title="Colocar/Retirar de Manutenção">
                                    <i class="fas fa-wrench"></i>
                                </button>
                            ` : `
                                <button class="btn btn-small" style="background: #fef3c7; color: #92400e;" onclick="event.stopPropagation(); toggleMaintenance(${d.id})" title="Colocar/Retirar de Manutenção">
                                    <i class="fas fa-wrench"></i>
                                </button>
                                <button class="btn btn-small" style="background: #fee2e2; color: #991b1b;" onclick="event.stopPropagation(); deleteDevice(${d.id})" title="Remover">
                                    <i class="fas fa-trash"></i>
                                </button>
                            `}
                        </td>
                    </tr>`;
                });
            }

            tableBody.innerHTML = html;
            syncLabelSelectionControls();
        }

        function updateDevicesCards() {
            const container = document.getElementById('devices-cards');
            if (!container) return;

            const sortedDevices = getFilteredDevices();
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const visibleDevices = isMobile ? sortedDevices.slice(0, mobileDeviceCardLimit) : sortedDevices;
            const groupedDevices = groupDevicesByType(visibleDevices);
            const remainingDevices = sortedDevices.length - visibleDevices.length;
            const hasFilters = !!(document.getElementById('deviceSearchInput')?.value?.trim() || document.getElementById('deviceTypeFilter')?.value || deviceStatusFilter);
            let html = '';

            if (sortedDevices.length === 0) {
                html = `<div class="device-card"><div style="text-align:center; color: var(--text-muted); font-weight: 600;">${hasFilters ? 'Nenhum dispositivo encontrado com os filtros aplicados' : 'Nenhum dispositivo cadastrado'}</div></div>`;
            } else {
                html = groupedDevices.map(group => `
                    <section class="device-group-section">
                        <div class="device-group-heading">${group.label}</div>
                        <div style="display: grid; gap: 14px;">
                            ${group.devices.map(d => {
                                const badgeColor = getDeviceStatusBadgeColor(d.status);
                                const icon = getDeviceIcon(d.type);
                                const isDesktop = isFixedDevice(d.type);
                                const deleteButton = isDesktop ? '' : `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteDevice(${d.id})">
                                    <i class="fas fa-trash"></i>
                                    Remover
                                </button>`;

                                if (isMobile) {
                                    const identity = d.counter_number || d.patrimony || d.serial_number || `ID ${d.id}`;
                                    const adminAction = canManageDevices() ? `
                                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editDevice(${d.id})">
                                            <i class="fas fa-edit"></i>
                                            Editar
                                        </button>
                                    ` : '';
                                    return `
                                        <div class="device-card mobile-device-card device-card-clickable" onclick="openDeviceDetails(${d.id})">
                                            <div class="mobile-device-summary">
                                                <span class="mobile-device-icon"><i class="fas fa-${icon}"></i></span>
                                                <span class="mobile-device-copy">
                                                    <strong>${escapeHtml(d.type || '-')} · ${escapeHtml(identity)}</strong>
                                                    <span>${escapeHtml(d.group || 'Sem agrupamento')}</span>
                                                </span>
                                                <span class="badge ${badgeColor}">${escapeHtml(d.status || '-')}</span>
                                            </div>
                                            <div class="mobile-device-actions">
                                                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openDeviceDetails(${d.id})">
                                                    <i class="fas fa-circle-info"></i>
                                                    Detalhes
                                                </button>
                                                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); generateSingleDeviceLabelPdf(${d.id})">
                                                    <i class="fas fa-tag"></i>
                                                    Etiqueta
                                                </button>
                                                ${adminAction}
                                            </div>
                                        </div>
                                    `;
                                }

                                return `
                                    <div class="device-card device-card-clickable" onclick="openDeviceDetails(${d.id})">
                                        <div class="device-card-top">
                                            <div class="device-card-title">
                                                <i class="fas fa-${icon}"></i>
                                                <span>${d.type}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                ${isDesktop ? '<span class="device-fixed-badge"><i class="fas fa-building"></i> Fixo</span>' : ''}
                                                <input type="checkbox" data-label-device-id="${d.id}" ${selectedLabelDeviceIds.has(parseInt(d.id)) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleLabelDeviceSelection(${d.id}, this.checked)" title="Selecionar para etiqueta">
                                            </div>
                                        </div>
                                        <div class="device-card-meta">
                                            <div class="device-card-field">
                                                <small>Nº série</small>
                                                <span>${d.serial_number || '-'}</span>
                                            </div>
                                            <div class="device-card-field">
                                                <small>Patrimônio</small>
                                                <span>${d.patrimony || '-'}</span>
                                            </div>
                                            ${d.type === 'Tablet' ? `
                                                <div class="device-card-field">
                                                    <small>IMEI</small>
                                                    <span>${d.imei || '-'}</span>
                                                </div>
                                            ` : ''}
                                            <div class="device-card-field">
                                                <small>Nº contador</small>
                                                <span>${d.counter_number || '-'}</span>
                                            </div>
                                            <div class="device-card-field">
                                                <small>Estado</small>
                                                <span><span class="badge ${badgeColor}">${d.status}</span></span>
                                            </div>
                                            <div class="device-card-field" style="grid-column: 1 / -1;">
                                                <small>Agrupamento</small>
                                                <span>${d.group}</span>
                                            </div>
                                            <div class="device-card-field" style="grid-column: 1 / -1;">
                                                <small>Observações</small>
                                                <span>${d.observations ? d.observations.substring(0, 80) + (d.observations.length > 80 ? '...' : '') : '-'}</span>
                                            </div>
                                        </div>
                                        <div class="device-card-actions">
                                            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openDeviceDetails(${d.id})">
                                                <i class="fas fa-circle-info"></i>
                                                Detalhes
                                            </button>
                                            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); generateSingleDeviceLabelPdf(${d.id})">
                                                <i class="fas fa-tag"></i>
                                                Etiqueta
                                            </button>
                                            <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editDevice(${d.id})">
                                                <i class="fas fa-edit"></i>
                                                Editar
                                            </button>
                                            <button class="btn btn-secondary btn-small" style="background: #fef3c7; color: #92400e;" onclick="event.stopPropagation(); toggleMaintenance(${d.id})">
                                                <i class="fas fa-wrench"></i>
                                                Manut.
                                            </button>
                                            ${deleteButton || '<span></span>'}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </section>
                `).join('');
                if (remainingDevices > 0) {
                    html += `
                        <div class="mobile-load-more">
                            <span>Exibindo ${visibleDevices.length} de ${sortedDevices.length} dispositivos</span>
                            <button type="button" class="btn btn-secondary" onclick="loadMoreDeviceCards()">
                                <i class="fas fa-chevron-down"></i>
                                Carregar mais (${remainingDevices})
                            </button>
                        </div>
                    `;
                }
            }

            container.innerHTML = html;
        }

        function loadMoreDeviceCards() {
            mobileDeviceCardLimit += 10;
            updateDevicesCards();
        }
