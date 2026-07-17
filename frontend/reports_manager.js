document.addEventListener('DOMContentLoaded', () => {
    let lastReportsData = null;

    window.loadReportsData = async () => {
        try {
            const getFleet = window.getFleetTrucks || (() => []);
            if (!getFleet().length && typeof window.loadFleetData === 'function') {
                await window.loadFleetData();
            }
            const [summary, crossings] = await Promise.all([
                fetch('/api/reports/shift-summary').then(r => r.json()),
                fetch('/api/crossings').then(r => r.json())
            ]);
            lastReportsData = summary;
            window.lastCrossingsData = crossings;
            renderReports();
        } catch (err) { console.error(err); }
    };

    function renderReports() {
        window.renderReports = renderReports;
        if (!lastReportsData) return;
        
        const getFleet = window.getFleetTrucks || (() => []);
        const fleetTrucks = getFleet();
        
        const query = document.getElementById('report-search-input').value.toLowerCase();
        const lane = document.getElementById('report-lane-filter').value;
        
        const contractors = [...new Set(fleetTrucks.map(t => t.contractor).concat(lastReportsData.discrepancies.map(d => (fleetTrucks.find(t => t.hull_id === d.hull_id) || {}).contractor || 'Ad-hoc Contractor')))].filter(Boolean).sort();
        const cEl = document.getElementById('disc-contractors-filter');
        const existing = cEl ? [...cEl.querySelectorAll('.disc-cont-cb')].map(cb => cb.value).sort() : [];
        
        if (cEl && JSON.stringify(contractors) !== JSON.stringify(existing)) {
            cEl.innerHTML = '<strong>Contractors:</strong>' + contractors.map(c => `<label style="display:flex; align-items:center; gap:0.25rem;"><input type="checkbox" class="disc-cont-cb" value="${c}" checked> ${c}</label>`).join('');
            cEl.querySelectorAll('.disc-lane-cb, .disc-cont-cb').forEach(cb => cb.onchange = renderReports);
        }
        
        const checkedLanes = [...document.querySelectorAll('.disc-lane-cb:checked')].map(cb => cb.value);
        const checkedContractors = cEl ? [...cEl.querySelectorAll('.disc-cont-cb:checked')].map(cb => cb.value) : [];
        const checkedSeverities = [...document.querySelectorAll('.disc-severity-cb:checked')].map(cb => cb.value);
        
        const ritaseTbody = document.getElementById('ritase-tbody');
        if (ritaseTbody) {
            ritaseTbody.innerHTML = Object.entries(lastReportsData.completed_ritase).filter(([hid]) => !query || hid.toLowerCase().includes(query)).map(([hid, cycles]) => `<tr><td><strong>${hid}</strong></td><td>${cycles}</td><td>${lastReportsData.crossings_per_truck[hid] || 0}</td></tr>`).join('');
        }

        const crossingsTbody = document.getElementById('report-crossings-tbody');
        if (crossingsTbody && window.lastCrossingsData) {
            const filteredCrossings = window.lastCrossingsData.filter(c => {
                return (!query || c.hull_id.toLowerCase().includes(query))
                    && (!lane || c.lane === lane);
            });
            crossingsTbody.innerHTML = filteredCrossings.map(c => `
                <tr>
                    <td class="col-timestamp">${new Date(c.timestamp).toLocaleString()}</td>
                    <td class="col-hullid"><strong>${c.hull_id}</strong></td>
                    <td class="col-lane">${c.lane}</td>
                    <td class="col-direction">${c.direction}</td>
                    <td class="col-confidence">${c.confidence.toFixed(1)}%</td>
                </tr>
            `).join('');
        }
        
        if (typeof window.renderShiftCards === 'function') {
            window.renderShiftCards(lastReportsData.shift_distribution);
        }
        
        const alertContainer = document.getElementById('discrepancies-container');
        const filtered = lastReportsData.discrepancies.filter(d => {
            const truck = fleetTrucks.find(t => t.hull_id === d.hull_id);
            const severity = d.severity || 'low';
            
            const typeFilter = window.activeDiscrepancyFilter || 'all';
            let matchesType = true;
            if (typeFilter === 'speed') {
                matchesType = d.type.toLowerCase().includes('speed') || d.type.toLowerCase().includes('duration') || d.type.toLowerCase().includes('anomaly');
            } else if (typeFilter === 'compliance') {
                matchesType = d.type.toLowerCase().includes('compliance') || d.type.toLowerCase().includes('target');
            } else if (typeFilter === 'route') {
                matchesType = d.type.toLowerCase().includes('route') || d.type.toLowerCase().includes('violation');
            }

            return (!query || d.hull_id.toLowerCase().includes(query)) 
                && (!lane || d.lane === lane) 
                && checkedLanes.includes(d.lane) 
                && checkedContractors.includes(truck ? truck.contractor : 'Ad-hoc Contractor')
                && checkedSeverities.includes(severity)
                && matchesType;
        });
        
        if (typeof window.sortDiscrepancies === 'function') {
            window.sortDiscrepancies(filtered);
        }
        
        if (alertContainer) {
            alertContainer.innerHTML = filtered.length ? filtered.map(d => `<div class="alert-card severity-${d.severity}"><div class="alert-header"><span class="alert-title">${d.type}</span><span>${new Date(d.timestamp).toLocaleTimeString()}</span></div><div class="alert-desc">${d.details} (<strong>${d.hull_id}</strong>)</div></div>`).join('') : '<div style="color: var(--text-secondary); font-size: 0.9rem;">No subcontractor discrepancies detected.</div>';
        }

        let contractorCycles = {}, totalCycles = 0;
        Object.entries(lastReportsData.completed_ritase).forEach(([hid, cycles]) => {
            const truck = fleetTrucks.find(t => t.hull_id === hid);
            const contractor = truck ? truck.contractor : 'Ad-hoc Contractor';
            contractorCycles[contractor] = (contractorCycles[contractor] || 0) + cycles;
            totalCycles += cycles;
        });

        const colors = ['#38bdf8', '#6366f1', '#10b981', '#fbbf24', '#ef4444'];
        let conicSegments = [], legendHtml = [], accumulatedPercent = 0;
        Object.entries(contractorCycles).forEach(([contractor, val], idx) => {
            const percent = totalCycles > 0 ? (val / totalCycles) * 100 : 0;
            const color = colors[idx % colors.length];
            conicSegments.push(`${color} ${accumulatedPercent}% ${accumulatedPercent + percent}%`);
            accumulatedPercent += percent;
            legendHtml.push(`<div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:10px; height:10px; background:${color}; border-radius:50%;"></span><strong>${contractor}</strong>: ${val} (${percent.toFixed(0)}%)</div>`);
        });
        
        const donut = document.getElementById('contractor-donut');
        if (donut) {
            donut.style.background = totalCycles > 0 ? `conic-gradient(${conicSegments.join(', ')})` : '#334155';
            document.getElementById('donut-total-val').textContent = totalCycles;
            document.getElementById('contractor-legend').innerHTML = legendHtml.length ? legendHtml.join('') : 'No contractor cycles recorded.';
        }
        
        const compContainer = document.getElementById('compliance-gauge-list');
        if (compContainer && lastReportsData.compliance) {
            compContainer.innerHTML = Object.entries(lastReportsData.compliance).map(([contractor, data]) => {
                const barColor = data.compliance_pct < 50 ? 'var(--danger)' : (data.compliance_pct < 85 ? 'var(--warning)' : 'var(--success)');
                const utilColor = (data.utilization_pct || 0) < 50 ? 'var(--danger)' : ((data.utilization_pct || 0) < 85 ? 'var(--warning)' : 'var(--success)');
                return `
                    <div class="distribution-item" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.75rem; margin-bottom:0.75rem; display:flex; gap:1rem; align-items:center;">
                        <!-- Dynamic SVG Circular Gauge -->
                        <div style="width: 46px; height: 46px; flex-shrink: 0; position: relative;">
                            <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                <path stroke="rgba(255,255,255,0.05)" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path stroke="rgba(255,255,255,0.15)" stroke-width="3" stroke-dasharray="1, 3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path stroke="${barColor}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${Math.min(100, data.compliance_pct)}, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div style="position: absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:${barColor};">${data.compliance_pct}%</div>
                        </div>
                        
                        <!-- Details and Progress Bar -->
                        <div style="flex:1; display:flex; flex-direction:column; gap:0.25rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
                                <strong>${contractor}</strong>
                                <span style="font-size:0.75rem; color:var(--text-secondary);">Target: ${data.target_threshold} rit/hr</span>
                            </div>
                            
                            <!-- Compliance linear bar with 80% warning threshold tick -->
                            <div style="position:relative; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:visible; margin:0.2rem 0;">
                                <!-- 80% compliance threshold marker -->
                                <div style="position:absolute; left:80%; top:-3px; width:2px; height:12px; background:var(--primary); opacity:0.7;" title="80% Warning Threshold"></div>
                                <div style="position:absolute; left:0; top:0; height:100%; width:${Math.min(100, data.compliance_pct)}%; background:${barColor}; border-radius:3px;"></div>
                            </div>
                            
                            <!-- Additional Info -->
                            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-secondary);">
                                <span>Capacity: ${data.hourly_capacity} rit/hr</span>
                                <span>Fleet Util: <span style="color:${utilColor}">${data.utilization_pct || 0}%</span> (Min: ${data.min_active_fleet || 5})</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            if (typeof window.onReportsRendered === 'function') window.onReportsRendered(lastReportsData.compliance);
            if (typeof window.onDeviationChartRendered === 'function') window.onDeviationChartRendered(lastReportsData.compliance);
            if (typeof window.renderSubcontractorLeaderboard === 'function') window.renderSubcontractorLeaderboard(lastReportsData.compliance);
            if (typeof window.renderComplianceStatsChart === 'function') window.renderComplianceStatsChart(lastReportsData.compliance);
            if (typeof window.renderComplianceTimelineChart === 'function') window.renderComplianceTimelineChart(lastReportsData.hourly_compliance);
            if (typeof window.renderContractorEfficiencyGrid === 'function') window.renderContractorEfficiencyGrid();
            if (typeof window.renderCycleDurationScatter === 'function') window.renderCycleDurationScatter();
            if (typeof window.renderCycleSpeedVarianceChart === 'function') window.renderCycleSpeedVarianceChart();
            if (typeof window.renderDispatchDiscrepancyGrid === 'function') window.renderDispatchDiscrepancyGrid();
        }
    }

    document.getElementById('btn-refresh-reports').onclick = window.loadReportsData;
    ['report-search-input', 'report-lane-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = el.onchange = renderReports;
    });
    document.querySelectorAll('.disc-lane-cb, .disc-severity-cb').forEach(cb => {
        cb.onchange = renderReports;
    });

    document.getElementById('btn-export-csv').onclick = () => {
        const q = document.getElementById('report-search-input').value;
        const l = document.getElementById('report-lane-filter').value;
        const d = document.getElementById('report-dir-filter').value;
        window.open(`/api/reports/export-csv?query=${encodeURIComponent(q)}&lane=${encodeURIComponent(l)}&direction=${encodeURIComponent(d)}`);
    };



    const btnSync = document.getElementById('btn-sync-cloud');
    const syncIndicator = document.getElementById('sync-status-indicator');
    if (btnSync && syncIndicator) {
        btnSync.onclick = async () => {
            btnSync.disabled = true; 
            btnSync.textContent = 'Syncing...'; 
            try { 
                const r = await (await fetch('/api/reports/sync', { method: 'POST' })).json(); 
                syncIndicator.textContent = `Last sync: Success (Synced ${r.synchronized_records_count} logs)`; 
                syncIndicator.style.color = 'var(--success)'; 
            } catch (e) { 
                syncIndicator.textContent = 'Last sync: Failed'; 
                syncIndicator.style.color = 'var(--danger)'; 
            } finally { 
                btnSync.disabled = false; 
                btnSync.textContent = '☁ Sync Cloud'; 
            }
        };
    }
});
