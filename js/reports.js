// reports.js - application script.
function getJsPdfInstance() {
            const jsPDF = window.jspdf?.jsPDF;
            if (!jsPDF) {
                throw new Error('Biblioteca de PDF indisponível. Verifique a conexão com a internet.');
            }
            return jsPDF;
        }

        function getLabelSizeValue() {
            const activeValue = document.activeElement?.matches?.('[data-label-size-control]')
                ? document.activeElement.value
                : '';
            const storedValue = localStorage.getItem(LABEL_SIZE_KEY) || '';
            const firstControlValue = document.querySelector('[data-label-size-control]')?.value || '';
            const value = activeValue || storedValue || firstControlValue || '100x70';
            return ['100x70', '90x60', '80x50'].includes(value) ? value : '100x70';
        }

        function syncLabelSizeControls() {
            const value = getLabelSizeValue();
            document.querySelectorAll('[data-label-size-control]').forEach(control => {
                control.value = value;
            });
        }

        function setLabelSizeValue(value) {
            const safeValue = ['100x70', '90x60', '80x50'].includes(value) ? value : '100x70';
            localStorage.setItem(LABEL_SIZE_KEY, safeValue);
            syncLabelSizeControls();
        }

        function getSelectedLabelSize() {
            const value = getLabelSizeValue();
            const [width, height] = value.split('x').map(Number);
            return { width: width || 100, height: height || 70 };
        }

        function getLabelSchoolName(device) {
            return device.school_name || 'Escola Percio';
        }

        let patrimonyLabelLogoPromise = null;

        function getPatrimonyLabelLogo() {
            if (patrimonyLabelLogoPromise) {
                return patrimonyLabelLogoPromise;
            }

            patrimonyLabelLogoPromise = new Promise((resolve) => {
                const image = new Image();
                image.onload = () => {
                    try {
                        const sourceCanvas = document.createElement('canvas');
                        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
                        sourceCanvas.width = image.naturalWidth;
                        sourceCanvas.height = image.naturalHeight;
                        sourceContext.drawImage(image, 0, 0);

                        const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
                        const data = imageData.data;
                        let minX = sourceCanvas.width;
                        let minY = sourceCanvas.height;
                        let maxX = 0;
                        let maxY = 0;

                        for (let py = 0; py < sourceCanvas.height; py++) {
                            for (let px = 0; px < sourceCanvas.width; px++) {
                                const index = (py * sourceCanvas.width + px) * 4;
                                const alpha = data[index + 3];
                                const isInk = alpha > 10 && (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245);
                                if (isInk) {
                                    minX = Math.min(minX, px);
                                    minY = Math.min(minY, py);
                                    maxX = Math.max(maxX, px);
                                    maxY = Math.max(maxY, py);
                                }
                            }
                        }

                        if (minX > maxX || minY > maxY) {
                            resolve({ dataUrl: sourceCanvas.toDataURL('image/png'), width: sourceCanvas.width, height: sourceCanvas.height });
                            return;
                        }

                        const margin = 16;
                        minX = Math.max(0, minX - margin);
                        minY = Math.max(0, minY - margin);
                        maxX = Math.min(sourceCanvas.width - 1, maxX + margin);
                        maxY = Math.min(sourceCanvas.height - 1, maxY + margin);

                        const cropW = maxX - minX + 1;
                        const cropH = maxY - minY + 1;
                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = cropW;
                        cropCanvas.height = cropH;
                        cropCanvas.getContext('2d').drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
                        resolve({ dataUrl: cropCanvas.toDataURL('image/png'), width: cropW, height: cropH });
                    } catch (error) {
                        console.warn('Falha ao preparar logo da etiqueta:', error);
                        resolve(null);
                    }
                };
                image.onerror = () => resolve(null);
                image.src = './logo-percio.jpg';
            });

            return patrimonyLabelLogoPromise;
        }

        function getLabelModelBrand(device) {
            const brand = device.brand || '';
            const model = device.model || '';
            return [brand, model].filter(Boolean).join(' ') || device.type || '-';
        }

        function getLabelPatrimony(device) {
            return device.patrimony || device.counter_number || `DISP-${device.id}`;
        }

        function getLabelFilteredDevices() {
            const selectedType = document.getElementById('labelDeviceType')?.value || '';
            return sortDevicesForDisplay(data.devices).filter(device => !selectedType || device.type === selectedType);
        }

        function getSelectedLabelDevices() {
            return sortDevicesForDisplay(data.devices).filter(device => selectedLabelDeviceIds.has(parseInt(device.id)));
        }

        function toggleLabelDeviceSelection(deviceId, checked) {
            const parsedId = parseInt(deviceId);
            if (checked) {
                selectedLabelDeviceIds.add(parsedId);
            } else {
                selectedLabelDeviceIds.delete(parsedId);
            }
            syncLabelSelectionControls();
        }

        function toggleAllVisibleLabelDevices(checked) {
            getFilteredDevices().forEach(device => {
                if (checked) {
                    selectedLabelDeviceIds.add(parseInt(device.id));
                } else {
                    selectedLabelDeviceIds.delete(parseInt(device.id));
                }
            });
            updateDevicesTable();
            updateDevicesCards();
        }

        function syncLabelSelectionControls() {
            document.querySelectorAll('[data-label-device-id]').forEach(input => {
                input.checked = selectedLabelDeviceIds.has(parseInt(input.dataset.labelDeviceId));
            });
            const allVisible = getFilteredDevices();
            const toggle = document.getElementById('selectAllLabelsToggle');
            if (toggle) {
                toggle.checked = allVisible.length > 0 && allVisible.every(device => selectedLabelDeviceIds.has(parseInt(device.id)));
            }
        }

        function generateBarcodeDataUrl(value) {
            if (!window.JsBarcode) {
                throw new Error('Biblioteca de código de barras indisponível.');
            }
            const canvas = document.createElement('canvas');
            window.JsBarcode(canvas, value, {
                format: 'CODE128',
                displayValue: false,
                margin: 0,
                width: 2,
                height: 70
            });
            return canvas.toDataURL('image/png');
        }

        async function generateQrCodeDataUrl(value) {
            const qrValue = String(value || '');

            if (window.QRCode?.toDataURL) {
                try {
                    return await window.QRCode.toDataURL(qrValue, {
                        errorCorrectionLevel: 'M',
                        margin: 1,
                        width: 220,
                        color: { dark: '#000000', light: '#ffffff' }
                    });
                } catch (error) {
                    console.warn('Falha ao gerar QR Code com qrcode:', error);
                }
            }

            if (window.QRious) {
                try {
                    const qr = new window.QRious({
                        value: qrValue,
                        size: 220,
                        level: 'M',
                        padding: 8,
                        foreground: '#000000',
                        background: '#ffffff'
                    });
                    return qr.toDataURL('image/png');
                } catch (error) {
                    console.warn('Falha ao gerar QR Code com QRious:', error);
                }
            }

            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(qrValue)}`;
            const response = await fetch(qrUrl);
            if (!response.ok) {
                throw new Error('Não foi possível gerar o QR Code.');
            }

            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Não foi possível converter o QR Code.'));
                reader.readAsDataURL(blob);
            });
        }

        function fitPdfText(doc, text, x, y, maxWidth, options = {}) {
            const safeText = (text || '-').toString();
            let fontSize = options.fontSize || 10;
            const minFontSize = options.minFontSize || 6;
            doc.setFontSize(fontSize);
            while (doc.getTextWidth(safeText) > maxWidth && fontSize > minFontSize) {
                fontSize -= 0.5;
                doc.setFontSize(fontSize);
            }
            if (options.align) {
                doc.text(safeText, x, y, { align: options.align });
            } else {
                doc.text(safeText, x, y);
            }
        }

        function drawLabelField(doc, icon, label, value, x, y, width) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(icon, x, y + 5);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text(label, x + 10, y + 2.5);
            doc.setFontSize(9);
            fitPdfText(doc, value, x + 10, y + 9, width - 10, { fontSize: 9, minFontSize: 6 });
        }

        async function drawPatrimonyLabel(doc, device, x, y, width, height) {
            const patrimony = getLabelPatrimony(device);
            const schoolName = getLabelSchoolName(device);
            const modelBrand = getLabelModelBrand(device);
            const serial = device.serial_number || '-';
            const counterNumber = device.counter_number || '-';
            const location = device.group || '-';
            const createdAt = device.created_at ? formatDateBR(new Date(device.created_at)) : formatDateBR(new Date());
            const barcodeDataUrl = generateBarcodeDataUrl(patrimony);
            const qrDataUrl = await generateQrCodeDataUrl(getDeviceDetailUrl(device.id));
            const logo = await getPatrimonyLabelLogo();

            {
            const pad = Math.max(3, width * 0.04);
            const innerX = x + pad;
            const innerY = y + pad;
            const innerW = width - pad * 2;
            const headerH = Math.max(15, height * 0.3);
            const footerH = Math.max(4, height * 0.07);
            const footerY = y + height - pad - footerH;
            const infoY = innerY + headerH + 4;
            const compactLabel = height <= 60;
            const maxCodeH = Math.max(7, Math.min(10, height * 0.14));
            const preferredCodeY = innerY + headerH + (compactLabel ? 14 : 26);
            const codeY = Math.min(preferredCodeY, footerY - maxCodeH - 4);
            const leftW = innerW * 0.42;
            const rightX = innerX + leftW + 5;
            const rightW = innerX + innerW - rightX;

            doc.setDrawColor(0);
            doc.setLineWidth(0.45);
            doc.roundedRect(x, y, width, height, 2, 2);
            doc.line(innerX, innerY + headerH, innerX + innerW, innerY + headerH);

            doc.setTextColor(0);
            if (logo?.dataUrl) {
                const logoMaxW = leftW;
                const logoMaxH = headerH - 2;
                const logoRatio = logo.width / logo.height;
                let logoW = logoMaxW;
                let logoH = logoW / logoRatio;

                if (logoH > logoMaxH) {
                    logoH = logoMaxH;
                    logoW = logoH * logoRatio;
                }

                doc.addImage(logo.dataUrl, 'PNG', innerX + (leftW - logoW) / 2, innerY + (headerH - logoH) / 2 - 0.5, logoW, logoH);
            } else {
                doc.setFont('helvetica', 'bold');
                fitPdfText(doc, schoolName, innerX + leftW / 2, innerY + 8, leftW, { fontSize: Math.min(12, height * 0.18), minFontSize: 7, align: 'center' });
                doc.setFont('helvetica', 'normal');
                fitPdfText(doc, 'Controle Patrimonial Escolar', innerX + leftW / 2, innerY + 13, leftW, { fontSize: 5.5, minFontSize: 4, align: 'center' });
            }

            doc.line(innerX + leftW + 2.5, innerY, innerX + leftW + 2.5, innerY + headerH - 3);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text('PATRIMONIO', rightX, innerY + 5);
            fitPdfText(doc, patrimony, rightX, innerY + 12, rightW, { fontSize: Math.min(13, height * 0.19), minFontSize: 8 });
            if (!compactLabel) {
                doc.line(rightX, innerY + 14, innerX + innerW, innerY + 14);
                fitPdfText(doc, `TIPO: ${device.type || '-'}`.toUpperCase(), rightX, innerY + 19, rightW, { fontSize: 6, minFontSize: 4.5 });
            }

            const infoGap = 2.5;
            const infoColW = (innerW - infoGap * 2) / 3;
            const wideInfoColW = (innerW - infoGap) / 2;
            const drawInfo = (label, value, ix, iy, fieldWidth = infoColW) => {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(4.8);
                doc.text(label, ix, iy);
                doc.setFont('helvetica', 'normal');
                fitPdfText(doc, String(value || '-').toUpperCase(), ix, iy + 5, fieldWidth, { fontSize: 6.2, minFontSize: 4.2 });
            };

            drawInfo('MODELO / MARCA', modelBrand, innerX, infoY);
            drawInfo('N. DE SERIE', serial, innerX + infoColW + infoGap, infoY);
            drawInfo('N. CONTADOR', counterNumber, innerX + (infoColW + infoGap) * 2, infoY);
            if (!compactLabel) {
                drawInfo('LOCAL', location, innerX, infoY + 10, wideInfoColW);
                drawInfo('CADASTRO', createdAt, innerX + wideInfoColW + infoGap, infoY + 10, wideInfoColW);
            }
            doc.line(innerX, codeY - 4, innerX + innerW, codeY - 4);

            const barcodeW = innerW * 0.48;
            const barcodeH = Math.max(5, Math.min(maxCodeH, footerY - (codeY + 3) - 1));
            const barcodeX = innerX;
            const barcodeY = codeY + 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5);
            doc.text('CODIGO DE BARRAS', barcodeX + barcodeW / 2, codeY, { align: 'center' });
            doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);

            const qrAvailableH = Math.max(4, footerY - barcodeY - 1);
            const qrSize = Math.min(Math.max(6, Math.min(height * 0.23, innerW * 0.23)), qrAvailableH);
            const qrX = innerX + barcodeW + 6;
            const qrY = barcodeY - 1;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5);
            doc.text('QR CODE', qrX + qrSize / 2, codeY, { align: 'center' });
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.text(['Escaneie para', 'acessar no', 'sistema'], qrX + qrSize + 3, qrY + 4);

            doc.setFillColor(0);
            doc.roundedRect(innerX, footerY, innerW, footerH, 1, 1, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            fitPdfText(doc, `PATRIMONIO DA ${schoolName.toUpperCase()}`, innerX + innerW / 2, footerY + footerH * 0.68, innerW - 4, { fontSize: Math.max(3.8, footerH * 0.65), minFontSize: 3.2, align: 'center' });
            doc.setTextColor(0);
            }

        }

        async function generateLabelsPdfForDevices(devices, filePrefix = 'etiquetas_patrimoniais') {
            try {
                if (!devices.length) {
                    alert('Nenhum dispositivo selecionado para gerar etiqueta.');
                    return;
                }

                const jsPDF = getJsPdfInstance();
                const { width: labelW, height: labelH } = getSelectedLabelSize();
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const margin = 8;
                const gap = 5;
                const cols = Math.max(1, Math.floor((pageW - margin * 2 + gap) / (labelW + gap)));
                const rows = Math.max(1, Math.floor((pageH - margin * 2 + gap) / (labelH + gap)));
                const perPage = cols * rows;

                for (let index = 0; index < devices.length; index++) {
                    if (index > 0 && index % perPage === 0) {
                        doc.addPage();
                    }
                    const pageIndex = index % perPage;
                    const col = pageIndex % cols;
                    const row = Math.floor(pageIndex / cols);
                    await drawPatrimonyLabel(doc, devices[index], margin + col * (labelW + gap), margin + row * (labelH + gap), labelW, labelH);
                }

                doc.save(`${filePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar etiquetas:', error);
                alert('Erro ao gerar etiquetas: ' + error.message);
            }
        }

        function generateCurrentDeviceLabelPdf() {
            const deviceId = parseInt(document.getElementById('deviceId')?.value);
            if (!deviceId) {
                alert('Salve o dispositivo antes de gerar a etiqueta.');
                return;
            }
            generateSingleDeviceLabelPdf(deviceId);
        }

        function generateSingleDeviceLabelPdf(deviceId) {
            const device = data.devices.find(item => parseInt(item.id) === parseInt(deviceId));
            if (!device) {
                alert('Dispositivo não encontrado.');
                return;
            }
            generateLabelsPdfForDevices([device], `etiqueta_${getLabelPatrimony(device).replace(/[^a-z0-9]+/gi, '_')}`);
        }

        function generateSelectedLabelsPdf() {
            const selectedDevices = getSelectedLabelDevices();
            if (!selectedDevices.length) {
                alert('Selecione um ou mais dispositivos na lista, ou use "Etiquetas filtradas" para gerar todos os itens visíveis.');
                return;
            }
            generateLabelsPdfForDevices(selectedDevices, 'etiquetas_selecionadas');
        }

        function generateFilteredLabelsPdf() {
            generateLabelsPdfForDevices(getFilteredDevices(), 'etiquetas_filtradas');
        }

        function generateAllLabelsPdf() {
            generateLabelsPdfForDevices(getLabelFilteredDevices(), 'etiquetas_patrimoniais');
        }

        function formatDateTimeForPdf(value) {
            if (!value) return '-';
            if (typeof value !== 'string') return String(value);
            return value;
        }

        function parseLoanDateTime(value) {
            if (!value) return null;
            const [datePart = '', timePart = '00:00'] = value.split(' ');
            const [day, month, year] = datePart.split('/');
            if (!day || !month || !year) return null;
            const [hour = '00', minute = '00'] = timePart.split(':');
            const parsed = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hour, 10) || 0,
                parseInt(minute, 10) || 0,
                0,
                0
            );
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function formatDateBR(date) {
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('pt-BR');
        }

        function formatDateTimeBR(date) {
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
            return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }

        const LOAN_DUE_SOON_MS = 30 * 60 * 1000;

        function parseLoanDueAt(loan) {
            if (!loan?.due_at) return null;
            const dueDate = new Date(loan.due_at);
            return Number.isNaN(dueDate.getTime()) ? null : dueDate;
        }

        function formatDeadlineDistance(milliseconds) {
            const totalMinutes = Math.max(1, Math.ceil(Math.abs(milliseconds) / 60000));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (!hours) return `${minutes} min`;
            if (!minutes) return `${hours}h`;
            return `${hours}h ${minutes}min`;
        }

        function getLoanDeadlineInfo(loan, referenceTime = Date.now()) {
            const dueDate = parseLoanDueAt(loan);
            if (!dueDate || loan?.returned) {
                return {
                    key: 'none',
                    shortLabel: loan?.returned ? 'Encerrado' : 'Em uso',
                    detail: 'Sem prazo definido',
                    badgeColor: loan?.returned ? 'green' : 'blue',
                    rowClass: ''
                };
            }

            const remaining = dueDate.getTime() - referenceTime;
            const formattedDue = formatDateTimeBR(dueDate);
            if (remaining < 0) {
                return {
                    key: 'overdue',
                    shortLabel: `Atrasado ${formatDeadlineDistance(remaining)}`,
                    detail: `Prazo: ${formattedDue} — atraso de ${formatDeadlineDistance(remaining)}`,
                    badgeColor: 'red',
                    rowClass: 'loan-overdue-row'
                };
            }
            if (remaining <= LOAN_DUE_SOON_MS) {
                return {
                    key: 'due-soon',
                    shortLabel: `Vence em ${formatDeadlineDistance(remaining)}`,
                    detail: `Prazo: ${formattedDue}`,
                    badgeColor: 'yellow',
                    rowClass: 'loan-due-soon-row'
                };
            }

            return {
                key: 'on-time',
                shortLabel: formattedDue,
                detail: `Prazo: ${formattedDue}`,
                badgeColor: 'blue',
                rowClass: ''
            };
        }

        function startReturnForLoan(loanId) {
            showScreen('return');
            document.getElementById('returnLoan').value = loanId;
            loadReturnDetails();
        }

        function updateLoanDeadlineAlerts() {
            const container = document.getElementById('loanDeadlineAlerts');
            if (!container) return;

            const deadlineLoans = data.loans
                .filter(loan => !loan.returned && parseLoanDueAt(loan))
                .map(loan => ({ loan, deadline: getLoanDeadlineInfo(loan) }))
                .filter(item => ['overdue', 'due-soon'].includes(item.deadline.key))
                .sort((a, b) => {
                    if (a.deadline.key !== b.deadline.key) return a.deadline.key === 'overdue' ? -1 : 1;
                    return parseLoanDueAt(a.loan) - parseLoanDueAt(b.loan);
                });

            if (!deadlineLoans.length) {
                container.innerHTML = `
                    <div class="alert-item">
                        <div class="alert-icon info"><i class="fas fa-circle-check"></i></div>
                        <div class="alert-content">
                            <div class="alert-title">Nenhum prazo crítico</div>
                            <div class="alert-desc">Não há empréstimos atrasados ou vencendo nos próximos 30 minutos.</div>
                        </div>
                    </div>
                `;
                return;
            }

            container.innerHTML = `<div class="deadline-alert-list">${deadlineLoans.map(({ loan, deadline }) => {
                const className = data.classes.find(item => item.id === loan.class_id)?.name || '-';
                const teacherName = data.teachers.find(item => item.id === loan.teacher_id)?.name || '-';
                const isOverdue = deadline.key === 'overdue';
                return `
                    <div class="alert-item" onclick="startReturnForLoan(${loan.id})" role="button" tabindex="0">
                        <div class="alert-icon ${isOverdue ? 'danger' : 'warning'}">
                            <i class="fas fa-${isOverdue ? 'triangle-exclamation' : 'clock'}"></i>
                        </div>
                        <div class="alert-content">
                            <div class="alert-title">${isOverdue ? 'Empréstimo atrasado' : 'Prazo próximo'}: ${escapeHtml(className)}</div>
                            <div class="alert-desc">${escapeHtml(teacherName)} — ${escapeHtml(deadline.detail)}. Clique para devolver.</div>
                        </div>
                    </div>
                `;
            }).join('')}</div>`;
        }

        function getLoanReturnStatusLabel(loan) {
            if (!loan?.returned) return 'Em uso';
            if (loan.return_status === 'complete') return 'Devolvido';
            if (loan.return_status === 'incomplete') return 'Incompleto';
            if (loan.return_status === 'damaged') return 'Com danos';
            return 'Em uso';
        }

        function getLoanReportStatusKey(loan) {
            if (!loan?.returned) return 'active';
            if (loan.return_status === 'complete') return 'complete';
            if (loan.return_status === 'incomplete') return 'incomplete';
            if (loan.return_status === 'damaged') return 'damaged';
            return 'active';
        }

        function getLoanReportStatusLabel(statusKey) {
            const labels = {
                '': 'Todos os status',
                active: 'Em uso',
                complete: 'Devolvido',
                incomplete: 'Incompleto',
                damaged: 'Com danos'
            };
            return labels[statusKey] || 'Todos os status';
        }

        function filterLoansForReport(loans, statusFilter) {
            if (!statusFilter) return loans;
            return loans.filter(loan => getLoanReportStatusKey(loan) === statusFilter);
        }

        function buildLoanSummaryMap(loans, labelResolver) {
            const summary = new Map();

            loans.forEach(loan => {
                const key = labelResolver(loan);
                if (!summary.has(key)) {
                    summary.set(key, { label: key, loans: 0, quantity: 0 });
                }

                const entry = summary.get(key);
                entry.loans += 1;
                entry.quantity += Number(loan.quantity) || 0;
            });

            return [...summary.values()].sort((a, b) => b.quantity - a.quantity || b.loans - a.loans || a.label.localeCompare(b.label, 'pt-BR', { numeric: true, sensitivity: 'base' }));
        }

        function getPeriodRange(period, referenceDateValue) {
            const referenceDate = referenceDateValue ? new Date(`${referenceDateValue}T12:00:00`) : new Date();
            if (Number.isNaN(referenceDate.getTime())) {
                return null;
            }

            const start = new Date(referenceDate);
            const end = new Date(referenceDate);

            if (period === 'monthly') {
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(end.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                return { start, end, label: `Mensal - ${start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` };
            }

            const day = start.getDay();
            const mondayOffset = (day + 6) % 7;
            start.setDate(start.getDate() - mondayOffset);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `Semanal - ${formatDateBR(start)} até ${formatDateBR(end)}` };
        }

        function buildDeviceReportRows(devices) {
            return devices.map((device, index) => ([
                String(index + 1),
                device.type || '-',
                device.serial_number || '-',
                device.patrimony || '-',
                device.counter_number || '-',
                device.group || '-',
                device.type === 'Tablet' ? (device.imei || '-') : '-',
                device.status || '-',
                device.observations || '-'
            ]));
        }

        function buildLoanReportRows(loans) {
            return loans.map((loan, index) => {
                const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                const loanTypeLabel = loan.loan_type === 'full' ? 'Base completa' : 'Quantidade específica';
                const statusLabel = getLoanReturnStatusLabel(loan);

                return [
                    String(index + 1),
                    loan.date_time || '-',
                    className,
                    teacherName,
                    loan.device_type || '-',
                    loanTypeLabel,
                    String(loan.quantity ?? '-'),
                    loan.releaser || '-',
                    statusLabel,
                    loan.observations || '-'
                ];
            });
        }

        function generateDeviceReportPdf() {
            try {
                const jsPDF = getJsPdfInstance();
                const selectedType = document.getElementById('reportDeviceType')?.value || '';
                const filteredDevices = sortDevicesForDisplay(data.devices).filter(device => !selectedType || device.type === selectedType);

                if (!filteredDevices.length) {
                    alert('Nenhum dispositivo encontrado para gerar o relatório.');
                    return;
                }

                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const title = selectedType ? `Relatório de Dispositivos - ${selectedType}` : 'Relatório Geral de Dispositivos';
                const generatedAt = new Date().toLocaleString('pt-BR');
                const rows = buildDeviceReportRows(filteredDevices);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(title, 14, 16);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(`Gerado em: ${generatedAt}`, 14, 22);
                doc.text(`Total de dispositivos: ${filteredDevices.length}`, 14, 28);

                doc.autoTable({
                    startY: 34,
                    head: [[
                        '#',
                        'Tipo',
                        'N/S',
                        'Patrimônio',
                        'Contador',
                        'Agrupamento',
                        'IMEI',
                        'Estado',
                        'Observações'
                    ]],
                    body: rows,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
                    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 10 },
                        1: { cellWidth: 30 },
                        2: { cellWidth: 28 },
                        3: { cellWidth: 30 },
                        4: { cellWidth: 22 },
                        5: { cellWidth: 30 },
                        6: { cellWidth: 28 },
                        7: { cellWidth: 24 },
                        8: { cellWidth: 'auto' }
                    },
                    didDrawPage: (dataArg) => {
                        doc.setFontSize(10);
                        doc.text('Escola Percio - Controle de Dispositivos', 14, 8);
                        const pageCount = doc.getNumberOfPages();
                        doc.text(`Página ${dataArg.pageNumber} de ${pageCount}`, 265, 8, { align: 'right' });
                    }
                });

                const safeType = selectedType ? selectedType.replace(/[^a-z0-9]+/gi, '_') : 'todos_os_tipos';
                doc.save(`relatorio_dispositivos_${safeType}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar relatório de dispositivos:', error);
                alert('Erro ao gerar relatório de dispositivos: ' + error.message);
            }
        }

        function generateUsageReportPdf() {
            try {
                const jsPDF = getJsPdfInstance();
                const period = document.getElementById('reportUsagePeriod')?.value || 'weekly';
                const statusFilter = document.getElementById('reportUsageStatus')?.value || '';
                const referenceDateValue = document.getElementById('reportUsageDate')?.value || new Date().toISOString().split('T')[0];
                const range = getPeriodRange(period, referenceDateValue);
                if (!range) {
                    alert('Data de referência inválida.');
                    return;
                }

                const filteredLoans = data.loans
                    .map(loan => ({ loan, parsedDate: parseLoanDateTime(loan.date_time) }))
                    .filter(item => item.parsedDate && item.parsedDate >= range.start && item.parsedDate <= range.end)
                    .map(item => item.loan)
                const reportLoans = filterLoansForReport(filteredLoans, statusFilter)
                    .sort((a, b) => {
                        const aDate = parseLoanDateTime(a.date_time)?.getTime() || 0;
                        const bDate = parseLoanDateTime(b.date_time)?.getTime() || 0;
                        return bDate - aDate;
                    });

                if (!reportLoans.length) {
                    alert('Nenhum empréstimo encontrado para o período selecionado.');
                    return;
                }

                const totalQuantity = reportLoans.reduce((sum, loan) => sum + (Number(loan.quantity) || 0), 0);
                const uniqueClasses = new Set(reportLoans.map(loan => loan.class_id).filter(Boolean)).size;
                const uniqueTeachers = new Set(reportLoans.map(loan => loan.teacher_id).filter(Boolean)).size;
                const roomSummary = buildLoanSummaryMap(reportLoans, loan => {
                    const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                    return className;
                });
                const teacherSummary = buildLoanSummaryMap(reportLoans, loan => {
                    const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                    return teacherName;
                });

                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const title = period === 'monthly' ? 'Relatório Mensal de Uso' : 'Relatório Semanal de Uso';
                const rows = buildLoanReportRows(reportLoans);
                const statusLabel = getLoanReportStatusLabel(statusFilter);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(title, 14, 16);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(`Período: ${range.label}`, 14, 22);
                doc.text(`Status: ${statusLabel}`, 14, 28);
                doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 34);
                doc.text(`Registros: ${reportLoans.length} | Quantidade total: ${totalQuantity} | Turmas: ${uniqueClasses} | Professores: ${uniqueTeachers}`, 14, 40);

                const summaryHeadStyle = { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' };
                const summaryStyles = { fontSize: 8, cellPadding: 2, overflow: 'linebreak' };

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumo por sala', 14, 48);
                doc.autoTable({
                    startY: 52,
                    head: [['Sala', 'Empréstimos', 'Quantidade total']],
                    body: roomSummary.length
                        ? roomSummary.map(item => [item.label, String(item.loans), String(item.quantity)])
                        : [['-', '0', '0']],
                    theme: 'grid',
                    styles: summaryStyles,
                    headStyles: summaryHeadStyle,
                    margin: { left: 14, right: 14 }
                });

                const afterRooms = doc.lastAutoTable?.finalY || 52;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumo por professor', 14, afterRooms + 10);
                doc.autoTable({
                    startY: afterRooms + 14,
                    head: [['Professor', 'Empréstimos', 'Quantidade total']],
                    body: teacherSummary.length
                        ? teacherSummary.map(item => [item.label, String(item.loans), String(item.quantity)])
                        : [['-', '0', '0']],
                    theme: 'grid',
                    styles: summaryStyles,
                    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
                    margin: { left: 14, right: 14 }
                });

                doc.autoTable({
                    startY: (doc.lastAutoTable?.finalY || afterRooms) + 12,
                    head: [[
                        '#',
                        'Data/Hora',
                        'Turma/Sala',
                        'Professor',
                        'Tipo disp.',
                        'Tipo saída',
                        'Qtd.',
                        'Responsável',
                        'Status',
                        'Obs.'
                    ]],
                    body: rows,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
                    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 10 },
                        1: { cellWidth: 26 },
                        2: { cellWidth: 28 },
                        3: { cellWidth: 30 },
                        4: { cellWidth: 24 },
                        5: { cellWidth: 28 },
                        6: { cellWidth: 14, halign: 'center' },
                        7: { cellWidth: 26 },
                        8: { cellWidth: 18 },
                        9: { cellWidth: 'auto' }
                    },
                    didDrawPage: (dataArg) => {
                        doc.setFontSize(10);
                        doc.text('Escola Percio - Controle de Dispositivos', 14, 8);
                        const pageCount = doc.getNumberOfPages();
                        doc.text(`Página ${dataArg.pageNumber} de ${pageCount}`, 265, 8, { align: 'right' });
                    }
                });

                const safePeriod = period === 'monthly' ? 'mensal' : 'semanal';
                const safeStatus = statusFilter || 'todos_status';
                const safeDate = referenceDateValue.replace(/-/g, '_');
                doc.save(`relatorio_uso_${safePeriod}_${safeStatus}_${safeDate}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar relatório de uso:', error);
                alert('Erro ao gerar relatório de uso: ' + error.message);
            }
        }

        function downloadTextFile(filename, content, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        function buildFullBackupSections() {
            const loanRows = data.loans.map(loan => {
                const className = data.classes.find(c => c.id === loan.class_id)?.name || '-';
                const teacherName = data.teachers.find(t => t.id === loan.teacher_id)?.name || '-';
                return [
                    loan.id,
                    loan.date_time,
                    loan.due_at ? formatDateTimeBR(new Date(loan.due_at)) : '-',
                    className,
                    teacherName,
                    loan.device_type,
                    loan.quantity,
                    loan.releaser,
                    loan.returned ? 'Devolvido' : 'Em uso'
                ];
            });

            return [
                {
                    title: 'Dispositivos',
                    head: ['ID', 'Tipo', 'Serial', 'Patrimônio', 'Contador', 'Grupo', 'Status'],
                    rows: sortDevicesForDisplay(data.devices).map(d => [d.id, d.type, d.serial_number || '-', d.patrimony || '-', d.counter_number || '-', d.group || '-', d.status || '-'])
                },
                {
                    title: 'Empréstimos',
                    head: ['ID', 'Data', 'Prazo', 'Turma', 'Professor', 'Tipo', 'Qtd.', 'Responsável', 'Status'],
                    rows: loanRows
                },
                {
                    title: 'Devoluções por dispositivo',
                    head: ['Vínculo', 'Empréstimo', 'Dispositivo', 'Status', 'Devolvido em', 'Responsável', 'Observações'],
                    rows: (data.loanDevices || []).map(item => [
                        item.id || '-',
                        item.loan_id,
                        item.device_id,
                        item.return_status || 'pending',
                        item.returned_at ? formatDateTimeBR(new Date(item.returned_at)) : '-',
                        item.returned_by || '-',
                        item.return_observations || '-'
                    ])
                },
                {
                    title: 'Agendamentos semanais',
                    head: ['ID', 'Dia', 'Horário', 'Turma/Sala', 'Professor', 'Base', 'Tipo', 'Aviso', 'Status'],
                    rows: (data.weeklyReservations || []).map(item => [
                        item.id || '-',
                        WEEKDAY_LABELS[Number(item.weekday)] || item.weekday,
                        formatReservationTime(item.start_time),
                        getReservationClassName(item),
                        getReservationTeacherName(item),
                        item.group_name,
                        item.device_type,
                        `${item.reminder_minutes} min`,
                        item.active ? 'Ativo' : 'Pausado'
                    ])
                },
                {
                    title: 'Professores',
                    head: ['ID', 'Nome', 'Disciplina'],
                    rows: data.teachers.map(t => [t.id, t.name, t.subject || '-'])
                },
                {
                    title: 'Turmas',
                    head: ['ID', 'Nome', 'Turno', 'Alunos'],
                    rows: data.classes.map(c => [c.id, c.name, c.shift, c.students || '-'])
                },
                {
                    title: 'Histórico de manutenção',
                    head: ['ID', 'Dispositivo', 'Anterior', 'Novo', 'Responsável', 'Data'],
                    rows: (data.deviceMaintenanceHistory || []).map(h => [h.id || '-', h.device_id, h.previous_status, h.new_status, h.changed_by || '-', h.created_at ? formatDateTimeBR(new Date(h.created_at)) : '-'])
                },
                {
                    title: 'Histórico de alterações',
                    head: ['ID', 'Dispositivo', 'Ação', 'Responsável', 'Data', 'Notas'],
                    rows: (data.deviceChangeHistory || []).map(h => [h.id || '-', h.device_id, h.action, h.changed_by || '-', h.created_at ? formatDateTimeBR(new Date(h.created_at)) : '-', h.notes || '-'])
                }
            ];
        }

        function generateFullBackupPdf() {
            try {
                const jsPDF = getJsPdfInstance();
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const sections = buildFullBackupSections();

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text('Backup geral - Controle de Dispositivos', 14, 16);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 23);

                let startY = 32;
                sections.forEach((section, index) => {
                    if (index > 0 && startY > 165) {
                        doc.addPage();
                        startY = 18;
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text(`${section.title} (${section.rows.length})`, 14, startY);
                    doc.autoTable({
                        startY: startY + 4,
                        head: [section.head],
                        body: section.rows.length ? section.rows : [section.head.map(() => '-')],
                        theme: 'grid',
                        styles: { fontSize: 7, cellPadding: 1.6, overflow: 'linebreak' },
                        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
                        margin: { left: 14, right: 14 }
                    });
                    startY = (doc.lastAutoTable?.finalY || startY) + 10;
                });

                doc.save(`backup_geral_${new Date().toISOString().slice(0, 10)}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar backup PDF:', error);
                alert('Erro ao gerar backup PDF: ' + error.message);
            }
        }

        function exportFullBackupExcel() {
            const sections = buildFullBackupSections();
            const html = `
                <html><head><meta charset="UTF-8"></head><body>
                ${sections.map(section => `
                    <h2>${escapeHtml(section.title)}</h2>
                    <table border="1">
                        <thead><tr>${section.head.map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${(section.rows.length ? section.rows : [section.head.map(() => '-')]).map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table><br>
                `).join('')}
                </body></html>
            `;
            downloadTextFile(`backup_geral_${new Date().toISOString().slice(0, 10)}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
        }
        function getDeviceCounterSortKey(counterNumber) {
            const raw = (counterNumber || '').toString().trim().toLowerCase();
            if (!raw || raw === 's/n' || raw === 'sn') {
                return { rank: 2, numeric: Number.MAX_SAFE_INTEGER, text: '' };
            }

            const numericMatch = raw.match(/\d+/);
            if (numericMatch) {
                return { rank: 0, numeric: parseInt(numericMatch[0], 10), text: raw };
            }

            return { rank: 1, numeric: Number.MAX_SAFE_INTEGER, text: raw };
        }

        function sortDevicesForDisplay(devices) {
            return [...devices].sort((a, b) => {
                const typeDiff = getDeviceTypeOrder(a.type) - getDeviceTypeOrder(b.type);
                if (typeDiff !== 0) return typeDiff;

                const aFixed = isFixedDevice(a.type);
                const bFixed = isFixedDevice(b.type);
                if (aFixed && bFixed) {
                    const groupDiff = normalizeDeviceText(a.group).localeCompare(normalizeDeviceText(b.group), 'pt-BR', { numeric: true, sensitivity: 'base' });
                    if (groupDiff !== 0) return groupDiff;
                }

                const aCounter = getDeviceCounterSortKey(a.counter_number);
                const bCounter = getDeviceCounterSortKey(b.counter_number);

                if (aCounter.rank !== bCounter.rank) return aCounter.rank - bCounter.rank;
                if (aCounter.numeric !== bCounter.numeric) return aCounter.numeric - bCounter.numeric;

                const textDiff = aCounter.text.localeCompare(bCounter.text, 'pt-BR', { numeric: true, sensitivity: 'base' });
                if (textDiff !== 0) return textDiff;

                return (a.id || 0) - (b.id || 0);
            });
        }

        function groupDevicesByType(devices) {
            const grouped = [];
            const map = new Map();

            devices.forEach(device => {
                const key = getDeviceDisplayGroupKey(device);
                if (!map.has(key)) {
                    const group = {
                        key,
                        type: device.type || 'Outros',
                        label: getDeviceDisplayGroupLabel(device),
                        devices: []
                    };
                    map.set(key, group);
                    grouped.push(group);
                }
                map.get(key).devices.push(device);
            });

            return grouped;
        }

        function getDeviceTypeLabel(type) {
            return type || 'Outros';
        }
