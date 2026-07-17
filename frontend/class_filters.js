document.addEventListener('DOMContentLoaded', () => {
    const filters = document.querySelectorAll('.class-filter-cb');
    
    const applyFilters = () => {
        if (typeof window.applyAllFilters === 'function') {
            window.applyAllFilters();
            return;
        }
        const checked = Array.from(document.querySelectorAll('.class-filter-cb:checked')).map(cb => cb.value);
        const cards = document.querySelectorAll('.crossing-feed-card');
        cards.forEach(card => {
            const vClass = card.dataset.class || 'Dump Truck';
            if (checked.includes(vClass)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    };

    filters.forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });

    // Observe live-feed-list to apply filters dynamically as new crossings arrive
    const feedList = document.getElementById('live-feed-list');
    if (feedList) {
        const observer = new MutationObserver(applyFilters);
        observer.observe(feedList, { childList: true });
    }
});
