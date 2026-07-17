document.addEventListener('DOMContentLoaded', () => {
    let editingHullId = null;
    const regModal = document.getElementById('register-modal');
    const regForm = document.getElementById('register-form');
    
    if (!regModal || !regForm) return;

    window.getFleetTrucks = () => window.fleetTrucks || [];

    function renderFleetTable() {
        const tbody = document.getElementById('fleet-tbody');
        if (!tbody) return;
        
        const q = (document.getElementById('fleet-search-input')?.value || '').trim().toLowerCase();
        const trucks = window.fleetTrucks || [];
        
        const filtered = trucks.filter(t => {
            return t.hull_id.toLowerCase().includes(q) || 
                   t.contractor.toLowerCase().includes(q) || 
                   t.model.toLowerCase().includes(q);
        });
        
        tbody.innerHTML = filtered.map(t => {
            let hullDisplay = t.hull_id;
            if (q && t.hull_id.toLowerCase().includes(q)) {
                const idx = t.hull_id.toLowerCase().indexOf(q);
                const originalText = t.hull_id.substring(idx, idx + q.length);
                hullDisplay = t.hull_id.substring(0, idx) + `<mark class="search-highlight" style="background: var(--primary); color: var(--bg); border-radius: 2px; padding: 0 2px;">${originalText}</mark>` + t.hull_id.substring(idx + q.length);
            }
            
            return `<tr>
                <td><strong>${hullDisplay}</strong></td>
                <td>${t.contractor}</td>
                <td>${t.model}</td>
                <td><label class="switch"><input type="checkbox" class="toggle-truck-status" data-hull="${t.hull_id}" ${t.status === 'active' ? 'checked' : ''}><span class="slider-toggle"></span></label></td>
                <td>
                    <button class="btn btn-secondary btn-sm edit-truck-btn" data-hull="${t.hull_id}" data-contractor="${t.contractor}" data-model="${t.model}" data-status="${t.status}">✏ Edit</button>
                    <button class="btn btn-danger btn-sm delete-truck-btn" data-hull="${t.hull_id}" style="margin-left: 0.5rem; background: var(--danger); border-color: var(--danger); color: white;">🗑 Delete</button>
                </td>
            </tr>`;
        }).join('');
        
        // Re-bind actions
        document.querySelectorAll('.toggle-truck-status').forEach(cb => cb.onchange = async () => {
            const hull = cb.dataset.hull, status = cb.checked ? 'active' : 'inactive';
            try { 
                if ((await fetch(`/api/trucks/${hull}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })).ok) {
                    if (typeof window.showToast === 'function') window.showToast(`OHT ${hull} status synced!`); 
                } else throw new Error(); 
            } catch (e) { 
                cb.checked = !cb.checked; 
                alert('Failed to sync status.'); 
            }
        });

        document.querySelectorAll('.edit-truck-btn').forEach(btn => btn.onclick = () => {
            editingHullId = btn.dataset.hull;
            regModal.querySelector('h3').textContent = 'Edit OHT Vehicle';
            document.getElementById('reg-hull-id').value = btn.dataset.hull;
            document.getElementById('reg-contractor').value = btn.dataset.contractor;
            document.getElementById('reg-model').value = btn.dataset.model;
            document.getElementById('reg-status').value = btn.dataset.status;
            regModal.classList.remove('hidden');
        });

        document.querySelectorAll('.delete-truck-btn').forEach(btn => btn.onclick = async () => {
            const hull = btn.dataset.hull;
            if (confirm(`Are you sure you want to delete OHT ${hull}?`)) {
                try {
                    const res = await fetch(`/api/trucks/${hull}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (typeof window.showToast === 'function') window.showToast(`OHT ${hull} deleted successfully.`);
                        window.loadFleetData();
                    } else {
                        throw new Error(await res.text());
                    }
                } catch (e) {
                    alert(`Failed to delete truck: ${e.message}`);
                }
            }
        });
    }

    window.loadFleetData = async () => {
        try {
            let fleetTrucks = [];
            try { 
                fleetTrucks = await (await fetch('/api/trucks')).json(); 
                localStorage.setItem('fleet_trucks_cache', JSON.stringify(fleetTrucks)); 
            } catch (e) { 
                fleetTrucks = JSON.parse(localStorage.getItem('fleet_trucks_cache') || '[]'); 
            }
            window.fleetTrucks = fleetTrucks;
            renderFleetTable();
        } catch (err) { console.error(err); }
    };

    const fleetSearchInput = document.getElementById('fleet-search-input');
    if (fleetSearchInput) {
        fleetSearchInput.oninput = renderFleetTable;
    }

    document.getElementById('btn-open-register').onclick = () => {
        editingHullId = null;
        regModal.querySelector('h3').textContent = 'Register OHT Vehicle';
        regForm.reset();
        regModal.classList.remove('hidden');
    };

    ['btn-close-register', 'register-modal-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => regModal.classList.add('hidden');
    });
    
    regForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            hull_id: document.getElementById('reg-hull-id').value,
            contractor: document.getElementById('reg-contractor').value,
            model: document.getElementById('reg-model').value,
            status: document.getElementById('reg-status').value
        };
        const url = editingHullId ? `/api/trucks/${editingHullId}` : '/api/trucks';
        const method = editingHullId ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(await res.text());
            regModal.classList.add('hidden');
            regForm.reset();
            window.loadFleetData();
            if (typeof window.showToast === 'function') {
                window.showToast(editingHullId ? 'OHT vehicle updated successfully!' : 'OHT vehicle registered successfully!');
            }
        } catch (err) {
            alert(err.message);
        }
    };
});
