document.addEventListener('DOMContentLoaded', () => {
    const feedList = document.getElementById('live-feed-list');
    if (!feedList) return;
    
    feedList.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.btn-add-to-fleet');
        if (!addBtn) return;
        
        e.stopPropagation();
        
        const hullId = addBtn.dataset.hull;
        const regModal = document.getElementById('register-modal');
        const regForm = document.getElementById('register-form');
        
        if (regModal && regForm) {
            regForm.reset();
            regModal.querySelector('h3').textContent = 'Register OHT Vehicle';
            const hullInput = document.getElementById('reg-hull-id');
            if (hullInput) {
                hullInput.value = hullId;
            }
            regModal.classList.remove('hidden');
        }
    });
});
