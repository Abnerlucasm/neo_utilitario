const Theme = {
    KEY: 'neohub-theme',

    init() {
        const theme = localStorage.getItem(this.KEY);
        this.apply(theme);
    },

    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.KEY, theme);
    },

    set(theme) {
        this.apply(theme);
    },

    get() {
        return localStorage.getItem(this.KEY);
    }
};

window.Theme = Theme;

Theme.init();