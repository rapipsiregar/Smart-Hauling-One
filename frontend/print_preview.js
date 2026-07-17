document.addEventListener('DOMContentLoaded', () => {
    const btnPrint = document.getElementById('btn-print-report');
    const pModal = document.getElementById('print-modal');
    const pForm = document.getElementById('print-settings-form');

    if (!btnPrint || !pModal || !pForm) return;

    // Open Print Settings Dialog
    btnPrint.onclick = () => {
        pModal.classList.remove('hidden');
    };

    // Create dynamic print preview modal layout overlay
    const previewModal = document.createElement('div');
    previewModal.id = 'print-preview-modal';
    previewModal.innerHTML = `
        <div class="preview-top-bar">
            <h3>🖨 Print PDF Report Preview</h3>
            <div class="preview-actions">
                <button class="btn btn-primary" id="btn-confirm-print">🖨 Open Print Dialog</button>
                <button class="btn btn-secondary" id="btn-cancel-preview">❌ Close Preview</button>
            </div>
        </div>
        <div class="preview-body">
            <div class="preview-frame-container">
                <iframe id="print-preview-iframe"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(previewModal);

    // Setup action buttons inside the preview overlay
    document.getElementById('btn-confirm-print').onclick = () => {
        previewModal.classList.remove('visible');
        window.print();
    };

    document.getElementById('btn-cancel-preview').onclick = () => {
        previewModal.classList.remove('visible');
    };

    // Intercept settings form submit and display preview first
    pForm.onsubmit = (e) => {
        e.preventDefault();
        const t = document.getElementById('print-custom-title').value || 'Integrated Smart Hauling Dashboard Report';
        const sd = document.getElementById('print-start-date').value;
        const ed = document.getElementById('print-end-date').value;

        const colTimestamp = document.getElementById('print-col-timestamp').checked;
        const colHullId = document.getElementById('print-col-hullid').checked;
        const colLane = document.getElementById('print-col-lane').checked;
        const colDirection = document.getElementById('print-col-direction').checked;
        const colConfidence = document.getElementById('print-col-confidence').checked;

        // Apply dynamic styles to parent page context (for window.print())
        let dynamicStyle = document.getElementById('print-dynamic-column-styles');
        if (!dynamicStyle) {
            dynamicStyle = document.createElement('style');
            dynamicStyle.id = 'print-dynamic-column-styles';
            document.head.appendChild(dynamicStyle);
        }
        dynamicStyle.innerHTML = `
            @media print {
                ${!colTimestamp ? '.col-timestamp, td.col-timestamp { display: none !important; }' : ''}
                ${!colHullId ? '.col-hullid, td.col-hullid { display: none !important; }' : ''}
                ${!colLane ? '.col-lane, td.col-lane { display: none !important; }' : ''}
                ${!colDirection ? '.col-direction, td.col-direction { display: none !important; }' : ''}
                ${!colConfidence ? '.col-confidence, td.col-confidence { display: none !important; }' : ''}
            }
        `;

        // Apply metadata parameters to custom header values
        const printTitleVal = document.getElementById('print-title-val');
        const printDateVal = document.getElementById('print-date-val');
        if (printTitleVal) printTitleVal.textContent = t;
        if (printDateVal) {
            printDateVal.textContent = sd && ed ? `Report Period: ${sd} to ${ed}` : (sd ? `Report Period: Since ${sd}` : (ed ? `Report Period: Up to ${ed}` : `Report Date: ${new Date().toLocaleDateString()}`));
        }

        pModal.classList.add('hidden');

        // Populate and show the preview modal iframe viewport
        const iframe = document.getElementById('print-preview-iframe');
        if (iframe) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(document.documentElement.innerHTML);
            iframeDoc.close();

            // Toggle print stylesheet media in preview frame document
            const printLink = iframeDoc.querySelector('link[href*="print.css"]');
            if (printLink) {
                printLink.setAttribute('media', 'all');
            }

            // Inject column visibility style overrides to iframe preview document
            const iframeStyle = iframeDoc.createElement('style');
            iframeStyle.innerHTML = `
                ${!colTimestamp ? '.col-timestamp, td.col-timestamp { display: none !important; }' : ''}
                ${!colHullId ? '.col-hullid, td.col-hullid { display: none !important; }' : ''}
                ${!colLane ? '.col-lane, td.col-lane { display: none !important; }' : ''}
                ${!colDirection ? '.col-direction, td.col-direction { display: none !important; }' : ''}
                ${!colConfidence ? '.col-confidence, td.col-confidence { display: none !important; }' : ''}
            `;
            iframeDoc.head.appendChild(iframeStyle);

            // Hide standard modals and self inside iframe
            iframeDoc.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            iframeDoc.querySelectorAll('#print-preview-modal').forEach(m => m.remove());
        }

        previewModal.classList.add('visible');
    };
});
