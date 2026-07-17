(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('toggle-voice-alerts');
        
        let voiceEnabled = true;
        if (localStorage.getItem('voiceAlertsEnabled') !== null) {
            voiceEnabled = localStorage.getItem('voiceAlertsEnabled') === 'true';
        }
        
        if (toggle) {
            toggle.checked = voiceEnabled;
            toggle.addEventListener('change', () => {
                voiceEnabled = toggle.checked;
                localStorage.setItem('voiceAlertsEnabled', voiceEnabled ? 'true' : 'false');
                window.showToast(voiceEnabled ? "Voice alerts enabled!" : "Voice alerts disabled.");
            });
        }
        
        const lastSpoken = {};
        
        window.speakVoiceAlert = (type, msg) => {
            const enabled = localStorage.getItem('voiceAlertsEnabled') !== 'false';
            if (!enabled) return;
            
            // Check if this type of alert warrants voice synthesis
            const isLowConf = type.toLowerCase().includes('low confidence') || type.toLowerCase().includes('ocr');
            const isBattery = type.toLowerCase().includes('battery') || msg.toLowerCase().includes('battery');
            
            if (!isLowConf && !isBattery) return;
            
            // Debounce matching alerts within 30 seconds
            const now = Date.now();
            const cacheKey = `${type}:${msg}`;
            if (lastSpoken[cacheKey] && (now - lastSpoken[cacheKey]) < 30000) {
                return;
            }
            lastSpoken[cacheKey] = now;
            
            // Format spoken message text
            let speechText = "";
            if (isLowConf) {
                // e.g. "OHT DT-118 detected at 83%"
                speechText = `Warning: Low confidence OCR. ${msg}`;
            } else if (isBattery) {
                // e.g. "Tower-Alpha low battery or high latency!"
                speechText = `Alert: Skid tower battery warning. ${msg}`;
            }
            
            if (!speechText) return;
            
            try {
                if ('speechSynthesis' in window) {
                    // Cancel current speech if any to not queue indefinitely
                    window.speechSynthesis.cancel();
                    
                    const utterance = new SpeechSynthesisUtterance(speechText);
                    utterance.rate = 0.95; // Slightly slower for clarity
                    utterance.pitch = 1.0;
                    
                    // Find a standard English voice if available
                    const voices = window.speechSynthesis.getVoices();
                    const engVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
                    if (engVoice) utterance.voice = engVoice;
                    
                    window.speechSynthesis.speak(utterance);
                }
            } catch (err) {
                console.error("Speech synthesis failed:", err);
            }
        };
    });
})();
