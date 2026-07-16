document.addEventListener('DOMContentLoaded', () => {
    const btnManage = document.getElementById('btn-manage-targets');
    const modal = document.getElementById('targets-modal');
    const overlay = document.getElementById('targets-modal-overlay');
    const btnClose = document.getElementById('btn-close-targets');
    const form = document.getElementById('targets-form');
    const contractorSelect = document.getElementById('target-contractor-select');
    const rateInput = document.getElementById('target-rate-input');

    if (!btnManage) return;

    btnManage.onclick = async () => {
        // Load latest contractor performance to get contractor names and target rates
        try {
            const res = await fetch('/api/reports/contractor-performance');
            if (res.ok) {
                const data = await res.json();
                const contractors = Object.keys(data.contractors || {});
                
                contractorSelect.innerHTML = contractors.map(c => `<option value="${c}">${c}</option>`).join('');
                
                // Set initial rate for selected contractor
                const selected = contractorSelect.value;
                if (selected && data.contractors[selected]) {
                    rateInput.value = data.contractors[selected].target_threshold;
                }
                
                contractorSelect.onchange = () => {
                    const sel = contractorSelect.value;
                    if (sel && data.contractors[sel]) {
                        rateInput.value = data.contractors[sel].target_threshold;
                    }
                };

                modal.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Failed to load contractor list:', e);
        }
    };

    const hideModal = () => modal.classList.add('hidden');
    btnClose.onclick = hideModal;
    overlay.onclick = hideModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const contractor = contractorSelect.value;
        const targetRate = parseFloat(rateInput.value);

        if (!contractor || isNaN(targetRate)) return;

        try {
            const res = await fetch('/api/reports/contractor-performance/targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractor, target_rate: targetRate })
            });

            if (res.ok) {
                // If on reports tab, refresh reports
                const reportsTab = document.getElementById('tab-reports');
                if (reportsTab && reportsTab.classList.contains('active')) {
                    const refreshBtn = document.getElementById('btn-refresh-reports');
                    if (refreshBtn) refreshBtn.click();
                }
                hideModal();
            } else {
                alert('Failed to update target threshold.');
            }
        } catch (err) {
            console.error('Error updating target rate:', err);
        }
    };
});
