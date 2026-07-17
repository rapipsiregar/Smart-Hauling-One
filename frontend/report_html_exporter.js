document.addEventListener('DOMContentLoaded', () => {
    const btnExportHtml = document.getElementById('btn-export-html');
    if (!btnExportHtml) return;

    btnExportHtml.onclick = async () => {
        try {
            let cssText = '';
            try {
                const response = await fetch('index.css');
                if (response.ok) {
                    cssText = await response.text();
                }
            } catch (err) {
                console.error('Failed to fetch index.css for export:', err);
            }

            const reportsGrid = document.querySelector('.reports-grid');
            if (!reportsGrid) return alert('No report data found to export.');

            // Clone the grid content to build report elements
            const clonedGrid = reportsGrid.cloneNode(true);

            // Clean up interactive filters inside cloned grid
            const discFilters = clonedGrid.querySelector('#disc-filters');
            if (discFilters) discFilters.remove();
            
            // Format supervisor notes for static display and remove interactive save button
            const origTextarea = document.getElementById('supervisor-notes-textarea');
            const clonedTextarea = clonedGrid.querySelector('#supervisor-notes-textarea');
            if (origTextarea && clonedTextarea) {
                const p = document.createElement('div');
                p.style.whiteSpace = 'pre-wrap';
                p.style.fontSize = '0.85rem';
                p.style.color = 'var(--text-primary)';
                p.textContent = origTextarea.value || '(No shift hand-over notes entered)';
                clonedTextarea.parentNode.replaceChild(p, clonedTextarea);
            }
            const clonedSaveBtn = clonedGrid.querySelector('#btn-save-notes');
            if (clonedSaveBtn) clonedSaveBtn.remove();
            
            const sortHeader = clonedGrid.querySelector('.discrepancy-header-row');
            if (sortHeader) {
                sortHeader.querySelectorAll('span').forEach(s => s.remove());
            }

            // Standalone template
            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Smart Gate - Hauling Operations Audit Report</title>
    <style>
        :root {
            --bg-app: #0f172a;
            --bg-card: rgba(30, 41, 59, 0.45);
            --border: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --primary: #38bdf8;
            --success: #10b981;
            --warning: #fbbf24;
            --danger: #ef4444;
            --font-family: 'Outfit', sans-serif;
        }
        
        body {
            background-color: #0f172a;
            color: #f8fafc;
            font-family: var(--font-family);
            margin: 0;
            padding: 2rem;
        }

        .export-header {
            border-bottom: 2px solid var(--border);
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }

        .export-header h1 {
            margin: 0;
            font-size: 2rem;
            color: var(--primary);
        }

        .export-header .meta {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
            display: flex;
            gap: 2rem;
        }

        ${cssText}

        .reports-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }

        .card {
            background: #1e293b !important;
            border: 1px solid var(--border) !important;
            border-radius: 12px;
            padding: 1rem;
            margin-top: 0 !important;
        }

        .discrepancies-list {
            max-height: none !important;
            overflow-y: visible !important;
        }
    </style>
</head>
<body>
    <div class="export-header">
        <h1>OHT Hauling Operations Audit Report</h1>
        <div class="meta">
            <div><strong>Generated At:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Lane Filter:</strong> ${document.getElementById('report-lane-filter').value || 'All Lanes'}</div>
            <div><strong>Search Term:</strong> "${document.getElementById('report-search-input').value || 'None'}"</div>
        </div>
    </div>
    <div class="reports-grid">
        ${clonedGrid.innerHTML}
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `OHT_Hauling_Report_${new Date().toISOString().slice(0, 10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof window.showToast === 'function') {
                window.showToast("Standalone HTML report exported!");
            }
        } catch (err) {
            console.error('HTML Report Export failed:', err);
            alert('Failed to export HTML report: ' + err.message);
        }
    };
});
