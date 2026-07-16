document.addEventListener('DOMContentLoaded', () => {
    const btnDetailed = document.getElementById('btn-layout-detailed');
    const btnCompact = document.getElementById('btn-layout-compact');

    if (!btnDetailed || !btnCompact) return;

    // Load saved layout mode
    const savedMode = localStorage.getItem('dashboard-layout-mode') || 'detailed';
    setLayoutMode(savedMode);

    btnDetailed.onclick = () => {
        setLayoutMode('detailed');
    };

    btnCompact.onclick = () => {
        setLayoutMode('compact');
    };

    function setLayoutMode(mode) {
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
