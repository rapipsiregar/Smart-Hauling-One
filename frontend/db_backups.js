document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-db-backups');
    const btnClose = document.getElementById('btn-close-backups');
    const drawer = document.getElementById('backups-drawer');
    const btnTrigger = document.getElementById('btn-trigger-backup-now');
    const listContainer = document.getElementById('backups-list-container');

    if (!btnOpen || !drawer) return;

    const formatBytes = (bytes) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts * 1000);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const loadBackups = async () => {
        listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">Loading backups...</div>';
        try {
            const res = await fetch('/api/admin/db-backups');
            const data = await res.json();
            if (data.status === 'success' && data.backups) {
                if (data.backups.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">No backups found.</div>';
                    return;
                }
                listContainer.innerHTML = '';
                data.backups.forEach(backup => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding:0.75rem; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:6px; display:flex; flex-direction:column; gap:0.5rem;';
                    
                    const meta = document.createElement('div');
                    meta.style.cssText = 'display:flex; flex-direction:column; gap:0.15rem;';
                    
                    const name = document.createElement('strong');
                    name.textContent = backup.filename;
                    name.style.cssText = 'color:var(--text-primary); font-size:0.8rem; word-break:break-all;';
                    
                    const details = document.createElement('span');
                    details.textContent = `${formatBytes(backup.size_bytes)} | ${formatDate(backup.created_at)}`;
                    details.style.cssText = 'font-size:0.75rem; color:var(--text-secondary);';
                    
                    meta.appendChild(name);
                    meta.appendChild(details);
                    
                    const actions = document.createElement('div');
                    actions.style.cssText = 'display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.25rem;';
                    
                    const btnDownload = document.createElement('button');
                    btnDownload.className = 'btn btn-secondary btn-sm';
                    btnDownload.innerHTML = '📥 Download';
                    btnDownload.style.fontSize = '0.7rem';
                    btnDownload.onclick = () => {
                        window.open(`/api/admin/db-backups/${backup.filename}`, '_blank');
                    };
                    
                    const btnRestore = document.createElement('button');
                    btnRestore.className = 'btn btn-secondary btn-sm';
                    btnRestore.innerHTML = '🔄 Restore';
                    btnRestore.style.cssText = 'font-size:0.7rem; background:rgba(239,68,68,0.15); color:#ef4444; border-color:rgba(239,68,68,0.3);';
                    btnRestore.onclick = async () => {
                        if (confirm(`Are you sure you want to restore the database from backup: ${backup.filename}? All current active shift records, vehicle registrations, and configurations will be overwritten.`)) {
                            btnRestore.disabled = true;
                            btnRestore.textContent = 'Restoring...';
                            try {
                                const restoreRes = await fetch(`/api/admin/db-backups/${backup.filename}/restore`, {
                                    method: 'POST'
                                });
                                const restoreData = await restoreRes.json();
                                if (restoreRes.ok && restoreData.status === 'success') {
                                    if (window.showToast) window.showToast('Database successfully restored! Reloading page...', 'success');
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 2000);
                                } else {
                                    throw new Error(restoreData.detail || 'Restore failed');
                                }
                            } catch (err) {
                                if (window.showToast) window.showToast(`Error: ${err.message}`, 'danger');
                                btnRestore.disabled = false;
                                btnRestore.textContent = 'Restore';
                            }
                        }
                    };
                    
                    actions.appendChild(btnDownload);
                    actions.appendChild(btnRestore);
                    
                    item.appendChild(meta);
                    item.appendChild(actions);
                    listContainer.appendChild(item);
                });
            } else {
                listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--danger);">Failed to load backups.</div>';
            }
        } catch (e) {
            listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--danger);">Error connection.</div>';
        }
    };

    btnOpen.onclick = () => {
        // Close other drawers if open
        const alertsDrawer = document.getElementById('alerts-drawer');
        const settingsDrawer = document.getElementById('settings-drawer');
        if (alertsDrawer) alertsDrawer.classList.add('hidden');
        if (settingsDrawer) settingsDrawer.classList.add('hidden');

        drawer.classList.remove('hidden');
        loadBackups();
    };

    btnClose.onclick = () => {
        drawer.classList.add('hidden');
    };

    btnTrigger.onclick = async () => {
        btnTrigger.disabled = true;
        btnTrigger.textContent = 'Creating Backup...';
        try {
            const res = await fetch('/api/admin/db-backup', {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                if (window.showToast) window.showToast(`Backup created successfully: ${data.filename}`, 'success');
                loadBackups();
            } else {
                throw new Error(data.detail || 'Backup failed');
            }
        } catch (e) {
            if (window.showToast) window.showToast(`Backup error: ${e.message}`, 'danger');
        } finally {
            btnTrigger.disabled = false;
            btnTrigger.textContent = '⚡ Create Backup Now';
        }
    };
});
