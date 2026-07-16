document.addEventListener('DOMContentLoaded', () => {
    let sortCol = 'timestamp';
    let sortOrder = 'desc'; // 'asc' or 'desc'

    window.sortDiscrepancies = (filteredList) => {
        filteredList.sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];
            if (sortCol === 'severity') {
                const weights = { 'high': 3, 'medium': 2, 'low': 1 };
                valA = weights[a.severity] || 0;
                valB = weights[b.severity] || 0;
            } else if (sortCol === 'timestamp') {
                valA = new Date(a.timestamp).getTime();
                valB = new Date(b.timestamp).getTime();
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const updateIcons = () => {
        const tsIcon = document.getElementById('sort-ts-icon');
        const sevIcon = document.getElementById('sort-severity-icon');
        if (tsIcon && sevIcon) {
            tsIcon.textContent = sortCol === 'timestamp' ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅';
            sevIcon.textContent = sortCol === 'severity' ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅';
        }
    };

    const toggleSort = (col) => {
        if (sortCol === col) {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            sortCol = col;
            sortOrder = 'desc';
        }
        updateIcons();
        if (typeof window.renderReports === 'function') {
            window.renderReports();
        }
    };

    const btnTs = document.getElementById('btn-sort-ts');
    const btnSev = document.getElementById('btn-sort-severity');
    if (btnTs) btnTs.addEventListener('click', () => toggleSort('timestamp'));
    if (btnSev) btnSev.addEventListener('click', () => toggleSort('severity'));
    
    updateIcons();
});
