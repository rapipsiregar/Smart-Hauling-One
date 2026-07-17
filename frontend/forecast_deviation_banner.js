document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('forecast-deviation-alert-banner');
    const closeBtn = document.getElementById('btn-close-forecast-banner');
    let isDismissed = false;

    if (closeBtn && banner) {
        closeBtn.onclick = () => {
            banner.classList.add('hidden');
            isDismissed = true;
        };
    }

    window.updateForecastDeviationBanner = (predictions) => {
        if (!banner) return;
        if (isDismissed) return;

        const behindContractors = [];
        let hasCriticalBehind = false;

        Object.keys(predictions).forEach(contractor => {
            const val = predictions[contractor];
            const projected = val.projected_ritase;
            const target = val.shift_target;

            if (target > 0) {
                const ratio = projected / target;
                if (ratio < 0.75) {
                    behindContractors.push({
                        name: contractor,
                        projected: projected,
                        target: target,
                        ratio: ratio
                    });
                    if (ratio < 0.50) {
                        hasCriticalBehind = true;
                    }
                }
            }
        });

        if (behindContractors.length === 0) {
            banner.classList.add('hidden');
            return;
        }

        // Format warning message
        const warnings = behindContractors.map(c => 
            `${c.name} (Projected: ${c.projected} / Target: ${c.target})`
        ).join(', ');

        const alertText = document.getElementById('forecast-deviation-alert-text');
        if (alertText) {
            alertText.textContent = `⚠️ Target Deviation: ${warnings}`;
        }

        // Adjust banner styles based on severity
        if (hasCriticalBehind) {
            banner.style.background = 'var(--danger)';
            banner.style.color = 'white';
            if (closeBtn) closeBtn.style.color = 'white';
            banner.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
        } else {
            banner.style.background = 'var(--warning)';
            banner.style.color = 'black';
            if (closeBtn) closeBtn.style.color = 'black';
            banner.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
        }

        banner.classList.remove('hidden');
    };
});
