document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('feed-search-input');
    const suggestions = document.getElementById('search-history-suggestions');

    if (!searchInput || !suggestions) return;

    const getHistory = () => {
        try {
            return JSON.parse(localStorage.getItem('searchHistoryQueries')) || [];
        } catch (e) {
            return [];
        }
    };

    const saveQuery = (query) => {
        const trimmed = query.trim();
        if (!trimmed) return;

        let history = getHistory();
        history = history.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        history.unshift(trimmed);
        history = history.slice(0, 5);

        localStorage.setItem('searchHistoryQueries', JSON.stringify(history));
    };

    const showSuggestions = () => {
        const history = getHistory();
        if (!history.length) {
            suggestions.classList.add('hidden');
            return;
        }

        suggestions.innerHTML = history.map(q => `
            <div class="suggestion-item" style="padding:0.4rem 0.6rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.02); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                🕒 ${q}
            </div>
        `).join('');
        suggestions.classList.remove('hidden');
    };

    searchInput.addEventListener('focus', showSuggestions);

    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && !suggestions.contains(e.target)) {
            suggestions.classList.add('hidden');
        }
    });

    suggestions.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            const query = item.textContent.replace('🕒', '').trim();
            searchInput.value = query;
            if (typeof window.applyAllFilters === 'function') {
                window.applyAllFilters();
            }
            suggestions.classList.add('hidden');
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveQuery(searchInput.value);
            suggestions.classList.add('hidden');
            searchInput.blur();
        }
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            saveQuery(searchInput.value);
        }, 200);
    });
});
