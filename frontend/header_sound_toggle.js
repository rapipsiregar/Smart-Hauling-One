document.addEventListener('DOMContentLoaded', () => {
    const btnSound = document.getElementById('btn-sound-toggle');
    if (!btnSound) return;
    
    // Load saved sound preference
    let soundEnabled = localStorage.getItem('soundAlertsEnabled') !== 'false';
    updateSoundButton(soundEnabled);
    
    btnSound.onclick = () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('soundAlertsEnabled', soundEnabled ? 'true' : 'false');
        updateSoundButton(soundEnabled);
        
        // Update checkbox if present
        const toggle = document.getElementById('toggle-sound-alerts');
        if (toggle) toggle.checked = soundEnabled;
        
        if (typeof window.showToast === 'function') {
            window.showToast(soundEnabled ? "Audio alerts unmuted!" : "Audio alerts muted.");
        }
    };
    
    // Bidirectional sync with checkbox toggle
    const toggle = document.getElementById('toggle-sound-alerts');
    if (toggle) {
        toggle.addEventListener('change', () => {
            soundEnabled = toggle.checked;
            localStorage.setItem('soundAlertsEnabled', soundEnabled ? 'true' : 'false');
            updateSoundButton(soundEnabled);
        });
    }
    
    function updateSoundButton(enabled) {
        btnSound.textContent = enabled ? '🔊' : '🔇';
        btnSound.title = enabled ? 'Mute Alerts' : 'Unmute Alerts';
        btnSound.style.borderColor = enabled ? 'var(--primary)' : 'var(--border)';
    }
});
