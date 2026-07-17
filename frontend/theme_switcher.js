document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (!themeBtn) return;

    // Define themes sequence
    const themes = ['slate', 'light', 'cyberpunk'];
    const themeLabels = {
        'slate': '🌓 Slate-Blue',
        'light': '☀️ Light Mode',
        'cyberpunk': '🔮 Cyberpunk'
    };

    // Retrieve saved theme or default to slate
    let currentTheme = localStorage.getItem('active-theme') || 'slate';

    function applyTheme(theme) {
        // Remove all theme classes from body
        document.body.classList.remove('light-theme', 'cyberpunk-theme', 'slate-theme');
        
        // Add current theme class (slate is default/root variables, so no extra class needed)
        if (theme !== 'slate') {
            document.body.classList.add(`${theme}-theme`);
        }
        
        // Save to localStorage
        localStorage.setItem('active-theme', theme);
        currentTheme = theme;
        
        // Update button text
        themeBtn.textContent = themeLabels[theme];
    }

    // Initialize theme
    applyTheme(currentTheme);

    // Override the button click to cycle through themes
    themeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        
        applyTheme(nextTheme);
    };
});
