import { getFooterTemplate } from './footer.template.js';

class NeoFooter extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {

        this.innerHTML = getFooterTemplate();
    }
}

customElements.define('neo-footer', NeoFooter);