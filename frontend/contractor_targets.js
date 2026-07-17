document.addEventListener('DOMContentLoaded', () => {
    const btnManage = document.getElementById('btn-manage-targets');
    const modal = document.getElementById('targets-modal');
    const overlay = document.getElementById('targets-modal-overlay');
    const btnClose = document.getElementById('btn-close-targets');
    const form = document.getElementById('targets-form');
    const contractorSelect = document.getElementById('target-contractor-select');
    const rateInput = document.getElementById('target-rate-input');
    const minFleetInput = document.getElementById('target-min-fleet-input');

    if (!btnManage) return;

    let performanceData = null;

    btnManage.onclick = async () => {
        try {
            const res = await fetch('/api/reports/contractor-performance');
            if (res.ok) {
                performanceData = await res.json();
                const contractors = Object.keys(performanceData.contractors || {});
                
                contractorSelect.innerHTML = contractors.map(c => `<option value="${c}">${c}</option>`).join('');
                
                // Set initial rate for selected contractor
                const selected = contractorSelect.value;
                if (selected && performanceData.contractors[selected]) {
                    rateInput.value = performanceData.contractors[selected].target_threshold;
                    minFleetInput.value = performanceData.contractors[selected].min_active_fleet || 5;
                }
                
                updateTargetPreview();
                modal.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Failed to load contractor list:', e);
        }
    };

    contractorSelect.onchange = () => {
        const sel = contractorSelect.value;
        if (sel && performanceData && performanceData.contractors[sel]) {
            rateInput.value = performanceData.contractors[sel].target_threshold;
            minFleetInput.value = performanceData.contractors[sel].min_active_fleet || 5;
        }
        updateTargetPreview();
    };

    rateInput.oninput = updateTargetPreview;
    minFleetInput.oninput = updateTargetPreview;

    function updateTargetPreview() {
        const previewPct = document.getElementById('target-preview-pct');
        const previewUtil = document.getElementById('target-preview-util');
        const previewBox = document.getElementById('target-preview-box');
        if (!previewPct || !previewUtil || !previewBox || !performanceData) return;

        const sel = contractorSelect.value;
        const targetRate = parseFloat(rateInput.value);
        const minFleet = parseInt(minFleetInput.value);

        if (!sel || !performanceData.contractors[sel] || isNaN(targetRate) || targetRate <= 0 || isNaN(minFleet) || minFleet <= 0) {
            previewPct.textContent = '--';
            previewUtil.textContent = '--';
            previewBox.style.borderColor = 'var(--border)';
            return;
        }

        const hourlyCapacity = performanceData.contractors[sel].hourly_capacity || 0.0;
        const compliance = Math.round(Math.min((hourlyCapacity / targetRate) * 100, 100.0) * 10) / 10;
        
        const loggedTrucks = performanceData.contractors[sel].logged_active_trucks || 0;
        const utilization = Math.round(Math.min((loggedTrucks / minFleet) * 100, 100.0) * 10) / 10;

        previewPct.textContent = compliance;
        previewUtil.textContent = utilization;

        // Apply compliance indicator colors
        if (compliance >= 85) {
            previewBox.style.borderColor = 'var(--success)';
            previewPct.style.color = 'var(--success)';
        } else if (compliance >= 50) {
            previewBox.style.borderColor = 'var(--warning)';
            previewPct.style.color = 'var(--warning)';
        } else {
            previewBox.style.borderColor = 'var(--danger)';
            previewPct.style.color = 'var(--danger)';
        }
    }

    const hideModal = () => modal.classList.add('hidden');
    btnClose.onclick = hideModal;
    overlay.onclick = hideModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const contractor = contractorSelect.value;
        const targetRate = parseFloat(rateInput.value);
        const minFleet = parseInt(minFleetInput.value);

        if (!contractor || isNaN(targetRate) || isNaN(minFleet)) return;

        try {
            const res = await fetch('/api/reports/contractor-performance/targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractor, target_rate: targetRate, min_active_fleet: minFleet })
            });

            if (res.ok) {
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
