document.addEventListener('DOMContentLoaded', () => {
    const quickButtons = document.querySelectorAll('.btn-quick-filter-tag');
    
    // Define active/inactive style mappings for each tag type
    const styles = {
        'all': { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'var(--border)' },
        'low-confidence': { bg: 'var(--danger)', color: '#fff', border: 'var(--danger)' },
        'unregistered': { bg: '#a855f7', color: '#fff', border: '#a855f7' },
        'cycle-discrepancy': { bg: 'var(--warning)', color: 'var(--bg-app)', border: 'var(--warning)' }
    };

    const updateButtonVisuals = () => {
        quickButtons.forEach(btn => {
            const filterType = btn.dataset.filter;
            const isActive = btn.classList.contains('active');
            
            if (isActive) {
                btn.style.background = styles[filterType].bg;
                btn.style.color = styles[filterType].color;
                btn.style.borderColor = styles[filterType].border;
            } else {
                btn.style.background = 'none';
                btn.style.color = styles[filterType].color;
                btn.style.borderColor = styles[filterType].border;
            }
        });
    };

    window.applyAllFilters = () => {
        const checkedClasses = Array.from(document.querySelectorAll('.class-filter-cb:checked')).map(cb => cb.value);
        const activeBtn = document.querySelector('.btn-quick-filter-tag.active');
        const activeFilter = activeBtn ? activeBtn.dataset.filter : 'all';
        
        const cards = document.querySelectorAll('.crossing-feed-card');
        cards.forEach(card => {
            const vClass = card.dataset.class || 'Dump Truck';
            const isClassMatch = checkedClasses.includes(vClass);
            
            const confidence = parseFloat(card.dataset.confidence || '100');
            const warning = card.dataset.warning || 'normal';
            const unregistered = card.dataset.unregistered === 'true';
            
            let isQuickMatch = false;
            if (activeFilter === 'all') {
                isQuickMatch = true;
            } else if (activeFilter === 'low-confidence') {
                isQuickMatch = (confidence < 85 || warning === 'low-confidence');
            } else if (activeFilter === 'unregistered') {
                isQuickMatch = unregistered;
            } else if (activeFilter === 'cycle-discrepancy') {
                isQuickMatch = (warning === 'cycle-discrepancy');
            }
            
            if (isClassMatch && isQuickMatch) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    };

    quickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            quickButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateButtonVisuals();
            window.applyAllFilters();
        });
    });

    // Handle class checkboxes to sync filters
    document.querySelectorAll('.class-filter-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
        });
    });

    // Apply initially
    updateButtonVisuals();
    window.applyAllFilters();

    // Observe live feed mutations to apply filters on newly generated cards
    const feedList = document.getElementById('live-feed-list');
    if (feedList) {
        const observer = new MutationObserver(window.applyAllFilters);
        observer.observe(feedList, { childList: true });
    }
});
