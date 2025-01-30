class UserSettings {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const settings = localStorage.getItem('userSettings');
        return settings ? JSON.parse(settings) : {
            userName: '',
            theme: 'light',
            lastOpenedTabs: [],
            preferences: {}
        };
    }

    saveSettings() {
        localStorage.setItem('userSettings', JSON.stringify(this.settings));
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    getSetting(key) {
        return this.settings[key];
    }
}

window.userSettings = new UserSettings(); 