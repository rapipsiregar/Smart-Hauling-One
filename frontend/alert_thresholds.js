document.addEventListener('DOMContentLoaded', () => {
    const btnEdit = document.getElementById('btn-edit-thresholds');
    const modal = document.getElementById('thresholds-modal');
    const btnClose = document.getElementById('btn-close-thresholds');
    const form = document.getElementById('thresholds-form');
    
    const inputBattery = document.getElementById('thresh-battery');
    const inputSolar = document.getElementById('thresh-solar');
    const inputLatency = document.getElementById('thresh-latency');

    if (!btnEdit || !modal || !form) return;

    btnEdit.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/telemetry/thresholds');
            if (!res.ok) throw new Error("Failed to fetch current alert thresholds.");
            
            const data = await res.json();
            inputBattery.value = data.battery_low || 30;
            inputSolar.value = data.solar_low || 50;
            inputLatency.value = data.latency_high || 250;
            
            modal.classList.remove('hidden');
        } catch (err) {
            if (window.showToast) window.showToast(err.message, "danger");
        }
    });

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    btnClose.addEventListener('click', closeModal);
    document.getElementById('thresholds-modal-overlay').addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            thresholds: {
                battery_low: parseFloat(inputBattery.value),
                solar_low: parseFloat(inputSolar.value),
                latency_high: parseFloat(inputLatency.value)
            }
        };

        try {
            const res = await fetch('/api/admin/alert-thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to update alert thresholds.");
            }

            if (window.showToast) window.showToast("Alert thresholds updated successfully!", "success");
            closeModal();
            
            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData();
            }
        } catch (err) {
            if (window.showToast) window.showToast(err.message, "danger");
        }
    });
});
