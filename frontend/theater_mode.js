document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-theater-mode');
    const btnCollapse = document.getElementById('btn-collapse-audit');
    const card = document.querySelector('.visual-audit-card');

    if (btn && card) {
        btn.addEventListener('click', () => {
            const isTheater = card.classList.toggle('theater-active');
            document.body.classList.toggle('theater-open', isTheater);
            btn.textContent = isTheater ? '❌ Exit Theater' : '🎭 Theater Mode';
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && card.classList.contains('theater-active')) {
                card.classList.remove('theater-active');
                document.body.classList.remove('theater-open');
                btn.textContent = '🎭 Theater Mode';
            }
        });
    }

    if (btnCollapse && card) {
        btnCollapse.addEventListener('click', () => {
            const isCollapsed = card.classList.toggle('audit-collapsed');
            btnCollapse.textContent = isCollapsed ? '➕ Expand' : '➖ Collapse';
        });
    }
});
