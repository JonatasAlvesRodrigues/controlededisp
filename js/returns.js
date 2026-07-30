// returns.js - application script.
function updateReturnSelect() {
            let options = '<option value="">Selecione um empréstimo ativo</option>';
            data.loans.filter(l => !l.returned).forEach(loan => {
                const className = data.classes.find(c => c.id === loan.class_id)?.name;
                const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name;
                const pendingQuantity = getLoanPendingQuantity(loan);
                options += `<option value="${loan.id}">${className} - ${teacherName} (${pendingQuantity} pendente(s) - ${loan.date_time})</option>`;
            });
            document.getElementById('returnLoan').innerHTML = options;
        }

        function updateReturnDeviceSummary() {
            const selects = [...document.querySelectorAll('.return-device-status')];
            const counts = selects.reduce((summary, select) => {
                summary[select.value] = (summary[select.value] || 0) + 1;
                return summary;
            }, { pending: 0, returned: 0, damaged: 0 });

            document.getElementById('returnDeviceSummary').innerHTML = `
                <span class="badge yellow">${counts.pending} pendente(s)</span>
                <span class="badge green">${counts.returned} devolvido(s)</span>
                <span class="badge red">${counts.damaged} com danos</span>
            `;
        }

        function getCurrentReturnLoan() {
            const loanId = parseInt(document.getElementById('returnLoan').value);
            return data.loans.find(item => parseInt(item.id) === loanId) || null;
        }

        function getDamageDeviceCandidates(loan) {
            const activeOtherLoanIds = new Set(
                data.loans
                    .filter(item => !item.returned && parseInt(item.id) !== parseInt(loan.id))
                    .map(item => parseInt(item.id))
            );
            const linkedToOtherLoanIds = new Set(
                (data.loanDevices || [])
                    .filter(link =>
                        activeOtherLoanIds.has(parseInt(link.loan_id)) &&
                        getLoanDeviceReturnStatus(link) === 'pending'
                    )
                    .map(link => parseInt(link.device_id))
            );

            return sortDevicesForDisplay(data.devices).filter(device =>
                (loan.device_type === 'Diversos' || device.type === loan.device_type) &&
                !isFixedDevice(device.type) &&
                device.status !== 'Fora de uso' &&
                device.status !== 'Manutenção' &&
                !linkedToOtherLoanIds.has(parseInt(device.id))
            );
        }

        function updateReturnDamageFields() {
            const section = document.getElementById('returnDamageDeviceSection');
            const fields = document.getElementById('returnDamageDeviceFields');
            if (!section || !fields) return;

            const loan = getCurrentReturnLoan();
            const hasVisibleIndividualDevices = loan &&
                getLoanDeviceEntries(loan.id).length > 0 &&
                shouldShowLoanDeviceNumbers(loan);
            const shouldIdentifyDamage = loan &&
                !hasVisibleIndividualDevices &&
                document.getElementById('returnStatus').value === 'damaged';

            section.style.display = shouldIdentifyDamage ? 'block' : 'none';
            if (!shouldIdentifyDamage) {
                fields.innerHTML = '';
                return;
            }

            const pendingQuantity = getLoanPendingQuantity(loan);
            const returnedQuantity = Math.min(
                Math.max(parseInt(document.getElementById('returnQuantity').value) || 1, 1),
                Math.max(pendingQuantity, 1)
            );
            const requestedQuantity = parseInt(document.getElementById('returnDamageQuantity').value);
            const damageQuantity = Math.min(
                Math.max(Number.isInteger(requestedQuantity) ? requestedQuantity : 1, 1),
                returnedQuantity
            );
            const previousValues = fields.querySelectorAll
                ? [...fields.querySelectorAll('.return-damaged-device')].map(select => select.value)
                : [];
            const candidates = getDamageDeviceCandidates(loan);
            const options = candidates.map(device => `
                <option value="${device.id}">
                    ${escapeHtml(`${device.type} · ${getDeviceIdentityLabel(device)}${device.group ? ` · ${device.group}` : ''}`)}
                </option>
            `).join('');

            const availabilityWarning = candidates.length < damageQuantity
                ? `<div class="field-hint" style="color: #dc2626;">Há somente ${candidates.length} dispositivo(s) elegível(is). Reduza a quantidade com danos ou confira o cadastro.</div>`
                : '';
            fields.innerHTML = availabilityWarning + Array.from({ length: damageQuantity }, (_, index) => `
                <div class="return-damage-device-row">
                    <label for="returnDamagedDevice${index}">Dispositivo com danos ${index + 1}</label>
                    <select id="returnDamagedDevice${index}" class="form-input return-damaged-device" required>
                        <option value="">Selecione o dispositivo</option>
                        ${options}
                    </select>
                </div>
            `).join('');

            [...fields.querySelectorAll('.return-damaged-device')].forEach((select, index) => {
                if (previousValues[index] && candidates.some(device =>
                    parseInt(device.id) === parseInt(previousValues[index])
                )) {
                    select.value = previousValues[index];
                }
            });
        }

        function getSelectedDamagedReturnDevices(expectedQuantity) {
            const selects = [...document.querySelectorAll('.return-damaged-device')];
            const selectedIds = selects.map(select => parseInt(select.value)).filter(Number.isInteger);
            if (selectedIds.length !== expectedQuantity) {
                alert(`Identifique os ${expectedQuantity} dispositivo(s) com danos.`);
                return null;
            }
            if (new Set(selectedIds).size !== selectedIds.length) {
                alert('Cada dispositivo com danos deve ser selecionado apenas uma vez.');
                return null;
            }

            const selectedDevices = selectedIds
                .map(id => data.devices.find(device => parseInt(device.id) === id))
                .filter(Boolean);
            if (selectedDevices.length !== expectedQuantity) {
                alert('Um dos dispositivos informados não foi encontrado. Atualize os dados e tente novamente.');
                return null;
            }
            return selectedDevices;
        }

        function renderReturnDeviceSelection(loan) {
            const entries = getLoanDeviceEntries(loan.id);
            const showIndividualDevices = entries.length > 0 && shouldShowLoanDeviceNumbers(loan);
            const selection = document.getElementById('returnDeviceSelection');
            const quantityGroup = document.getElementById('returnQuantityGroup');
            const statusGroup = document.getElementById('returnStatusGroup');

            selection.style.display = showIndividualDevices ? 'block' : 'none';
            quantityGroup.style.display = showIndividualDevices ? 'none' : '';
            statusGroup.style.display = showIndividualDevices ? 'none' : '';

            if (!showIndividualDevices) {
                document.getElementById('returnDeviceList').innerHTML = '';
                document.getElementById('returnDeviceSummary').innerHTML = '';
                updateReturnDamageFields();
                return;
            }

            document.getElementById('returnDamageDeviceSection').style.display = 'none';
            document.getElementById('returnDamageDeviceFields').innerHTML = '';

            document.getElementById('returnDeviceList').innerHTML = entries.map(({ link, device }) => {
                const status = getLoanDeviceReturnStatus(link, loan);
                const isProcessed = status !== 'pending';
                const processedMeta = isProcessed
                    ? [
                        link.returned_at ? formatDateTimeBR(new Date(link.returned_at)) : '',
                        link.returned_by || ''
                    ].filter(Boolean).join(' por ')
                    : '';

                return `
                    <div class="return-device-item ${isProcessed ? 'processed' : ''}">
                        <div>
                            <div class="return-device-name">${escapeHtml(device.type || 'Dispositivo')}</div>
                            <div class="return-device-meta">${escapeHtml(getDeviceIdentityLabel(device))}</div>
                            ${device.group ? `<div class="return-device-meta">Agrupamento: ${escapeHtml(device.group)}</div>` : ''}
                            ${processedMeta ? `<div class="return-device-meta">Processado em ${escapeHtml(processedMeta)}</div>` : ''}
                        </div>
                        <select
                            class="form-input return-device-status"
                            data-loan-device-id="${escapeHtml(String(link.id))}"
                            data-device-id="${escapeHtml(String(device.id))}"
                            data-original-status="${escapeHtml(status)}"
                            onchange="updateReturnDeviceSummary()"
                            ${isProcessed ? 'disabled' : ''}
                        >
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Ainda não devolvido</option>
                            <option value="returned" ${status === 'returned' ? 'selected' : ''}>Devolvido</option>
                            <option value="damaged" ${status === 'damaged' ? 'selected' : ''}>Com danos</option>
                        </select>
                    </div>
                `;
            }).join('');

            updateReturnDeviceSummary();
        }

        function loadReturnDetails() {
            const loanId = parseInt(document.getElementById('returnLoan').value);
            if (!loanId) {
                document.getElementById('returnDetails').style.display = 'none';
                return;
            }
            const loan = data.loans.find(l => l.id === loanId);
            if (!loan) return;

            document.getElementById('returnClassName').textContent = data.classes.find(c => c.id === loan.class_id)?.name;
            document.getElementById('returnTeacherName').textContent = data.teachers.find(t => t.id === loan.teacher_id)?.name;
            const pendingQuantity = getLoanPendingQuantity(loan);
            document.getElementById('returnQtyLoan').textContent = pendingQuantity === Number(loan.quantity)
                ? `${loan.quantity} dispositivos`
                : `${pendingQuantity} pendente(s) de ${loan.quantity}`;
            document.getElementById('returnDateLoan').textContent = loan.date_time;
            const dueDate = parseLoanDueAt(loan);
            const deadline = getLoanDeadlineInfo(loan);
            const returnDueLoan = document.getElementById('returnDueLoan');
            returnDueLoan.textContent = dueDate ? deadline.detail.replace('Prazo: ', '') : 'Sem prazo';
            returnDueLoan.style.color = deadline.key === 'overdue'
                ? '#dc2626'
                : deadline.key === 'due-soon'
                    ? '#d97706'
                    : '';
            document.getElementById('returnQuantity').value = pendingQuantity;
            document.getElementById('returnStatus').value = 'complete';
            document.getElementById('returnDamageQuantity').value = 1;
            document.getElementById('returnObs').value = '';
            renderReturnDeviceSelection(loan);
            document.getElementById('returnDetails').style.display = 'block';
        }

        function startReturnFromDevice(deviceId) {
            const device = data.devices.find(item => parseInt(item.id) === parseInt(deviceId));
            if (!device) return;
            const activeLoan = getDeviceRelatedLoans(device).find(loan =>
                !loan.returned && isDevicePendingInLoan(device.id, loan.id)
            );
            if (!activeLoan) {
                alert('Este dispositivo não possui empréstimo ativo para devolução.');
                return;
            }

            showScreen('return');
            document.getElementById('returnLoan').value = activeLoan.id;
            loadReturnDetails();
        }


        function appendLoanReturnObservation(loan, returnDateTime, returnedBy, selectedCount, returnObs) {
            const batchDetails = [
                `Devolução em ${returnDateTime}`,
                returnedBy ? `por ${returnedBy}` : '',
                `${selectedCount} dispositivo(s) processado(s)`,
                returnObs ? `Obs.: ${returnObs}` : ''
            ].filter(Boolean).join(' - ');

            return [loan.return_observations, batchDetails].filter(Boolean).join('\n');
        }

        async function confirmIndividualReturn(loan) {
            const editableSelects = [...document.querySelectorAll('.return-device-status')]
                .filter(select => select.dataset.originalStatus === 'pending');
            const selectedItems = editableSelects
                .filter(select => select.value === 'returned' || select.value === 'damaged')
                .map(select => ({
                    loanDeviceId: parseInt(select.dataset.loanDeviceId),
                    deviceId: parseInt(select.dataset.deviceId),
                    status: select.value
                }));

            if (!selectedItems.length) {
                alert('Selecione pelo menos um dispositivo como devolvido ou com danos.');
                return;
            }

            const returnObs = document.getElementById('returnObs').value.trim();
            if (selectedItems.some(item => item.status === 'damaged') && !returnObs) {
                alert('Descreva nas observações o dano encontrado.');
                return;
            }
            const damagedDeviceLabels = selectedItems
                .filter(item => item.status === 'damaged')
                .map(item => data.devices.find(device => parseInt(device.id) === item.deviceId))
                .filter(Boolean)
                .map(device => getDeviceIdentityLabel(device));
            const combinedReturnObs = [
                returnObs,
                damagedDeviceLabels.length
                    ? `Dispositivo(s) com danos: ${damagedDeviceLabels.join('; ')}`
                    : ''
            ].filter(Boolean).join(' — ');
            const now = new Date();
            const returnedAt = now.toISOString();
            const returnDateTime = now.toLocaleString('pt-BR');
            const returnedBy = getCurrentActorName();

            for (const status of ['returned', 'damaged']) {
                const items = selectedItems.filter(item => item.status === status);
                if (!items.length) continue;

                const { error } = await client
                    .from('loan_devices')
                    .update({
                        return_status: status,
                        returned_at: returnedAt,
                        returned_by: returnedBy,
                        return_observations: combinedReturnObs || null
                    })
                    .in('id', items.map(item => item.loanDeviceId));
                if (error) throw error;
            }

            const returnedDevices = selectedItems
                .filter(item => item.status === 'returned')
                .map(item => data.devices.find(device => parseInt(device.id) === item.deviceId))
                .filter(Boolean);
            const damagedDevices = selectedItems
                .filter(item => item.status === 'damaged')
                .map(item => data.devices.find(device => parseInt(device.id) === item.deviceId))
                .filter(Boolean);

            await updateLoanDeviceStatuses(returnedDevices, 'Disponível');
            await updateLoanDeviceStatuses(damagedDevices, 'Manutenção');
            await Promise.all(damagedDevices.map(device =>
                recordDeviceMaintenanceEvent(device, device.status, 'Manutenção', combinedReturnObs)
            ));

            const selectedStatusByLinkId = new Map(
                selectedItems.map(item => [item.loanDeviceId, item.status])
            );
            const finalStatuses = getLoanDeviceEntries(loan.id).map(({ link }) =>
                selectedStatusByLinkId.get(parseInt(link.id)) || getLoanDeviceReturnStatus(link, loan)
            );
            const pendingCount = finalStatuses.filter(status => status === 'pending').length;
            const processedCount = finalStatuses.length - pendingCount;
            const damagedCount = finalStatuses.filter(status => status === 'damaged').length;
            const isComplete = pendingCount === 0;

            const { error: loanError } = await client.from('loans').update({
                returned: isComplete,
                return_date_time: returnDateTime,
                return_quantity: processedCount,
                return_status: isComplete
                    ? (damagedCount ? 'damaged' : 'complete')
                    : 'incomplete',
                return_observations: appendLoanReturnObservation(
                    loan,
                    returnDateTime,
                    returnedBy,
                    selectedItems.length,
                    combinedReturnObs
                )
            }).eq('id', loan.id);
            if (loanError) throw loanError;

            const message = isComplete
                ? `Devolução concluída. ${processedCount} dispositivo(s) processado(s).`
                : `Devolução parcial registrada. Ainda faltam ${pendingCount} dispositivo(s).`;
            await showAppAlert(message, { type: 'success' });
        }

        async function processHiddenLinkedDeviceReturn(
            loan,
            returnQuantity,
            returnObservations,
            returnedAt,
            returnedBy
        ) {
            const pendingEntries = getLoanDeviceEntries(loan.id)
                .filter(({ link }) => getLoanDeviceReturnStatus(link, loan) === 'pending')
                .slice(0, returnQuantity);
            if (!pendingEntries.length) return;

            // Em empréstimos antigos por quantidade, os vínculos individuais foram
            // criados automaticamente e não representam necessariamente os aparelhos
            // entregues. Eles são encerrados sem atribuir o dano a um número aleatório.
            const individualStatus = 'returned';
            const { error } = await client
                .from('loan_devices')
                .update({
                    return_status: individualStatus,
                    returned_at: returnedAt,
                    returned_by: returnedBy,
                    return_observations: returnObservations || null
                })
                .in('id', pendingEntries.map(({ link }) => link.id));
            if (error) throw error;

            const affectedDevices = pendingEntries.map(({ device }) => device);
            await updateLoanDeviceStatuses(affectedDevices, 'Disponível');
        }

        async function recordReportedDamagedDevices(devices, returnObservations) {
            if (!devices.length) return;
            await updateLoanDeviceStatuses(devices, 'Manutenção');
            await Promise.all(devices.map(device =>
                recordDeviceMaintenanceEvent(
                    device,
                    device.status,
                    'Manutenção',
                    returnObservations
                )
            ));
        }

        async function returnEverything() {
            const loanId = parseInt(document.getElementById('returnLoan').value);
            const loan = data.loans.find(item => parseInt(item.id) === loanId);
            if (!loan) return;

            const pendingQuantity = getLoanPendingQuantity(loan);
            if (!pendingQuantity) {
                await showAppAlert('Este empréstimo não possui dispositivos pendentes.', { type: 'info' });
                return;
            }
            if (!confirm(`Confirmar a devolução de todos os ${pendingQuantity} dispositivo(s) pendente(s)?`)) {
                return;
            }

            const hasVisibleIndividualDevices =
                getLoanDeviceEntries(loan.id).length > 0 &&
                shouldShowLoanDeviceNumbers(loan);
            if (hasVisibleIndividualDevices) {
                document.querySelectorAll('.return-device-status').forEach(select => {
                    if (!select.disabled && select.dataset.originalStatus === 'pending') {
                        select.value = 'returned';
                    }
                });
                updateReturnDeviceSummary();
            } else {
                document.getElementById('returnQuantity').value = pendingQuantity;
                document.getElementById('returnStatus').value = 'complete';
            }

            await confirmReturn();
        }

        async function confirmReturn() {
            const loanId = parseInt(document.getElementById('returnLoan').value);
            if (!loanId) return;
            const loan = data.loans.find(item => parseInt(item.id) === loanId);
            if (!loan) return;

            const hasIndividualDevices =
                getLoanDeviceEntries(loan.id).length > 0 &&
                shouldShowLoanDeviceNumbers(loan);
            const returnQty = parseInt(document.getElementById('returnQuantity').value);
            const returnStatus = document.getElementById('returnStatus').value;
            const returnObs = document.getElementById('returnObs').value;
            const now = new Date();
            const returnedAt = now.toISOString();
            const returnDateTime = now.toLocaleString('pt-BR');

            try {
                if (hasIndividualDevices) {
                    await confirmIndividualReturn(loan);
                    await loadData();
                    if (isAlunoAccess()) {
                        await logout();
                        return;
                    }
                    showScreen('dashboard');
                    return;
                }

                const pendingQuantity = getLoanPendingQuantity(loan);
                if (!returnQty || returnQty < 1 || returnQty > pendingQuantity) {
                    alert(`Informe uma quantidade entre 1 e ${pendingQuantity}.`);
                    return;
                }

                let damagedDevices = [];
                if (returnStatus === 'damaged') {
                    if (!returnObs.trim()) {
                        alert('Descreva nas observações o dano encontrado.');
                        return;
                    }
                    const damageQuantity = parseInt(
                        document.getElementById('returnDamageQuantity').value
                    );
                    if (!damageQuantity || damageQuantity < 1 || damageQuantity > returnQty) {
                        alert(`Informe uma quantidade com danos entre 1 e ${returnQty}.`);
                        return;
                    }
                    damagedDevices = getSelectedDamagedReturnDevices(damageQuantity);
                    if (!damagedDevices) return;
                }
                const damagedDeviceLabels = damagedDevices.map(device =>
                    getDeviceIdentityLabel(device)
                );
                const combinedReturnObs = [
                    returnObs.trim(),
                    damagedDeviceLabels.length
                        ? `Dispositivo(s) com danos: ${damagedDeviceLabels.join('; ')}`
                        : ''
                ].filter(Boolean).join(' — ');
                const previousReturnedQuantity = Number(loan.return_quantity) || 0;
                const totalReturnedQuantity = Math.min(
                    previousReturnedQuantity + returnQty,
                    Number(loan.quantity)
                );
                const isComplete = totalReturnedQuantity >= Number(loan.quantity);
                const hasRecordedDamage =
                    returnStatus === 'damaged' ||
                    String(loan.return_observations || '').includes('Dispositivo(s) com danos:');
                const effectiveReturnStatus = isComplete
                    ? (hasRecordedDamage ? 'damaged' : 'complete')
                    : 'incomplete';
                const { error } = await client.from('loans').update({
                    returned: isComplete,
                    return_date_time: returnDateTime,
                    return_quantity: totalReturnedQuantity,
                    return_status: effectiveReturnStatus,
                    return_observations: appendLoanReturnObservation(
                        loan,
                        returnDateTime,
                        getCurrentActorName(),
                        returnQty,
                        combinedReturnObs
                    )
                }).eq('id', loanId);

                if (error) throw error;
                await processHiddenLinkedDeviceReturn(
                    loan,
                    returnQty,
                    combinedReturnObs,
                    returnedAt,
                    getCurrentActorName()
                );
                await recordReportedDamagedDevices(damagedDevices, combinedReturnObs);

                await showAppAlert(
                    isComplete
                        ? 'Devolução total registrada com sucesso!'
                        : `Devolução parcial registrada. Ainda faltam ${Number(loan.quantity) - totalReturnedQuantity} dispositivo(s).`,
                    { type: 'success' }
                );
                await loadData();
                if (isAlunoAccess()) {
                    await logout();
                    return;
                }
                showScreen('dashboard');
            } catch (error) {
                console.error('Erro ao registrar devolução:', error);
                alert('Erro ao registrar devolução: ' + error.message);
            }
        }
