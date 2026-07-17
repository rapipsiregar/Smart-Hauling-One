document.addEventListener('DOMContentLoaded', () => {
    const pModal = document.getElementById('print-modal');
    const pForm = document.getElementById('print-settings-form');
    
    if (!pModal || !pForm) return;

    // Listen to print completion/cancellation
    window.addEventListener('afterprint', () => {
        // Automatically hide the print modal and its inputs
        pModal.classList.add('hidden');
        
        // Restore/Reset the original state of the inputs in the form
        pForm.reset();
        
        const customTitleInput = document.getElementById('print-custom-title');
        if (customTitleInput) {
            customTitleInput.value = 'Integrated Smart Hauling Dashboard Report';
        }
    });
    
    // Bind modal close trigger buttons
    ['btn-close-print-modal', 'print-modal-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = () => {
                pModal.classList.add('hidden');
                pForm.reset();
                const customTitleInput = document.getElementById('print-custom-title');
                if (customTitleInput) {
                    customTitleInput.value = 'Integrated Smart Hauling Dashboard Report';
                }
            };
        }
    });
});
