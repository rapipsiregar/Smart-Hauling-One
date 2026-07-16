document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-open-warning');
    const modal = document.getElementById('warning-modal');
    const btnClose = document.getElementById('btn-close-warning');
    const overlay = document.getElementById('warning-modal-overlay');
    const form = document.getElementById('warning-form');
    const select = document.getElementById('warn-contractor-select');

    const toggleModal = (show) => {
        if (modal) modal.classList.toggle('hidden', !show);
    };

    if (btnOpen) {
        btnOpen.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/reports/contractor-performance');
                if (response.ok) {
                    const data = await response.json();
                    const contractors = Object.keys(data.contractors || {});
                    if (select) {
                        select.innerHTML = contractors.map(c => `<option value="${c}">${c}</option>`).join('');
                    }
                }
            } catch (e) {
                console.error("Failed to load contractors for warnings select", e);
            }
            toggleModal(true);
        });
    }

    if (btnClose) btnClose.addEventListener('click', () => toggleModal(false));
    if (overlay) overlay.addEventListener('click', () => toggleModal(false));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const recipient_email = document.getElementById('warn-email-input').value;
            const contractor = select.value;
            
            try {
                const response = await fetch('/api/reports/contractor-performance/send-warning', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient_email, contractor })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Warning sent to ${recipient_email}!`);
                    } else {
                        alert(data.message);
                    }
                    toggleModal(false);
                    form.reset();
                } else {
                    const err = await response.text();
                    alert(`Failed to send warning email: ${err}`);
                }
            } catch (err) {
                alert(`Error submitting warning email: ${err.message}`);
            }
        });
    }
});
