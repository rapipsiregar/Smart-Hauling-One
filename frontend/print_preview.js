document.addEventListener('DOMContentLoaded', () => {
    const btnPrint = document.getElementById('btn-print-report');
    const pModal = document.getElementById('print-modal');
    const pForm = document.getElementById('print-settings-form');

    if (!btnPrint || !pModal || !pForm) return;

    btnPrint.onclick = () => {
        pModal.classList.remove('hidden');
    };

    const previewModal = document.createElement('div');
    previewModal.id = 'print-preview-modal';
    previewModal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11,15,25,0.98); z-index:20000; display:flex; flex-direction:column; visibility:hidden; opacity:0; transition:opacity 0.25s ease, visibility 0.25s;';
    previewModal.innerHTML = `
        <div style="background:#0f172a; padding:0.75rem 1.25rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
            <h3 style="margin:0; font-size:1rem; color:var(--text-primary);">🖨 Print PDF Report Preview & Layout Settings</h3>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-primary" id="btn-confirm-print">🖨 Open Print Dialog</button>
                <button class="btn btn-secondary" id="btn-cancel-preview">✕ Close</button>
            </div>
        </div>
        <div style="display:flex; height:calc(100% - 50px); background:#0b0f19;">
            <div style="width:260px; border-right:1px solid var(--border); padding:1.25rem; display:flex; flex-direction:column; gap:1.25rem; background:#0f172a; overflow-y:auto; font-size:0.85rem; color:var(--text-secondary);">
                <h4 style="margin:0; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:0.4rem;">Layout Adjustments</h4>
                
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; color:var(--text-primary);">Report Font Size: <span id="preview-val-font">12px</span></label>
                    <input type="range" id="preview-slider-font" min="8" max="22" value="12" style="width:100%;">
                </div>

                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; color:var(--text-primary);">Table Cell Padding: <span id="preview-val-padding">6px</span></label>
                    <input type="range" id="preview-slider-padding" min="2" max="16" value="6" style="width:100%;">
                </div>

                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; color:var(--text-primary);">Document Orientation</label>
                    <select id="preview-select-orientation" style="width:100%; padding:0.3rem; background:var(--bg-card); border:1px solid var(--border); color:var(--text); border-radius:4px;">
                        <option value="portrait" selected>Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </div>

                <h4 style="margin:0; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:0.4rem; margin-top:0.5rem;">Column Visibility</h4>
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;"><input type="checkbox" id="preview-cb-timestamp" checked> Timestamp</label>
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;"><input type="checkbox" id="preview-cb-hullid" checked> Hull ID</label>
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;"><input type="checkbox" id="preview-cb-lane" checked> Lane</label>
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;"><input type="checkbox" id="preview-cb-direction" checked> Direction</label>
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;"><input type="checkbox" id="preview-cb-confidence" checked> Confidence</label>
                </div>
            </div>
            <div style="flex:1; padding:1rem; display:flex; justify-content:center; align-items:center; height:100%;">
                <iframe id="print-preview-iframe" style="width:100%; height:100%; border:none; background:#fff; border-radius:4px; box-shadow:0 4px 15px rgba(0,0,0,0.5);"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(previewModal);

    const updateIframeStyles = () => {
        const iframe = document.getElementById('print-preview-iframe');
        if (!iframe) return;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        let styleEl = iframeDoc.getElementById('preview-interactive-styles');
        if (!styleEl) {
            styleEl = iframeDoc.createElement('style');
            styleEl.id = 'preview-interactive-styles';
            iframeDoc.head.appendChild(styleEl);
        }
        
        const fontSize = document.getElementById('preview-slider-font').value;
        const cellPadding = document.getElementById('preview-slider-padding').value;
        const orientation = document.getElementById('preview-select-orientation').value;
        
        document.getElementById('preview-val-font').textContent = `${fontSize}px`;
        document.getElementById('preview-val-padding').textContent = `${cellPadding}px`;

        const colTimestamp = document.getElementById('preview-cb-timestamp').checked;
        const colHullId = document.getElementById('preview-cb-hullid').checked;
        const colLane = document.getElementById('preview-cb-lane').checked;
        const colDirection = document.getElementById('preview-cb-direction').checked;
        const colConfidence = document.getElementById('preview-cb-confidence').checked;

        styleEl.innerHTML = `
            body { font-size: ${fontSize}px !important; }
            th, td { padding: ${cellPadding}px !important; font-size: ${fontSize}px !important; }
            @page { size: ${orientation === 'landscape' ? 'landscape' : 'portrait'}; }
            
            ${!colTimestamp ? '.col-timestamp, td.col-timestamp { display: none !important; }' : ''}
            ${!colHullId ? '.col-hullid, td.col-hullid { display: none !important; }' : ''}
            ${!colLane ? '.col-lane, td.col-lane { display: none !important; }' : ''}
            ${!colDirection ? '.col-direction, td.col-direction { display: none !important; }' : ''}
            ${!colConfidence ? '.col-confidence, td.col-confidence { display: none !important; }' : ''}
        `;
        
        // Sync to main window
        let mainStyle = document.getElementById('print-dynamic-column-styles');
        if (!mainStyle) {
            mainStyle = document.createElement('style');
            mainStyle.id = 'print-dynamic-column-styles';
            document.head.appendChild(mainStyle);
        }
        mainStyle.innerHTML = `
            @media print {
                body { font-size: ${fontSize}px !important; }
                th, td { padding: ${cellPadding}px !important; font-size: ${fontSize}px !important; }
                @page { size: ${orientation === 'landscape' ? 'landscape' : 'portrait'}; }
                
                ${!colTimestamp ? '.col-timestamp, td.col-timestamp { display: none !important; }' : ''}
                ${!colHullId ? '.col-hullid, td.col-hullid { display: none !important; }' : ''}
                ${!colLane ? '.col-lane, td.col-lane { display: none !important; }' : ''}
                ${!colDirection ? '.col-direction, td.col-direction { display: none !important; }' : ''}
                ${!colConfidence ? '.col-confidence, td.col-confidence { display: none !important; }' : ''}
            }
        `;
    };

    // Attach event listeners
    const inputs = ['preview-slider-font', 'preview-slider-padding', 'preview-select-orientation', 'preview-cb-timestamp', 'preview-cb-hullid', 'preview-cb-lane', 'preview-cb-direction', 'preview-cb-confidence'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = el.onchange = updateIframeStyles;
    });

    document.getElementById('btn-confirm-print').onclick = () => {
        previewModal.style.visibility = 'hidden';
        previewModal.style.opacity = '0';
        window.print();
    };

    document.getElementById('btn-cancel-preview').onclick = () => {
        previewModal.style.visibility = 'hidden';
        previewModal.style.opacity = '0';
    };

    pForm.onsubmit = (e) => {
        e.preventDefault();
        
        // Pull form values
        const titleVal = document.getElementById('print-custom-title').value || 'Integrated Smart Hauling Dashboard Report';
        const startVal = document.getElementById('print-start-date').value;
        const endVal = document.getElementById('print-end-date').value;
        const clientVal = document.getElementById('print-client-name')?.value || '';
        const logoVal = document.getElementById('print-client-logo')?.value || '';

        // Apply metadata to main page elements
        const printTitle = document.getElementById('print-title-val');
        const printDate = document.getElementById('print-date-val');
        const printClient = document.getElementById('print-client-val');
        const printLogo = document.getElementById('print-logo-val');

        if (printTitle) printTitle.textContent = titleVal;
        if (printDate) {
            printDate.textContent = startVal && endVal ? `Report Period: ${startVal} to ${endVal}` : (startVal ? `Report Period: Since ${startVal}` : (endVal ? `Report Period: Up to ${endVal}` : `Report Date: ${new Date().toLocaleDateString()}`));
        }
        if (printClient) {
            printClient.textContent = clientVal ? `Client: ${clientVal}` : '';
            printClient.style.display = clientVal ? 'block' : 'none';
        }
        if (printLogo) {
            printLogo.src = logoVal;
            printLogo.style.display = logoVal ? 'block' : 'none';
        }

        pModal.classList.add('hidden');

        // Render preview frame content
        const iframe = document.getElementById('print-preview-iframe');
        if (iframe) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(document.documentElement.innerHTML);
            iframeDoc.close();

            const printLink = iframeDoc.querySelector('link[href*="print.css"]');
            if (printLink) {
                printLink.setAttribute('media', 'all');
            }

            // Hide UI elements in preview
            iframeDoc.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            iframeDoc.querySelectorAll('#print-preview-modal').forEach(m => m.remove());
        }

        updateIframeStyles();
        
        previewModal.style.visibility = 'visible';
        previewModal.style.opacity = '1';
    };
});
