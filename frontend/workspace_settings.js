document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-open-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const drawer = document.getElementById('settings-drawer');
    const inputVolume = document.getElementById('settings-audio-volume');
    const labelVolume = document.getElementById('settings-volume-label');
    const selectRange = document.getElementById('settings-charts-range');
    const selectRefresh = document.getElementById('settings-refresh-interval');
    const btnSave = document.getElementById('btn-save-settings');

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

    btnOpen.onclick = () => {
        const backupsDrawer = document.getElementById('backups-drawer');
        const alertsDrawer = document.getElementById('alerts-drawer');
        if (backupsDrawer) backupsDrawer.classList.add('hidden');
        if (alertsDrawer) alertsDrawer.classList.add('hidden');
        drawer.classList.remove('hidden');
    };

    btnClose.onclick = () => {
        drawer.classList.add('hidden');
    };

    btnSave.onclick = () => {
        localStorage.setItem('pref-audio-volume', inputVolume.value);
        localStorage.setItem('pref-charts-range', selectRange.value);
        localStorage.setItem('pref-refresh-interval', selectRefresh.value);

        if (window.showToast) window.showToast('Workspace settings saved!', 'success');
        drawer.classList.add('hidden');
    };

    loadPreferences();
});
