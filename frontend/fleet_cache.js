document.addEventListener('DOMContentLoaded', () => {
    const inputContractor = document.getElementById('reg-contractor');
    const inputModel = document.getElementById('reg-model');
    const inputHull = document.getElementById('reg-hull-id');
    
    const suggContractor = document.getElementById('reg-contractor-suggestions');
    const suggModel = document.getElementById('reg-model-suggestions');
    
    if (!inputContractor || !inputModel) return;

    // Load cached fleet list
    const getCachedFleet = () => {
        try {
            return JSON.parse(localStorage.getItem('fleet_trucks_cache') || '[]');
        } catch (e) {
            return [];
        }
    };

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            suggContractor.classList.add('hidden');
            suggModel.classList.add('hidden');
        }
    });

    const setupSuggestions = (input, container, selectorFn) => {
        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            const fleet = getCachedFleet();
            
            // Get unique suggestions based on selectorFn
            const allItems = fleet.map(selectorFn).filter(Boolean);
            const uniqueItems = [...new Set(allItems)];
            
            // Filter by input value
            const matched = uniqueItems.filter(item => 
                !val || item.toLowerCase().includes(val)
            );
            
            if (matched.length && val.length > 0) {
                container.innerHTML = matched.map(item => `
                    <div class="suggestion-item" data-val="${item}">
                        <strong>${item}</strong>
                    </div>
                `).join('');
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        });

        container.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                input.value = item.dataset.val;
                container.classList.add('hidden');
                // Trigger input event to clear other suggestion lists if any
                input.dispatchEvent(new Event('input'));
            }
        });
    };

    setupSuggestions(inputContractor, suggContractor, t => t.contractor);
    setupSuggestions(inputModel, suggModel, t => t.model);
});
