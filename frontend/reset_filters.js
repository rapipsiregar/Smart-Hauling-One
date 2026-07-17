document.addEventListener('DOMContentLoaded', () => {
    const btnReset = document.getElementById('btn-reset-filters');
    if (!btnReset) return;

    btnReset.addEventListener('click', () => {
        const searchInput = document.getElementById('feed-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        const checkboxes = document.querySelectorAll('.class-filter-cb');
        checkboxes.forEach(cb => {
            cb.checked = true;
        });

        const dirCheckboxes = document.querySelectorAll('.direction-filter-cb');
        dirCheckboxes.forEach(cb => {
            cb.checked = true;
        });

        const showAllBtn = document.querySelector('.btn-quick-filter-tag[data-filter="all"]');
        if (showAllBtn) {
            showAllBtn.click();
        } else if (typeof window.applyAllFilters === 'function') {
            window.applyAllFilters();
        }
        
        if (window.showToast) {
            window.showToast("Search filters reset successfully.", "success");
        }
    });
});
