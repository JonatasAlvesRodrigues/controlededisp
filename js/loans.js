// loans.js - application script.
function getLoanInfo(loan) {
            const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
            const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
            const loanTypeLabel = loan.loan_type === 'full' ? 'Base completa' : 'Quantidade';
            let statusColor = loan.returned
                ? loan.return_status === 'complete'
                    ? 'green'
                    : loan.return_status === 'incomplete'
                        ? 'yellow'
                        : 'red'
                : 'yellow';
            let statusText = loan.returned
                ? loan.return_status === 'complete'
                    ? 'Devolvido'
                    : loan.return_status === 'incomplete'
                        ? 'Incompleto'
                        : 'Com danos'
                : 'Em uso';
            const deadline = getLoanDeadlineInfo(loan);
            if (!loan.returned && ['overdue', 'due-soon'].includes(deadline.key)) {
                statusColor = deadline.badgeColor;
                statusText = deadline.shortLabel;
            }

            return {
                className,
                teacherName,
                loanTypeLabel,
                statusColor,
                statusText
            };
        }

        function renderLoanCards(containerId, loans, options = {}) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const {
                showReleaser = false,
                showAction = false,
                emptyMessage = 'Nenhum empréstimo registrado',
                mobileLimit = 0,
                loadMoreAction = ''
            } = options;

            if (!loans.length) {
                container.innerHTML = `
                    <div class="loan-card">
                        <div style="text-align:center; color: var(--text-muted); font-weight: 600;">${emptyMessage}</div>
                    </div>
                `;
                return;
            }

            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const visibleLoans = isMobile && mobileLimit > 0 ? loans.slice(0, mobileLimit) : loans;
            const remainingLoans = loans.length - visibleLoans.length;

            container.innerHTML = visibleLoans.map(loan => {
                const info = getLoanInfo(loan);
                const pendingQuantity = getLoanPendingQuantity(loan);
                const displayQuantity = loan.returned ? loan.quantity : pendingQuantity;
                const quantityLabel = !loan.returned && pendingQuantity !== Number(loan.quantity)
                    ? 'Pendentes'
                    : 'Quantidade';
                const deadline = getLoanDeadlineInfo(loan);
                const actionButton = showAction
                    ? `<button class="btn btn-primary btn-small" onclick="showScreen('return'); document.getElementById('returnLoan').value=${loan.id}; loadReturnDetails();">
                            <i class="fas fa-undo"></i>
                            Devolver
                        </button>`
                    : '';

                return `
                    <div class="loan-card">
                        <div class="loan-card-header">
                            <div>
                                <div class="loan-card-title">${info.className}</div>
                                <div class="loan-card-subtitle">${info.teacherName}</div>
                            </div>
                            <span class="badge ${info.statusColor}">${info.statusText}</span>
                        </div>
                        <div class="loan-card-body">
                            <div class="loan-card-field">
                                <small>Tipo</small>
                                <span>${info.loanTypeLabel}</span>
                            </div>
                            <div class="loan-card-field">
                                <small>${quantityLabel}</small>
                                <span>${displayQuantity}</span>
                            </div>
                            <div class="loan-card-field">
                                <small>Data/Hora</small>
                                <span>${loan.date_time}</span>
                            </div>
                            <div class="loan-card-field">
                                <small>Responsável</small>
                                <span>${loan.releaser || '-'}</span>
                            </div>
                            ${loan.due_at ? `
                                <div class="loan-card-field" style="grid-column: 1 / -1;">
                                    <small>Previsão de devolução</small>
                                    <span>${escapeHtml(deadline.detail.replace('Prazo: ', ''))}</span>
                                </div>
                            ` : ''}
                            ${showReleaser ? `
                                <div class="loan-card-field" style="grid-column: 1 / -1;">
                                    <small>Observações</small>
                                    <span>${loan.observations || '-'}</span>
                                </div>
                            ` : ''}
                        </div>
                        ${actionButton ? `<div class="loan-card-actions">${actionButton}</div>` : ''}
                    </div>
                `;
            }).join('') + (remainingLoans > 0 && loadMoreAction ? `
                <div class="mobile-load-more">
                    <span>Exibindo ${visibleLoans.length} de ${loans.length}</span>
                    <button type="button" class="btn btn-secondary" onclick="${loadMoreAction}">
                        <i class="fas fa-chevron-down"></i>
                        Carregar mais (${remainingLoans})
                    </button>
                </div>
            ` : '');
        }

        function updateActiveLoans() {
            const activeLoans = data.loans.filter(l => !l.returned);
            let html = '';
            
            if (activeLoans.length === 0) {
                html = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum empréstimo ativo no momento</td></tr>';
            } else {
                activeLoans.slice(0, 5).forEach(loan => {
                    const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                    const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                    const loanTypeLabel = loan.loan_type === 'full' ? 'Base completa' : 'Quantidade';
                    const pendingQuantity = getLoanPendingQuantity(loan);
                    const deadline = getLoanDeadlineInfo(loan);
                    
                    html += `
                        <tr class="${deadline.rowClass}">
                            <td style="font-weight: 600;">${className}</td>
                            <td>${teacherName}</td>
                            <td>${loanTypeLabel}</td>
                            <td style="font-weight: 600;">${pendingQuantity}</td>
                            <td>${loan.date_time}</td>
                            <td><span class="badge ${deadline.badgeColor}">${escapeHtml(deadline.shortLabel)}</span></td>
                        </tr>
                    `;
                });
            }

            document.getElementById('active-loans-table').innerHTML = html;

            // Todos os empréstimos ativos
            let allHtml = '';
            if (activeLoans.length === 0) {
                allHtml = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum empréstimo ativo no momento</td></tr>';
            } else {
                activeLoans.forEach(loan => {
                    const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                    const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                    const loanTypeLabel = loan.loan_type === 'full' ? 'Base completa' : 'Quantidade';
                    const pendingQuantity = getLoanPendingQuantity(loan);
                    const deadline = getLoanDeadlineInfo(loan);
                    
                    allHtml += `
                        <tr class="${deadline.rowClass}">
                            <td style="font-weight: 600;">${className}</td>
                            <td>${teacherName}</td>
                            <td>${loanTypeLabel}</td>
                            <td style="font-weight: 600;">${pendingQuantity}</td>
                            <td>${loan.date_time}</td>
                            <td><span class="badge ${deadline.badgeColor}">${escapeHtml(deadline.shortLabel)}</span></td>
                            <td>${loan.releaser}</td>
                            <td><button class="btn btn-small btn-primary" onclick="startReturnForLoan(${loan.id})">Devolver</button></td>
                        </tr>
                    `;
                });
            }
            document.getElementById('all-active-loans').innerHTML = allHtml;
            renderLoanCards('active-loans-cards', activeLoans.slice(0, 5), { emptyMessage: 'Nenhum empréstimo ativo no momento' });
            renderLoanCards('all-active-loans-cards', activeLoans, {
                showAction: true,
                emptyMessage: 'Nenhum empréstimo ativo no momento',
                mobileLimit: mobileActiveLoanCardLimit,
                loadMoreAction: 'loadMoreActiveLoanCards()'
            });
        }

        function loadMoreActiveLoanCards() {
            mobileActiveLoanCardLimit += 10;
            updateActiveLoans();
        }

        function updateLatestLoans() {
            const latestLoans = [...data.loans].sort((a, b) => b.id - a.id).slice(0, 5);
            let html = '';
            
            if (latestLoans.length === 0) {
                html = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum empréstimo registrado</td></tr>';
            } else {
                latestLoans.forEach(loan => {
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
                            <td style="font-weight: 600;">${className}</td>
                            <td>${teacherName}</td>
                            <td style="font-weight: 600;">${loan.quantity}</td>
                            <td>${loan.date_time}</td>
                            <td>${loan.releaser}</td>
                            <td><span class="badge ${badgeColor}">${badgeText}</span></td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('latest-loans-table').innerHTML = html;
            renderLoanCards('latest-loans-cards', latestLoans, { emptyMessage: 'Nenhum empréstimo registrado' });
        }


        function clearSpecificLoanSelection() {
            pendingSpecificLoanDeviceId = null;
            const quantityInput = document.getElementById('loanQuantity');
            const typeSelect = document.getElementById('loanDeviceType');
            const notice = document.getElementById('loanSpecificDeviceNotice');
            if (quantityInput) quantityInput.readOnly = false;
            if (typeSelect) typeSelect.disabled = false;
            if (notice) {
                notice.style.display = 'none';
                notice.textContent = '';
            }
        }

        function openGeneralLoanScreen() {
            clearSpecificLoanSelection();
            showScreen('loan');
        }

        function startLoanFromDevice(deviceId) {
            const device = data.devices.find(item => parseInt(item.id) === parseInt(deviceId));
            if (!device) return;
            if (device.status !== 'Disponível' || isFixedDevice(device.type)) {
                alert('Este dispositivo não está disponível para empréstimo rápido.');
                return;
            }

            showScreen('loan');
            pendingSpecificLoanDeviceId = parseInt(device.id);
            setLoanType('quantity');
            document.getElementById('loanDeviceType').value = device.type;
            document.getElementById('loanDeviceType').disabled = true;
            document.getElementById('loanQuantity').value = 1;
            document.getElementById('loanQuantity').readOnly = true;
            document.getElementById('loanObs').value = `Empréstimo iniciado pelo QR do dispositivo ${device.patrimony || device.counter_number || device.id}.`;
            const notice = document.getElementById('loanSpecificDeviceNotice');
            notice.textContent = `Dispositivo selecionado: ${getDeviceIdentityLabel(device)}`;
            notice.style.display = 'block';
            document.getElementById('loanClass').focus();
        }

        // ------------------------------
        // 8. Tipo de Empréstimo
        // ------------------------------
        function setLoanType(type) {
            if (pendingSpecificLoanDeviceId && type !== 'quantity') {
                alert('Este empréstimo foi iniciado por um notebook específico. Para emprestar uma base, abra “Novo Empréstimo” pelo menu.');
                return;
            }
            currentLoanType = type;
            document.querySelectorAll('.loan-type-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.type === type);
            });
            document.getElementById('quantityGroup').style.display = type === 'quantity' ? 'block' : 'none';
            document.getElementById('groupGroup').style.display = type === 'full' ? 'block' : 'none';
        }

        function toLocalDateTimeInputValue(date) {
            const offsetMilliseconds = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
        }

        function setLoanDueMinimum() {
            const input = document.getElementById('loanDueAt');
            if (input) input.min = toLocalDateTimeInputValue(new Date());
        }

        function getAvailableDevicesForLoan(deviceType, quantity, groupName = '') {
            const availableDevices = sortDevicesForDisplay(data.devices).filter(device => {
                if (device.type !== deviceType) return false;
                if (isFixedDevice(device.type)) return false;
                if (device.status !== 'Disponível') return false;
                if (groupName && device.group !== groupName) return false;
                return true;
            });

            return availableDevices.slice(0, quantity);
        }

        async function updateLoanDeviceStatuses(devices, status) {
            if (!devices.length) return;
            const deviceIds = devices.map(device => device.id);
            const { error } = await client.from('devices').update({ status }).in('id', deviceIds);
            if (error) throw error;
        }

        function getLinkedDevicesForLoan(loanId) {
            const linkedDeviceIds = (data.loanDevices || [])
                .filter(item => parseInt(item.loan_id) === parseInt(loanId))
                .map(item => parseInt(item.device_id));
            return data.devices.filter(device => linkedDeviceIds.includes(parseInt(device.id)));
        }

        function getLoanDeviceEntries(loanId) {
            return (data.loanDevices || [])
                .filter(item => parseInt(item.loan_id) === parseInt(loanId))
                .map(link => ({
                    link,
                    device: data.devices.find(device => parseInt(device.id) === parseInt(link.device_id))
                }))
                .filter(entry => entry.device);
        }

        function shouldShowLoanDeviceNumbers(loan) {
            return loan?.loan_type === 'full' ||
                loan?.loan_type === 'specific' ||
                String(loan?.observations || '').includes('Empréstimo iniciado pelo QR do dispositivo');
        }

        function getLoanDeviceReturnStatus(link, loan = null) {
            if (link?.return_status) return link.return_status;
            if (!loan?.returned) return 'pending';
            return loan.return_status === 'damaged' ? 'damaged' : 'returned';
        }

        function isDevicePendingInLoan(deviceId, loanId) {
            const link = (data.loanDevices || []).find(item =>
                parseInt(item.loan_id) === parseInt(loanId) &&
                parseInt(item.device_id) === parseInt(deviceId)
            );
            if (!link) return true;

            const loan = data.loans.find(item => parseInt(item.id) === parseInt(loanId));
            return getLoanDeviceReturnStatus(link, loan) === 'pending';
        }

        function getLoanPendingQuantity(loan) {
            const entries = getLoanDeviceEntries(loan.id);
            if (!entries.length || !shouldShowLoanDeviceNumbers(loan)) {
                if (loan.returned) return 0;
                return Math.max(
                    (Number(loan.quantity) || 0) - (Number(loan.return_quantity) || 0),
                    0
                );
            }
            return entries.filter(entry => getLoanDeviceReturnStatus(entry.link, loan) === 'pending').length;
        }

        async function applyReturnStatusToLinkedDevices(loan, returnQuantity, returnStatus) {
            const linkedDevices = getLinkedDevicesForLoan(loan.id);
            if (!linkedDevices.length) return;

            if (returnStatus === 'damaged') {
                await updateLoanDeviceStatuses(linkedDevices, 'Manutenção');
                await Promise.all(linkedDevices.map(device => recordDeviceMaintenanceEvent(device, device.status, 'Manutenção')));
                return;
            }

            if (returnStatus === 'incomplete') {
                const returnedDevices = linkedDevices.slice(0, Math.max(returnQuantity || 0, 0));
                if (returnedDevices.length) {
                    await updateLoanDeviceStatuses(returnedDevices, 'Disponível');
                }
                return;
            }

            await updateLoanDeviceStatuses(linkedDevices, 'Disponível');
        }

        function findOpenLoanForResponsible(classId, teacherId) {
            return data.loans
                .filter(loan =>
                    !loan.returned &&
                    parseInt(loan.class_id) === parseInt(classId) &&
                    parseInt(loan.teacher_id) === parseInt(teacherId)
                )
                .sort((a, b) => parseInt(b.id) - parseInt(a.id))[0] || null;
        }

        function buildLoanAdditionObservation(addition) {
            return [
                `Acréscimo em ${addition.dateTime} por ${addition.releaser}: +${addition.quantity} ${addition.deviceType}`,
                addition.observations ? `Obs.: ${addition.observations}` : ''
            ].filter(Boolean).join(' - ');
        }

        async function registerLoanAtomically(loan, devices, existingLoanId = null, mergeObservation = null) {
            const { data: registeredLoanId, error } = await client.rpc('register_device_loan', {
                p_class_id: loan.class_id,
                p_teacher_id: loan.teacher_id,
                p_device_type: loan.device_type,
                p_quantity: loan.quantity,
                p_loan_type: loan.loan_type,
                p_group_name: loan.group_name || '',
                p_date_time: loan.date_time,
                p_due_at: loan.due_at,
                p_releaser: loan.releaser,
                p_observations: existingLoanId ? mergeObservation : loan.observations,
                p_device_ids: devices.map(device => parseInt(device.id)),
                p_existing_loan_id: existingLoanId
            });
            if (error) throw error;
            return registeredLoanId;
        }

        async function registerUnnumberedQuantityLoan(loan, existingLoan = null, mergeObservation = null) {
            if (!existingLoan) {
                const { data: registeredLoan, error } = await client
                    .from('loans')
                    .insert(loan)
                    .select('id')
                    .single();
                if (error) throw error;
                return registeredLoan.id;
            }

            const { data: updatedLoan, error } = await client
                .from('loans')
                .update({
                    quantity: Number(existingLoan.quantity) + Number(loan.quantity),
                    device_type: existingLoan.device_type === loan.device_type
                        ? existingLoan.device_type
                        : 'Diversos',
                    loan_type: 'quantity',
                    group_name: null,
                    due_at: loan.due_at || existingLoan.due_at,
                    observations: [existingLoan.observations, mergeObservation]
                        .filter(Boolean)
                        .join('\n') || null
                })
                .eq('id', existingLoan.id)
                .eq('returned', false)
                .select('id')
                .maybeSingle();
            if (error) throw error;
            if (!updatedLoan) throw new Error('LOAN_ALREADY_RETURNED');
            return updatedLoan.id;
        }

        function getLoanRegistrationErrorMessage(error) {
            const message = error?.message || String(error || '');
            if (message.includes('SCHEDULE_GROUP_UNAVAILABLE')) {
                return 'Nenhum dispositivo dessa base está disponível. O empréstimo do agendamento não foi registrado.';
            }
            if (message.includes('DEVICE_NOT_AVAILABLE:')) {
                const deviceLabels = message.split('DEVICE_NOT_AVAILABLE:')[1]?.trim();
                return `O empréstimo não foi registrado porque outro usuário acabou de utilizar ${deviceLabels || 'um dos dispositivos selecionados'}. A lista será atualizada; tente novamente com os aparelhos disponíveis.`;
            }
            if (message.includes('LOAN_ALREADY_RETURNED')) {
                return 'O empréstimo aberto foi devolvido por outro usuário enquanto este registro era preenchido. A lista será atualizada.';
            }
            if (
                message.includes('register_device_loan') &&
                (message.includes('schema cache') || message.includes('Could not find'))
            ) {
                return 'A proteção contra registros simultâneos ainda não foi instalada no banco. Execute o arquivo protecao_emprestimos_simultaneos.sql no Supabase.';
            }
            return `Erro ao registrar empréstimo: ${message}`;
        }

        async function registerLoanFromWeeklyReservation(reservation, occurrence) {
            const selectedDevices = getAvailableDevicesForLoan(
                reservation.device_type,
                Number.MAX_SAFE_INTEGER,
                reservation.group_name
            );
            if (!selectedDevices.length) {
                throw new Error('SCHEDULE_GROUP_UNAVAILABLE');
            }

            const now = new Date();
            const dateTime =
                `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ` +
                `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const quantity = selectedDevices.length;
            const releaser = getCurrentActorName() || 'Agendamento semanal';
            const marker = getReservationLoanMarker(reservation, occurrence);
            const observations = [
                marker,
                `Empréstimo automático da ${reservation.group_name} pelo agendamento semanal.`,
                reservation.notes ? `Observação do agendamento: ${reservation.notes}` : ''
            ].filter(Boolean).join(' ');
            const existingOpenLoan = findOpenLoanForResponsible(
                reservation.class_id,
                reservation.teacher_id
            );
            const loan = {
                class_id: parseInt(reservation.class_id),
                teacher_id: parseInt(reservation.teacher_id),
                device_type: reservation.device_type,
                quantity,
                loan_type: 'full',
                group_name: reservation.group_name,
                date_time: dateTime,
                due_at: null,
                releaser,
                observations,
                returned: false
            };
            const mergeObservation = existingOpenLoan
                ? buildLoanAdditionObservation({
                    dateTime,
                    releaser,
                    quantity,
                    deviceType: reservation.device_type,
                    observations
                })
                : null;

            await registerLoanAtomically(
                loan,
                selectedDevices,
                existingOpenLoan?.id || null,
                mergeObservation
            );

            return {
                quantity,
                merged: Boolean(existingOpenLoan)
            };
        }

        // ------------------------------
        // 9. Formulários
        // ------------------------------
        document.getElementById('loanForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const classId = parseInt(document.getElementById('loanClass').value);
            const teacherId = parseInt(document.getElementById('loanTeacher').value);
            let deviceType = document.getElementById('loanDeviceType').value;
            const releaser = document.getElementById('loanReleaser').value;
            const obs = document.getElementById('loanObs').value;
            const dueAtValue = document.getElementById('loanDueAt').value;
            let dueAt = null;
            let quantity = 0;
            let groupName = '';
            let selectedLoanDevices = [];
            const selectedGroupName = currentLoanType === 'full'
                ? document.getElementById('loanGroup').value
                : '';
            const isTechCartLoan = currentLoanType === 'full' && isTechCartGroup(selectedGroupName);

            if (isFixedDevice(deviceType) && !isTechCartLoan) {
                alert('Desktops e Desktop Gestão são fixos na sala de informática e não podem ser emprestados.');
                return;
            }

            if (dueAtValue) {
                const parsedDueAt = new Date(dueAtValue);
                if (Number.isNaN(parsedDueAt.getTime()) || parsedDueAt.getTime() <= Date.now()) {
                    alert('A previsão de devolução deve estar no futuro.');
                    return;
                }
                dueAt = parsedDueAt.toISOString();
            }

            if (currentLoanType === 'quantity') {
                quantity = parseInt(document.getElementById('loanQuantity').value);
                if (!quantity || quantity < 1) {
                    alert('Informe uma quantidade válida de dispositivos.');
                    return;
                }

                if (pendingSpecificLoanDeviceId) {
                    const specificDevice = data.devices.find(device =>
                        parseInt(device.id) === parseInt(pendingSpecificLoanDeviceId)
                    );
                    if (
                        !specificDevice ||
                        specificDevice.status !== 'Disponível' ||
                        specificDevice.type !== deviceType
                    ) {
                        alert('O notebook selecionado não está mais disponível. Atualize a lista e tente novamente.');
                        await loadData();
                        return;
                    }
                    quantity = 1;
                    selectedLoanDevices = [specificDevice];
                }
            } else {
                groupName = selectedGroupName;
                if (!groupName) {
                    alert('Selecione um agrupamento para emprestar a base completa.');
                    return;
                }
                const loanableDevices = isTechCartLoan
                    ? sortDevicesForDisplay(data.devices).filter(device =>
                        device.group === groupName &&
                        device.status === 'Disponível'
                    )
                    : getAvailableDevicesForLoan(deviceType, Number.MAX_SAFE_INTEGER, groupName);
                selectedLoanDevices = loanableDevices;
                if (!loanableDevices.length) {
                    alert('Esse agrupamento não possui dispositivos que possam ser emprestados.');
                    return;
                }
                quantity = loanableDevices.filter(d => d.status === 'Disponível').length || loanableDevices.length;

                if (isTechCartLoan) {
                    const deviceTypes = [...new Set(loanableDevices.map(device => device.type).filter(Boolean))];
                    deviceType = deviceTypes.length === 1 ? deviceTypes[0] : 'Carrinho TEC';
                    const confirmed = confirm(
                        `O agrupamento "${groupName}" contém ${quantity} dispositivo(s) e normalmente permanece fixo.\n\n` +
                        'Tem certeza de que deseja registrar o empréstimo do Carrinho TEC completo?'
                    );
                    if (!confirmed) return;
                }
            }

            const now = new Date();
            const dateTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth()+1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const existingOpenLoan = findOpenLoanForResponsible(classId, teacherId);
            const newLoanTracksDeviceNumbers = selectedLoanDevices.length > 0;
            const existingLoanTracksDeviceNumbers = existingOpenLoan
                ? getLoanDeviceEntries(existingOpenLoan.id).length > 0
                : false;
            const canMergeWithOpenLoan = existingOpenLoan &&
                newLoanTracksDeviceNumbers === existingLoanTracksDeviceNumbers;
            let shouldMergeWithOpenLoan = false;

            if (canMergeWithOpenLoan) {
                const className = data.classes.find(item => parseInt(item.id) === classId)?.name || 'turma selecionada';
                const teacherName = data.teachers.find(item => parseInt(item.id) === teacherId)?.name || 'professor selecionado';
                shouldMergeWithOpenLoan = confirm(
                    `Já existe um empréstimo em aberto para ${teacherName} na turma ${className}, com ${existingOpenLoan.quantity} dispositivo(s).\n\n` +
                    `Deseja adicionar estes ${quantity} dispositivo(s) ao mesmo empréstimo?\n\n` +
                    'Clique em Cancelar para criar um registro separado.'
                );
            }

            const loan = {
                class_id: classId,
                teacher_id: teacherId,
                device_type: deviceType,
                quantity,
                loan_type: pendingSpecificLoanDeviceId ? 'specific' : currentLoanType,
                group_name: groupName,
                date_time: dateTime,
                due_at: dueAt,
                releaser,
                observations: obs,
                returned: false
            };

            try {
                const mergeObservation = shouldMergeWithOpenLoan
                    ? buildLoanAdditionObservation({
                        dateTime,
                        releaser,
                        quantity,
                        deviceType,
                        observations: obs
                    })
                    : null;

                if (newLoanTracksDeviceNumbers) {
                    await registerLoanAtomically(
                        loan,
                        selectedLoanDevices,
                        shouldMergeWithOpenLoan ? existingOpenLoan.id : null,
                        mergeObservation
                    );
                } else {
                    await registerUnnumberedQuantityLoan(
                        loan,
                        shouldMergeWithOpenLoan ? existingOpenLoan : null,
                        mergeObservation
                    );
                }

                await showAppAlert(
                    shouldMergeWithOpenLoan
                        ? `${quantity} dispositivo(s) adicionado(s) ao empréstimo em aberto.`
                        : 'Empréstimo registrado com sucesso!',
                    { type: 'success' }
                );
                this.reset();
                clearSpecificLoanSelection();
                await loadData();
                if (isAlunoAccess()) {
                    await logout();
                    return;
                }
                showScreen('dashboard');
            } catch (error) {
                console.error('Erro ao registrar empréstimo:', error);
                alert(getLoanRegistrationErrorMessage(error));
                await loadData();
            }
        });
