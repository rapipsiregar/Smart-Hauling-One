document.addEventListener('DOMContentLoaded', () => {
    const btnDetailed = document.getElementById('btn-layout-detailed');
    const btnCompact = document.getElementById('btn-layout-compact');

    if (!btnDetailed || !btnCompact) return;

    // Load saved layout mode
    const savedMode = localStorage.getItem('dashboard-layout-mode') || 'detailed';
    setLayoutMode(savedMode);

    btnDetailed.onclick = () => {
        const prev = document.body.classList.contains('layout-compact') ? 'compact' : 'detailed';
        if (prev !== 'detailed') {
            setLayoutMode('detailed');
            if (window.showUndoToast) {
                window.showUndoToast('Switched to Detailed layout', () => {
                    setLayoutMode('compact', true);
                });
            }
        }
    };

    btnCompact.onclick = () => {
        const prev = document.body.classList.contains('layout-compact') ? 'compact' : 'detailed';
        if (prev !== 'compact') {
            setLayoutMode('compact');
            if (window.showUndoToast) {
                window.showUndoToast('Switched to Compact layout', () => {
                    setLayoutMode('detailed', true);
                });
            }
        }
    };

    function setLayoutMode(mode, skipSave = false) {
        if (mode === 'compact') {
            document.body.classList.add('layout-compact');
            btnDetailed.classList.remove('active');
            btnCompact.classList.add('active');
        } else {
            document.body.classList.remove('layout-compact');
            btnDetailed.classList.add('active');
            btnCompact.classList.remove('active');
        }
        localStorage.setItem('dashboard-layout-mode', mode);
    }
});
