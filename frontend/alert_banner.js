document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('offline-alert-banner');
    const label = document.getElementById('offline-alert-text');
    const btnClose = document.getElementById('btn-close-offline-banner');

    if (!banner || !label || !btnClose) return;

    let isDismissed = false;

    btnClose.addEventListener('click', () => {
        banner.classList.add('hidden');
        isDismissed = true;
    });

    const checkTowersStatus = async () => {
        try {
            const res = await fetch('/api/telemetry/towers');
            if (!res.ok) return;

            const towers = await res.json();
            const offlineTowers = towers.filter(t => t.status === 'offline');

            if (offlineTowers.length > 0) {
                if (!isDismissed) {
                    const names = offlineTowers.map(t => t.id).join(', ');
                    label.textContent = `⚠️ Critical: Mobile Gate Skid [ ${names} ] is OFFLINE!`;
                    banner.classList.remove('hidden');
                }
            } else {
                banner.classList.add('hidden');
                isDismissed = false;
            }
        } catch (err) {
            console.error("Alert Banner status fetch error:", err);
        }
    };

    setInterval(checkTowersStatus, 5000);
    checkTowersStatus();
});
