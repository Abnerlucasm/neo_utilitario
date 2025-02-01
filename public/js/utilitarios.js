document.addEventListener('DOMContentLoaded', () => {
    const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
    if (userSettings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
    }
});