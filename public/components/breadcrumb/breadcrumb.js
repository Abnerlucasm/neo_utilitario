class NeoBreadcrumb extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const currentPath = window.location.pathname;
        const paths = currentPath.split('/').filter(p => p);
        
        let html = `
        <nav class="breadcrumb mt-4 mb-4" aria-label="breadcrumbs">
            <ul>
                <li><a href="/pages/index.html">Home</a></li>
        `;

        let currentLink = '/pages';
        paths.forEach((path, index) => {
            currentLink += `/${path}`;
            const isLast = index === paths.length - 1;
            const name = path.replace('.html', '').replace(/-/g, ' ');
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

            if (isLast) {
                html += `<li class="is-active"><a href="#" aria-current="page">${formattedName}</a></li>`;
            } else {
                html += `<li><a href="${currentLink}">${formattedName}</a></li>`;
            }
        });

        html += `
            </ul>
        </nav>`;

        this.innerHTML = html;
    }
}

customElements.define('neo-breadcrumb', NeoBreadcrumb); 