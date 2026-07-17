document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-schedule-reports');
    const modal = document.getElementById('schedule-modal');
    const btnClose = document.getElementById('btn-close-schedule');
    const form = document.getElementById('schedule-form');
    
    const inputRecipient = document.getElementById('schedule-recipient');
    const inputInterval = document.getElementById('schedule-interval');
    const inputEnabled = document.getElementById('schedule-enabled');
    
    if (!btnOpen || !modal || !form) return;
    
    btnOpen.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/admin/reports/email-schedule-settings');
            if (!res.ok) throw new Error("Failed to load email schedule settings.");
            
            const data = await res.json();
            inputRecipient.value = data.recipient || '';
            inputInterval.value = data.interval_minutes || 60;
            inputEnabled.checked = data.is_enabled === true || data.is_enabled === 'true';
            
            modal.classList.remove('hidden');
        } catch (err) {
            if (window.showToast) window.showToast(err.message, "danger");
        }
    });
    
    const closeModal = () => {
        modal.classList.add('hidden');
    };
    
    btnClose.addEventListener('click', closeModal);
    const overlay = document.getElementById('schedule-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            recipient: inputRecipient.value,
            interval_minutes: parseInt(inputInterval.value),
            is_enabled: inputEnabled.checked
        };
        
        try {
            const res = await fetch('/api/admin/reports/email-schedule-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to save email schedule settings.");
            }
            
            if (window.showToast) window.showToast("Automated email dispatch schedule updated successfully!", "success");
            closeModal();
        } catch (err) {
            if (window.showToast) window.showToast(err.message, "danger");
        }
    });
});
