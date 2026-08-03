// reports.js - application script.
const optionalLibraryPromises = new Map();

function loadOptionalLibrary(src, isReady) {
    if (isReady()) {
        return Promise.resolve();
    }
    if (optionalLibraryPromises.has(src)) {
        return optionalLibraryPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => isReady()
            ? resolve()
            : reject(new Error(`A biblioteca carregada não ficou disponível: ${src}`));
        script.onerror = () => reject(new Error(`Não foi possível carregar a biblioteca: ${src}`));
        document.head.appendChild(script);
    }).catch(error => {
        optionalLibraryPromises.delete(src);
        throw error;
    });

    optionalLibraryPromises.set(src, promise);
    return promise;
}

async function ensurePdfLibraries() {
    await loadOptionalLibrary(
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        () => Boolean(window.jspdf?.jsPDF)
    );
    await loadOptionalLibrary(
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
        () => Boolean(window.jspdf?.jsPDF?.API?.autoTable)
    );
}

async function ensureLabelLibraries() {
    await Promise.all([
        ensurePdfLibraries(),
        loadOptionalLibrary(
            'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
            () => Boolean(window.QRious)
        ),
        loadOptionalLibrary(
            'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
            () => Boolean(window.JsBarcode)
        )
    ]);
}

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

                await ensureLabelLibraries();
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

        const LONG_RUNNING_LOAN_THRESHOLD_MS = 2 * 60 * 60 * 1000;

        function formatLoanElapsedTime(milliseconds) {
            const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
            const days = Math.floor(totalMinutes / 1440);
            const hours = Math.floor((totalMinutes % 1440) / 60);
            const minutes = totalMinutes % 60;
            return [
                days ? `${days}d` : '',
                hours ? `${hours}h` : '',
                minutes ? `${minutes}min` : ''
            ].filter(Boolean).join(' ') || '0min';
        }

        function getSeenLongRunningLoanReminders() {
            try {
                const parsed = JSON.parse(
                    localStorage.getItem(LOAN_DURATION_REMINDER_STORAGE_KEY) || '{}'
                );
                const activeLoanIds = new Set(
                    data.loans.filter(loan => !loan.returned).map(loan => String(loan.id))
                );
                return Object.fromEntries(
                    Object.entries(parsed).filter(([loanId]) => activeLoanIds.has(loanId))
                );
            } catch (error) {
                return {};
            }
        }

        function checkLongRunningLoanNotifications(referenceTime = Date.now()) {
            if (!currentUser || !(data.loans || []).length) return;

            const seen = getSeenLongRunningLoanReminders();
            const queuedLoanIds = new Set(
                loanDurationReminderQueue.map(item => String(item.loan.id))
            );
            if (activeLoanDurationReminder) {
                queuedLoanIds.add(String(activeLoanDurationReminder.loan.id));
            }
            data.loans
                .filter(loan => !loan.returned)
                .map(loan => ({
                    loan,
                    startDate: parseLoanDateTime(loan.date_time)
                }))
                .filter(item =>
                    item.startDate &&
                    referenceTime - item.startDate.getTime() >= LONG_RUNNING_LOAN_THRESHOLD_MS
                )
                .sort((a, b) => a.startDate - b.startDate)
                .forEach(item => {
                    const loanId = String(item.loan.id);
                    if (seen[loanId] || queuedLoanIds.has(loanId)) return;

                    queuedLoanIds.add(loanId);
                    loanDurationReminderQueue.push({
                        ...item,
                        detectedAt: referenceTime
                    });
                });

            showNextLongRunningLoanReminder();
        }

        function showNextLongRunningLoanReminder() {
            if (
                activeLoanDurationReminder ||
                activeReservationReminder ||
                !loanDurationReminderQueue.length
            ) return;

            const appAlertOverlay = document.getElementById('appAlertOverlay');
            if (appAlertOverlay?.classList.contains('active')) return;

            activeLoanDurationReminder = loanDurationReminderQueue.shift();
            const currentLoan = data.loans.find(loan =>
                parseInt(loan.id) === parseInt(activeLoanDurationReminder.loan.id) &&
                !loan.returned
            );
            if (!currentLoan) {
                activeLoanDurationReminder = null;
                showNextLongRunningLoanReminder();
                return;
            }

            const startDate = parseLoanDateTime(currentLoan.date_time);
            if (!startDate) {
                activeLoanDurationReminder = null;
                showNextLongRunningLoanReminder();
                return;
            }
            activeLoanDurationReminder.loan = currentLoan;
            activeLoanDurationReminder.startDate = startDate;
            const seen = getSeenLongRunningLoanReminders();
            seen[String(currentLoan.id)] = Date.now();
            localStorage.setItem(
                LOAN_DURATION_REMINDER_STORAGE_KEY,
                JSON.stringify(seen)
            );

            const className = data.classes.find(item =>
                parseInt(item.id) === parseInt(currentLoan.class_id)
            )?.name || 'Turma não informada';
            const teacherName = data.teachers.find(item =>
                parseInt(item.id) === parseInt(currentLoan.teacher_id)
            )?.name || 'Professor não informado';
            const elapsedTime = formatLoanElapsedTime(Date.now() - startDate.getTime());
            const pendingQuantity = getLoanPendingQuantity(currentLoan);

            document.getElementById('loanDurationReminderTitle').textContent =
                `${className} está com o empréstimo há ${elapsedTime}`;
            document.getElementById('loanDurationReminderMessage').textContent =
                `${teacherName} · ${pendingQuantity} dispositivo(s) pendente(s). ` +
                'Confira se os equipamentos já podem ser devolvidos.';
            const modal = document.getElementById('loanDurationReminderModal');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeLongRunningLoanReminder() {
            const modal = document.getElementById('loanDurationReminderModal');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            activeLoanDurationReminder = null;
            setTimeout(showNextLongRunningLoanReminder, 200);
            setTimeout(showNextReservationReminder, 200);
        }

        function openLongRunningLoanReturn() {
            const loanId = activeLoanDurationReminder?.loan?.id;
            closeLongRunningLoanReminder();
            if (loanId) startReturnForLoan(loanId);
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

        function buildDeviceSummaryMap(devices, labelResolver) {
            const summary = new Map();
            devices.forEach(device => {
                const label = labelResolver(device) || 'Sem agrupamento';
                if (!summary.has(label)) {
                    summary.set(label, { label, total: 0, available: 0 });
                }
                const item = summary.get(label);
                item.total += 1;
                if (normalizeDeviceText(device.status) === 'disponivel') {
                    item.available += 1;
                }
            });
            return [...summary.values()].sort((a, b) =>
                b.total - a.total || a.label.localeCompare(b.label, 'pt-BR', { numeric: true, sensitivity: 'base' })
            );
        }

        function drawDeviceSummaryCard(doc, x, y, width, height, title, items, accent) {
            doc.setFillColor(255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, width, height, 2.4, 2.4, 'FD');
            doc.setFillColor(...accent);
            doc.roundedRect(x + 3, y + 3, 6, 6, 1.4, 1.4, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            doc.text('=', x + 6, y + 7.1, { align: 'center' });
            doc.setTextColor(8, 27, 66);
            doc.setFontSize(7.5);
            doc.text(title, x + 11, y + 7.3);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(4.6);
            doc.text('Categoria', x + 3, y + 13);
            doc.text('Disponíveis', x + width * 0.55, y + 13, { align: 'center' });
            doc.text('Total', x + width - 3, y + 13, { align: 'right' });

            const visibleItems = items.slice(0, 11);
            const maxTotal = Math.max(1, ...visibleItems.map(item => item.total));
            visibleItems.forEach((item, index) => {
                const rowY = y + 18 + index * 6;
                doc.setDrawColor(241, 245, 249);
                doc.line(x + 3, rowY + 1.6, x + width - 3, rowY + 1.6);
                doc.setTextColor(30, 41, 59);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text(doc.splitTextToSize(item.label, width * 0.41)[0], x + 3, rowY);
                doc.text(String(item.available), x + width * 0.55, rowY, { align: 'center' });
                const barX = x + width * 0.61;
                const barWidth = width * 0.22;
                doc.setFillColor(226, 232, 240);
                doc.roundedRect(barX, rowY - 1.6, barWidth, 1.8, 0.8, 0.8, 'F');
                doc.setFillColor(...accent);
                doc.roundedRect(barX, rowY - 1.6, Math.max(0.8, barWidth * item.total / maxTotal), 1.8, 0.8, 0.8, 'F');
                doc.text(String(item.total), x + width - 3, rowY, { align: 'right' });
            });

            const totalDevices = items.reduce((sum, item) => sum + item.total, 0);
            const footerY = y + height - 8;
            doc.setFillColor(239, 246, 255);
            doc.roundedRect(x + 3, footerY, width - 6, 5.5, 1.3, 1.3, 'F');
            doc.setTextColor(...accent);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.3);
            doc.text('Total de dispositivos', x + 9, footerY + 3.7);
            doc.setFillColor(...accent);
            doc.roundedRect(x + width - 17, footerY + 1, 12, 3.7, 1, 1, 'F');
            doc.setTextColor(255);
            doc.text(String(totalDevices), x + width - 11, footerY + 3.5, { align: 'center' });
        }

        function drawDeviceDetailTitle(doc, y, continuation = false) {
            doc.setFillColor(112, 63, 205);
            doc.roundedRect(8, y - 4.7, 6, 6, 1.3, 1.3, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            doc.text('=', 11, y - 0.7, { align: 'center' });
            doc.setTextColor(112, 63, 205);
            doc.setFontSize(8.5);
            doc.text('Inventário detalhado', 17, y);
            if (continuation) {
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.text('(continuação)', 48, y);
            }
        }

        async function generateDeviceReportPdf() {
            try {
                await ensurePdfLibraries();
                const jsPDF = getJsPdfInstance();
                const selectedType = document.getElementById('reportDeviceType')?.value || '';
                const filteredDevices = sortDevicesForDisplay(data.devices).filter(device => !selectedType || device.type === selectedType);

                if (!filteredDevices.length) {
                    alert('Nenhum dispositivo encontrado para gerar o relatório.');
                    return;
                }

                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageWidth = doc.internal.pageSize.getWidth();
                const title = selectedType ? `Relatório de Dispositivos - ${selectedType}` : 'Relatório Geral de Dispositivos';
                const generatedAt = new Date().toLocaleString('pt-BR');
                const rows = buildDeviceReportRows(filteredDevices);
                const statusCounts = filteredDevices.reduce((counts, device) => {
                    const status = normalizeDeviceText(device.status);
                    if (status === 'disponivel') counts.available += 1;
                    else if (status.includes('manutencao')) counts.maintenance += 1;
                    else if (status.includes('uso')) counts.inUse += 1;
                    else counts.outOfUse += 1;
                    return counts;
                }, { available: 0, inUse: 0, maintenance: 0, outOfUse: 0 });
                const typeSummary = buildDeviceSummaryMap(filteredDevices, device => device.type || 'Sem tipo');
                const groupSummary = buildDeviceSummaryMap(filteredDevices, device => device.group || 'Sem agrupamento');
                const accentBlue = [20, 101, 235];
                const accentGreen = [16, 185, 108];

                drawUsageReportHeader(doc);
                doc.setTextColor(8, 27, 66);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.text(title, 10, 42);

                const infoWidth = (pageWidth - 24) / 3;
                drawUsageInfoCard(doc, 8, 48, infoWidth, 'Tipo selecionado:', selectedType || 'Todos os tipos', accentBlue);
                drawUsageInfoCard(doc, 12 + infoWidth, 48, infoWidth, 'Escopo:', 'Inventário completo', accentBlue);
                drawUsageInfoCard(doc, 16 + infoWidth * 2, 48, infoWidth, 'Gerado em:', generatedAt, accentBlue);

                const metricWidth = (pageWidth - 28) / 4;
                drawUsageMetricCard(doc, 8, 66, metricWidth, filteredDevices.length, 'Total', accentBlue, '#');
                drawUsageMetricCard(doc, 12 + metricWidth, 66, metricWidth, statusCounts.available, 'Disponíveis', accentGreen, '=');
                drawUsageMetricCard(doc, 16 + metricWidth * 2, 66, metricWidth, statusCounts.maintenance, 'Em manutenção', [249, 115, 22], 'M');
                drawUsageMetricCard(doc, 20 + metricWidth * 3, 66, metricWidth, statusCounts.inUse + statusCounts.outOfUse, 'Em uso / fora', [112, 63, 205], 'U');

                const summaryTop = 87;
                const summaryHeight = 86;
                const summaryWidth = (pageWidth - 20) / 2;
                drawDeviceSummaryCard(doc, 8, summaryTop, summaryWidth, summaryHeight, 'Resumo por tipo', typeSummary, accentBlue);
                drawDeviceSummaryCard(doc, 12 + summaryWidth, summaryTop, summaryWidth, summaryHeight, 'Resumo por agrupamento', groupSummary, accentGreen);

                const detailTitleY = 183;
                drawDeviceDetailTitle(doc, detailTitleY);

                doc.autoTable({
                    startY: detailTitleY + 4,
                    head: [[
                        '#', 'Tipo', 'N/S', 'Patrimônio', 'Contador',
                        'Agrupamento', 'IMEI', 'Estado', 'Observações'
                    ]],
                    body: rows,
                    theme: 'grid',
                    margin: { top: 47, right: 8, bottom: 18, left: 8 },
                    styles: {
                        font: 'helvetica',
                        fontSize: 4.8,
                        cellPadding: 1.3,
                        minCellHeight: 7.5,
                        textColor: [30, 41, 59],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.25,
                        overflow: 'linebreak',
                        valign: 'middle'
                    },
                    headStyles: {
                        fillColor: [112, 63, 205],
                        textColor: 255,
                        fontStyle: 'bold',
                        halign: 'center',
                        minCellHeight: 8
                    },
                    alternateRowStyles: { fillColor: [250, 251, 253] },
                    columnStyles: {
                        0: { cellWidth: 6, halign: 'center' },
                        1: { cellWidth: 22 },
                        2: { cellWidth: 24 },
                        3: { cellWidth: 22 },
                        4: { cellWidth: 16 },
                        5: { cellWidth: 24 },
                        6: { cellWidth: 24 },
                        7: { cellWidth: 20, halign: 'center' },
                        8: { cellWidth: 36 }
                    },
                    didParseCell: hook => {
                        if (hook.section === 'body' && hook.column.index === 7) {
                            hook.cell.styles.fontStyle = 'bold';
                            const status = normalizeDeviceText(hook.cell.raw);
                            if (status === 'disponivel') {
                                hook.cell.styles.fillColor = [225, 248, 235];
                                hook.cell.styles.textColor = [21, 128, 61];
                            } else if (status.includes('manutencao')) {
                                hook.cell.styles.fillColor = [255, 237, 213];
                                hook.cell.styles.textColor = [194, 65, 12];
                            } else if (status.includes('uso')) {
                                hook.cell.styles.fillColor = [219, 234, 254];
                                hook.cell.styles.textColor = [29, 78, 216];
                            } else {
                                hook.cell.styles.fillColor = [226, 232, 240];
                                hook.cell.styles.textColor = [71, 85, 105];
                            }
                        }
                    },
                    didDrawPage: hook => {
                        if (hook.pageNumber > 1) {
                            drawUsageReportHeader(doc);
                            drawDeviceDetailTitle(doc, 41, true);
                        }
                    }
                });

                const pageCount = doc.getNumberOfPages();
                for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
                    doc.setPage(pageNumber);
                    drawUsageReportFooter(doc, pageNumber, pageCount);
                }

                const safeType = selectedType ? selectedType.replace(/[^a-z0-9]+/gi, '_') : 'todos_os_tipos';
                doc.save(`relatorio_dispositivos_${safeType}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar relatório de dispositivos:', error);
                alert('Erro ao gerar relatório de dispositivos: ' + error.message);
            }
        }

        function drawUsageReportHeader(doc) {
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFillColor(5, 33, 92);
            doc.rect(0, 0, pageWidth, 30, 'F');
            doc.setFillColor(7, 49, 122);
            doc.triangle(0, 30, 122, 0, 0, 0, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255);
            doc.setFontSize(15);
            doc.text('Escola Percio', 12, 12);
            doc.setFontSize(9.5);
            doc.text('Controle de Dispositivos', 12, 19);
            doc.setDrawColor(16, 197, 184);
            doc.setLineWidth(0.8);
            doc.line(12, 22.5, 59, 22.5);

            doc.setDrawColor(42, 116, 255);
            doc.setFillColor(239, 246, 255);
            doc.setLineWidth(1.6);
            doc.roundedRect(pageWidth - 48, 5, 31, 18, 2, 2, 'FD');
            doc.setFillColor(218, 232, 255);
            doc.rect(pageWidth - 44, 8, 23, 11, 'F');
            doc.setFillColor(22, 91, 218);
            doc.triangle(pageWidth - 51, 24, pageWidth - 13, 24, pageWidth - 18, 21, 'F');
            doc.setDrawColor(34, 211, 238);
            doc.setLineWidth(0.7);
            doc.line(pageWidth - 44, 11, pageWidth - 24, 11);
            doc.line(pageWidth - 44, 14, pageWidth - 28, 14);
            doc.setFillColor(16, 185, 129);
            doc.circle(pageWidth - 22, 17, 2.3, 'F');
            doc.setDrawColor(255);
            doc.setLineWidth(0.5);
            doc.line(pageWidth - 23, 17, pageWidth - 22.2, 17.8);
            doc.line(pageWidth - 22.2, 17.8, pageWidth - 20.8, 16.2);
        }

        function drawUsageInfoCard(doc, x, y, width, label, value, accent) {
            doc.setFillColor(255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, width, 13, 2.4, 2.4, 'FD');
            doc.setFillColor(...accent);
            doc.roundedRect(x + 3, y + 3, 7, 7, 1.5, 1.5, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text('i', x + 6.5, y + 7.8, { align: 'center' });
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.2);
            doc.text(label, x + 13, y + 5);
            doc.setTextColor(15, 47, 104);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.4);
            doc.text(doc.splitTextToSize(String(value), width - 16).slice(0, 2), x + 13, y + 9);
        }

        function drawUsageMetricCard(doc, x, y, width, value, label, accent, symbol) {
            doc.setFillColor(255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, width, 16, 2.4, 2.4, 'FD');
            doc.setFillColor(...accent);
            doc.roundedRect(x + 3, y + 3, 9, 10, 2, 2, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(symbol, x + 7.5, y + 9.4, { align: 'center' });
            doc.setTextColor(8, 27, 66);
            doc.setFontSize(12);
            doc.text(String(value), x + 15, y + 8.4);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.2);
            doc.text(label, x + 15, y + 12.3);
        }

        function drawUsageSummaryCard(doc, x, y, width, height, title, items, accent, totalLoans) {
            doc.setFillColor(255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, width, height, 2.4, 2.4, 'FD');
            doc.setFillColor(...accent);
            doc.roundedRect(x + 3, y + 3, 6, 6, 1.4, 1.4, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            doc.text('=', x + 6, y + 7.1, { align: 'center' });
            doc.setTextColor(8, 27, 66);
            doc.setFontSize(7.5);
            doc.text(title, x + 11, y + 7.3);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(4.6);
            doc.text(title.includes('sala') ? 'Sala' : 'Professor', x + 3, y + 13);
            doc.text('Empréstimos', x + width * 0.55, y + 13, { align: 'center' });
            doc.text('Quantidade total', x + width - 3, y + 13, { align: 'right' });

            const visibleItems = items.slice(0, 13);
            const maxQuantity = Math.max(1, ...visibleItems.map(item => item.quantity));
            const rowHeight = 6;
            visibleItems.forEach((item, index) => {
                const rowY = y + 18 + index * rowHeight;
                doc.setDrawColor(241, 245, 249);
                doc.line(x + 3, rowY + 1.5, x + width - 3, rowY + 1.5);
                doc.setTextColor(30, 41, 59);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text(doc.splitTextToSize(item.label || '-', width * 0.42)[0], x + 3, rowY);
                doc.text(String(item.loans), x + width * 0.55, rowY, { align: 'center' });
                const barX = x + width * 0.61;
                const barWidth = width * 0.21;
                doc.setFillColor(226, 232, 240);
                doc.roundedRect(barX, rowY - 1.6, barWidth, 1.8, 0.8, 0.8, 'F');
                doc.setFillColor(...accent);
                doc.roundedRect(barX, rowY - 1.6, Math.max(0.8, barWidth * item.quantity / maxQuantity), 1.8, 0.8, 0.8, 'F');
                doc.text(String(item.quantity), x + width - 3, rowY, { align: 'right' });
            });

            const footerY = y + height - 8;
            doc.setFillColor(accent[0] > 20 ? 240 : 239, accent[1] > 150 ? 253 : 246, accent[2] > 150 ? 255 : 246);
            doc.roundedRect(x + 3, footerY, width - 6, 5.5, 1.3, 1.3, 'F');
            doc.setTextColor(...accent);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.3);
            doc.text('Total de empréstimos', x + 9, footerY + 3.7);
            doc.setFillColor(...accent);
            doc.roundedRect(x + width - 15, footerY + 1, 10, 3.7, 1, 1, 'F');
            doc.setTextColor(255);
            doc.text(String(totalLoans), x + width - 10, footerY + 3.5, { align: 'center' });
        }

        function drawUsageDetailTitle(doc, y, continuation = false) {
            doc.setFillColor(112, 63, 205);
            doc.roundedRect(8, y - 4.7, 6, 6, 1.3, 1.3, 'F');
            doc.setTextColor(255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            doc.text('=', 11, y - 0.7, { align: 'center' });
            doc.setTextColor(112, 63, 205);
            doc.setFontSize(8.5);
            doc.text('Registros detalhados', 17, y);
            if (continuation) {
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.text('(continuação)', 55, y);
            }
        }

        function drawUsageReportFooter(doc, pageNumber, pageCount) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(8, pageHeight - 13, pageWidth - 8, pageHeight - 13);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.8);
            doc.text('Escola Percio - Controle de Dispositivos', 10, pageHeight - 7);
            doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
        }

        async function generateUsageReportPdf() {
            try {
                await ensurePdfLibraries();
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

                const rows = buildLoanReportRows(reportLoans);
                const statusLabel = getLoanReportStatusLabel(statusFilter);
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageWidth = doc.internal.pageSize.getWidth();
                const title = period === 'monthly' ? 'Relatório Mensal de Uso' : 'Relatório Semanal de Uso';
                const accentBlue = [20, 101, 235];
                const accentGreen = [16, 185, 108];

                drawUsageReportHeader(doc);
                doc.setTextColor(8, 27, 66);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.text(title, 10, 42);

                const infoWidth = (pageWidth - 24) / 3;
                const periodLabel = `${formatDateBR(range.start)} até ${formatDateBR(range.end)}`;
                drawUsageInfoCard(doc, 8, 48, infoWidth, 'Período:', periodLabel, accentBlue);
                drawUsageInfoCard(doc, 12 + infoWidth, 48, infoWidth, 'Status:', statusLabel, accentBlue);
                drawUsageInfoCard(doc, 16 + infoWidth * 2, 48, infoWidth, 'Gerado em:', new Date().toLocaleString('pt-BR'), accentBlue);

                const metricWidth = (pageWidth - 28) / 4;
                drawUsageMetricCard(doc, 8, 66, metricWidth, reportLoans.length, 'Registros', accentBlue, '#');
                drawUsageMetricCard(doc, 12 + metricWidth, 66, metricWidth, totalQuantity, 'Quantidade total', accentGreen, '=');
                drawUsageMetricCard(doc, 16 + metricWidth * 2, 66, metricWidth, uniqueClasses, 'Turmas', [112, 63, 205], 'T');
                drawUsageMetricCard(doc, 20 + metricWidth * 3, 66, metricWidth, uniqueTeachers, 'Professores', [249, 115, 22], 'P');

                const summaryTop = 87;
                const summaryHeight = 110;
                const summaryWidth = (pageWidth - 20) / 2;
                drawUsageSummaryCard(doc, 8, summaryTop, summaryWidth, summaryHeight, 'Resumo por sala', roomSummary, accentBlue, reportLoans.length);
                drawUsageSummaryCard(doc, 12 + summaryWidth, summaryTop, summaryWidth, summaryHeight, 'Resumo por professor', teacherSummary, accentGreen, reportLoans.length);

                const detailTitleY = 215;
                drawUsageDetailTitle(doc, detailTitleY);

                doc.autoTable({
                    startY: detailTitleY + 4,
                    head: [[
                        '#', 'Data/Hora', 'Turma/Sala', 'Professor', 'Tipo disp.',
                        'Tipo saída', 'Qtd.', 'Responsável', 'Status', 'Obs.'
                    ]],
                    body: rows,
                    theme: 'grid',
                    margin: { top: 47, right: 8, bottom: 18, left: 8 },
                    styles: {
                        font: 'helvetica',
                        fontSize: 5,
                        cellPadding: 1.35,
                        minCellHeight: 8.5,
                        textColor: [30, 41, 59],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.25,
                        overflow: 'linebreak',
                        valign: 'middle'
                    },
                    headStyles: {
                        fillColor: [112, 63, 205],
                        textColor: 255,
                        fontStyle: 'bold',
                        halign: 'center',
                        minCellHeight: 8
                    },
                    alternateRowStyles: { fillColor: [250, 251, 253] },
                    columnStyles: {
                        0: { cellWidth: 6, halign: 'center' },
                        1: { cellWidth: 22 },
                        2: { cellWidth: 20 },
                        3: { cellWidth: 22 },
                        4: { cellWidth: 18 },
                        5: { cellWidth: 20 },
                        6: { cellWidth: 9, halign: 'center' },
                        7: { cellWidth: 20 },
                        8: { cellWidth: 17, halign: 'center' },
                        9: { cellWidth: 40 }
                    },
                    didParseCell: hook => {
                        if (hook.section === 'body' && hook.column.index === 8) {
                            hook.cell.styles.fontStyle = 'bold';
                            const status = String(hook.cell.raw || '');
                            if (status === 'Devolvido') {
                                hook.cell.styles.fillColor = [225, 248, 235];
                                hook.cell.styles.textColor = [21, 128, 61];
                            } else if (status === 'Em uso') {
                                hook.cell.styles.fillColor = [219, 234, 254];
                                hook.cell.styles.textColor = [29, 78, 216];
                            } else {
                                hook.cell.styles.fillColor = [254, 226, 226];
                                hook.cell.styles.textColor = [185, 28, 28];
                            }
                        }
                    },
                    didDrawPage: hook => {
                        if (hook.pageNumber > 1) {
                            drawUsageReportHeader(doc);
                            drawUsageDetailTitle(doc, 41, true);
                        }
                    }
                });

                const pageCount = doc.getNumberOfPages();
                for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
                    doc.setPage(pageNumber);
                    drawUsageReportFooter(doc, pageNumber, pageCount);
                }

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

        async function generateFullBackupPdf() {
            try {
                await ensurePdfLibraries();
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
