class ContentViewer {
    constructor(learningModule) {
        this.module = learningModule;
        this.initializeViewer();
    }

    initializeViewer() {
        this.setupNavigation();
        this.loadContent();
        this.setupProgress();
    }

    // ... métodos do viewer
} 