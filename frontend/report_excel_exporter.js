document.addEventListener('DOMContentLoaded', () => {
    const btnExportXlsx = document.getElementById('btn-export-xlsx');
    if (!btnExportXlsx) return;

    btnExportXlsx.addEventListener('click', () => {
        if (window.showToast) window.showToast("Generating reconciliation Excel report...", "info");
        window.location.href = '/api/reports/reconciliation-export';
    });
});
