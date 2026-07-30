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

        function renderReturnDeviceSelection(loan) {
            const entries = getLoanDeviceEntries(loan.id);
            const selection = document.getElementById('returnDeviceSelection');
            const quantityGroup = document.getElementById('returnQuantityGroup');
            const statusGroup = document.getElementById('returnStatusGroup');

            selection.style.display = entries.length ? 'block' : 'none';
            quantityGroup.style.display = entries.length ? 'none' : '';
            statusGroup.style.display = entries.length ? 'none' : '';

            if (!entries.length) {
                document.getElementById('returnDeviceList').innerHTML = '';
                document.getElementById('returnDeviceSummary').innerHTML = '';
                return;
            }

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
                        return_observations: returnObs || null
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
                recordDeviceMaintenanceEvent(device, device.status, 'Manutenção')
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
                    returnObs
                )
            }).eq('id', loan.id);
            if (loanError) throw loanError;

            const message = isComplete
                ? `Devolução concluída. ${processedCount} dispositivo(s) processado(s).`
                : `Devolução parcial registrada. Ainda faltam ${pendingCount} dispositivo(s).`;
            await showAppAlert(message, { type: 'success' });
        }

        async function confirmReturn() {
            const loanId = parseInt(document.getElementById('returnLoan').value);
            if (!loanId) return;
            const loan = data.loans.find(item => parseInt(item.id) === loanId);
            if (!loan) return;

            const hasIndividualDevices = getLoanDeviceEntries(loan.id).length > 0;
            const returnQty = parseInt(document.getElementById('returnQuantity').value);
            const returnStatus = document.getElementById('returnStatus').value;
            const returnObs = document.getElementById('returnObs').value;
            const now = new Date();
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

                if (!returnQty || returnQty < 1 || returnQty > Number(loan.quantity)) {
                    alert(`Informe uma quantidade entre 1 e ${loan.quantity}.`);
                    return;
                }

                const { error } = await client.from('loans').update({
                    returned: true,
                    return_date_time: returnDateTime,
                    return_quantity: returnQty,
                    return_status: returnStatus,
                    return_observations: returnObs
                }).eq('id', loanId);

                if (error) throw error;
                await applyReturnStatusToLinkedDevices(loan, returnQty, returnStatus);

                await showAppAlert('Devolução registrada com sucesso!', { type: 'success' });
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
