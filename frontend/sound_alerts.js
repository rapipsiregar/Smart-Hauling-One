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
});
