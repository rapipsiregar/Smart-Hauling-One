document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-sound-alerts');

    // Load from localStorage, default to true
    let soundEnabled = true;
    if (localStorage.getItem('soundAlertsEnabled') !== null) {
        soundEnabled = localStorage.getItem('soundAlertsEnabled') === 'true';
    }
    
    if (toggle) {
        toggle.checked = soundEnabled;
        toggle.addEventListener('change', () => {
            soundEnabled = toggle.checked;
            localStorage.setItem('soundAlertsEnabled', soundEnabled);
        });
    }

    window.playAudioAlert = () => {
        const soundEnabled = localStorage.getItem('soundAlertsEnabled') !== 'false';
        if (!soundEnabled) return;
        
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12); // E5
            
            const volumeVal = parseFloat(localStorage.getItem('pref-audio-volume') || '80') / 100;
            const alertVolume = volumeVal * 0.15;
            gain.gain.setValueAtTime(alertVolume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.45);
        } catch (e) {
            console.error("Audio alerts context error:", e);
        }
    };

    // Telemetry customized beep tones
    window.playTelemetryLowBatteryAlert = () => {
        const soundEnabled = localStorage.getItem('soundAlertsEnabled') !== 'false';
        const lowBatteryEnabled = localStorage.getItem('soundTelemetryLowBatteryEnabled') !== 'false';
        if (!soundEnabled || !lowBatteryEnabled) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth'; // Distinctive tone for low battery warning
            osc.frequency.setValueAtTime(330, ctx.currentTime); // E4
            osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.15); // C4

            const volumeVal = parseFloat(localStorage.getItem('pref-audio-volume') || '80') / 100;
            const alertVolume = volumeVal * 0.12;
            gain.gain.setValueAtTime(alertVolume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {
            console.error("Low battery beep error:", e);
        }
    };

    window.playTelemetryChargingFailAlert = () => {
        const soundEnabled = localStorage.getItem('soundAlertsEnabled') !== 'false';
        const chargingFailEnabled = localStorage.getItem('soundTelemetryChargingFailEnabled') !== 'false';
        if (!soundEnabled || !chargingFailEnabled) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(450, ctx.currentTime); // Beat frequency to make a pulsing fail warning

            const volumeVal = parseFloat(localStorage.getItem('pref-audio-volume') || '80') / 100;
            const alertVolume = volumeVal * 0.15;

            gain.gain.setValueAtTime(alertVolume, ctx.currentTime);
            gain.gain.setValueAtTime(0.01, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(alertVolume, ctx.currentTime + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.3);
            osc2.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.error("Charging fail beep error:", e);
        }
    };

    window.playTelemetryOfflineTowerAlert = () => {
        const soundEnabled = localStorage.getItem('soundAlertsEnabled') !== 'false';
        const offlineTowerEnabled = localStorage.getItem('soundTelemetryOfflineTowerEnabled') !== 'false';
        if (!soundEnabled || !offlineTowerEnabled) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (high alert pitch)
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);

            const volumeVal = parseFloat(localStorage.getItem('pref-audio-volume') || '80') / 100;
            const alertVolume = volumeVal * 0.18;

            gain.gain.setValueAtTime(alertVolume, ctx.currentTime);
            gain.gain.setValueAtTime(0.01, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(alertVolume, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.01, ctx.currentTime + 0.27);
            gain.gain.setValueAtTime(alertVolume, ctx.currentTime + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.65);
        } catch (e) {
            console.error("Offline tower beep error:", e);
        }
    };

    // Global thresholds cache and transition checker
    window.telemetryThresholds = { battery_low: 30.0, solar_low: 5.0, latency_high: 200.0 };

    window.fetchTelemetryThresholds = async () => {
        try {
            const res = await fetch('/api/telemetry/thresholds');
            if (res.ok) {
                window.telemetryThresholds = await res.json();
            }
        } catch (err) {
            console.error("Failed to fetch thresholds:", err);
        }
    };

    let previousTowersState = {};
    window.checkTelemetrySoundTransitions = (towers) => {
        if (!window.telemetryThresholds) return;
        const b_low = window.telemetryThresholds.battery_low || 30.0;
        const s_low = window.telemetryThresholds.solar_low || 5.0;

        towers.forEach(t => {
            const prev = previousTowersState[t.id];
            if (prev) {
                // 1. Offline transitions (status transitions to offline)
                if (t.status === 'offline' && prev.status !== 'offline') {
                    window.playTelemetryOfflineTowerAlert();
                }
                // 2. Low Battery transitions (battery transitions from >= b_low to < b_low)
                else if (t.battery < b_low && prev.battery >= b_low && t.status !== 'offline') {
                    window.playTelemetryLowBatteryAlert();
                }
                // 3. Charging Failure transitions (solar transitions from >= s_low to < s_low)
                else if (t.solar_output < s_low && prev.solar_output >= s_low && t.status !== 'offline') {
                    window.playTelemetryChargingFailAlert();
                }
            }
            // Update cache (store current state)
            previousTowersState[t.id] = {
                status: t.status,
                battery: t.battery,
                solar_output: t.solar_output
            };
        });
    };

    // Initialize toggles
    const setupTelemetryToggle = (id, localStorageKey) => {
        const toggleEl = document.getElementById(id);
        if (!toggleEl) return;

        let enabled = true;
        if (localStorage.getItem(localStorageKey) !== null) {
            enabled = localStorage.getItem(localStorageKey) === 'true';
        } else {
            localStorage.setItem(localStorageKey, 'true');
        }

        toggleEl.checked = enabled;
        toggleEl.addEventListener('change', () => {
            localStorage.setItem(localStorageKey, toggleEl.checked);
            if (window.showToast) {
                window.showToast(`${toggleEl.checked ? 'Enabled' : 'Disabled'} telemetry sound alert.`);
            }
        });
    };

    setupTelemetryToggle('toggle-sound-low-battery', 'soundTelemetryLowBatteryEnabled');
    setupTelemetryToggle('toggle-sound-charging-fail', 'soundTelemetryChargingFailEnabled');
    setupTelemetryToggle('toggle-sound-offline-tower', 'soundTelemetryOfflineTowerEnabled');

    // Fetch initial thresholds
    window.fetchTelemetryThresholds();
});
