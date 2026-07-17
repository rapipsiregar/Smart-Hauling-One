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
        const checkedDirs = Array.from(document.querySelectorAll('.direction-filter-cb:checked')).map(cb => cb.value.toLowerCase());
        const activeBtn = document.querySelector('.btn-quick-filter-tag.active');
        const activeFilter = activeBtn ? activeBtn.dataset.filter : 'all';
        const searchInput = document.getElementById('feed-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        const cards = document.querySelectorAll('.crossing-feed-card');
        cards.forEach(card => {
            const vClass = card.dataset.class || 'Dump Truck';
            const isClassMatch = checkedClasses.includes(vClass);
            
            const vDir = (card.dataset.direction || 'inbound').toLowerCase();
            const isDirMatch = checkedDirs.includes(vDir);
            
            const confidence = parseFloat(card.dataset.confidence || '100');
            const warning = card.dataset.warning || 'normal';
            const unregistered = card.dataset.unregistered === 'true';
            
            const ohtSpan = card.querySelector('.oht-id');
            const origHullId = card.dataset.hullId || (ohtSpan ? ohtSpan.textContent.trim() : '');
            if (!card.dataset.hullId && origHullId) {
                card.dataset.hullId = origHullId;
            }
            
            let isSearchMatch = true;
            if (query) {
                isSearchMatch = origHullId.toLowerCase().includes(query);
            }
            
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
            
            if (isClassMatch && isDirMatch && isQuickMatch && isSearchMatch) {
                card.classList.remove('hidden');
                
                // Highlight search matches
                if (ohtSpan && origHullId) {
                    if (query) {
                        const idx = origHullId.toLowerCase().indexOf(query);
                        const part1 = origHullId.substring(0, idx);
                        const part2 = origHullId.substring(idx, idx + query.length);
                        const part3 = origHullId.substring(idx + query.length);
                        ohtSpan.innerHTML = `${part1}<mark class="search-highlight">${part2}</mark>${part3}`;
                    } else {
                        ohtSpan.textContent = origHullId;
                    }
                }
            } else {
                card.classList.add('hidden');
                if (ohtSpan && origHullId) {
                    ohtSpan.textContent = origHullId;
                }
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

    document.querySelectorAll('.direction-filter-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
        });
    });

    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', window.applyAllFilters);
    }

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
