document.addEventListener('DOMContentLoaded', () => {
    const btnList = document.getElementById('btn-feed-list-mode');
    const btnGrid = document.getElementById('btn-feed-grid-mode');
    const feedList = document.getElementById('live-feed-list');
    
    if (!btnList || !btnGrid || !feedList) return;
    
    const savedMode = localStorage.getItem('feed-layout-mode') || 'list';
    setFeedLayoutMode(savedMode);
    
    btnList.onclick = () => setFeedLayoutMode('list');
    btnGrid.onclick = () => setFeedLayoutMode('grid');
    
    function setFeedLayoutMode(mode) {
        if (mode === 'grid') {
            feedList.classList.add('feed-grid-mode');
            btnList.classList.remove('active');
            btnGrid.classList.add('active');
        } else {
            feedList.classList.remove('feed-grid-mode');
            btnList.classList.add('active');
            btnGrid.classList.remove('active');
        }
        localStorage.setItem('feed-layout-mode', mode);
    }
});
