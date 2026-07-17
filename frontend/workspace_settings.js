document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-open-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const drawer = document.getElementById('settings-drawer');
    const inputVolume = document.getElementById('settings-audio-volume');
    const labelVolume = document.getElementById('settings-volume-label');
    const selectRange = document.getElementById('settings-charts-range');
    const selectRefresh = document.getElementById('settings-refresh-interval');
    const btnSave = document.getElementById('btn-save-settings');

    const inputThreshBattery = document.getElementById('settings-thresh-battery');
    const labelThreshBattery = document.getElementById('settings-thresh-battery-label');
    const inputThreshSolar = document.getElementById('settings-thresh-solar');
    const labelThreshSolar = document.getElementById('settings-thresh-solar-label');
    const inputThreshLatency = document.getElementById('settings-thresh-latency');
    const labelThreshLatency = document.getElementById('settings-thresh-latency-label');

    if (!btnOpen || !drawer) return;

    const loadPreferences = () => {
        const volume = localStorage.getItem('pref-audio-volume') || '80';
        const range = localStorage.getItem('pref-charts-range') || '12';
        const refresh = localStorage.getItem('pref-refresh-interval') || '30000';

        inputVolume.value = volume;
        labelVolume.textContent = `${volume}%`;
        selectRange.value = range;
        selectRefresh.value = refresh;
    };

    inputVolume.oninput = () => {
        labelVolume.textContent = `${inputVolume.value}%`;
    };

    if (inputThreshBattery && labelThreshBattery) {
        inputThreshBattery.oninput = () => {
            labelThreshBattery.textContent = `${inputThreshBattery.value}%`;
        };
    }
    if (inputThreshSolar && labelThreshSolar) {
        inputThreshSolar.oninput = () => {
            labelThreshSolar.textContent = `${inputThreshSolar.value}W`;
        };
    }
    if (inputThreshLatency && labelThreshLatency) {
        inputThreshLatency.oninput = () => {
            labelThreshLatency.textContent = `${inputThreshLatency.value}ms`;
        };
    }

    btnOpen.onclick = async () => {
        const backupsDrawer = document.getElementById('backups-drawer');
        const alertsDrawer = document.getElementById('alerts-drawer');
        if (backupsDrawer) backupsDrawer.classList.add('hidden');
        if (alertsDrawer) alertsDrawer.classList.add('hidden');
        drawer.classList.remove('hidden');

        try {
            const res = await fetch('/api/telemetry/thresholds');
            if (res.ok) {
                const data = await res.json();
                if (inputThreshBattery && labelThreshBattery) {
                    inputThreshBattery.value = data.battery_low || 30;
                    labelThreshBattery.textContent = `${inputThreshBattery.value}%`;
                }
                if (inputThreshSolar && labelThreshSolar) {
                    inputThreshSolar.value = data.solar_low || 50;
                    labelThreshSolar.textContent = `${inputThreshSolar.value}W`;
                }
                if (inputThreshLatency && labelThreshLatency) {
                    inputThreshLatency.value = data.latency_high || 250;
                    labelThreshLatency.textContent = `${inputThreshLatency.value}ms`;
                }
            }
        } catch (err) {
            console.error("Failed to load telemetry thresholds", err);
        }
    };

    btnClose.onclick = () => {
        drawer.classList.add('hidden');
    };

    btnSave.onclick = async () => {
        localStorage.setItem('pref-audio-volume', inputVolume.value);
        localStorage.setItem('pref-charts-range', selectRange.value);
        localStorage.setItem('pref-refresh-interval', selectRefresh.value);

        if (inputThreshBattery && inputThreshSolar && inputThreshLatency) {
            const payload = {
                thresholds: {
                    battery_low: parseFloat(inputThreshBattery.value),
                    solar_low: parseFloat(inputThreshSolar.value),
                    latency_high: parseFloat(inputThreshLatency.value)
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
                    throw new Error(errData.detail || "Failed to update backend thresholds.");
                }
            } catch (err) {
                if (window.showToast) window.showToast(err.message, "danger");
                return;
            }
        }

        if (window.showToast) window.showToast('Workspace settings saved!', 'success');
        drawer.classList.add('hidden');
        if (typeof window.loadDashboardData === 'function') {
            window.loadDashboardData();
        }
    };

    loadPreferences();
});
