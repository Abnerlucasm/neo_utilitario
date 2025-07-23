class BaseRunner {
    constructor(config) {
        this.config = config;
    }

    setup() {
        this.createUI();
        this.setupRunnerEvents();  // Renomeado para evitar conflito
    }

    createUI() {
        // Implementação base da UI
    }

    setupRunnerEvents() {
        // Implementação base dos eventos
    }
}

// Extensão para SQL
class SQLRunner extends BaseRunner {
    constructor(config) {
        super(config);
        this.sampleData = {
            users: [
                { id: 1, name: 'João', email: 'joao@email.com' },
                { id: 2, name: 'Maria', email: 'maria@email.com' }
            ],
            products: [
                { id: 1, name: 'Notebook', price: 2500.00 },
                { id: 2, name: 'Mouse', price: 50.00 }
            ],
            orders: [
                { id: 1, user_id: 1, product_id: 1, quantity: 1 },
                { id: 2, user_id: 2, product_id: 2, quantity: 2 }
            ]
        };
    }

    createUI() {
        super.createUI();
        this.renderTableStructure();
    }

    renderTableStructure() {
        const container = document.getElementById('availableTables');
        if (!container) return;

        let html = '<div class="table-structure">';
        html += '<div class="tabs"><ul><li class="is-active"><a>Estrutura</a></li><li><a>Dados</a></li></ul></div>';
        html += '<div class="view-content" id="structureView">';
        
        Object.entries(this.sampleData).forEach(([tableName, data]) => {
            const columns = Object.keys(data[0]);
            html += `
                <div class="table-item">
                    <div class="table-name" data-table="${tableName}">
                        <span class="icon"><i class="fas fa-table"></i></span>
                        <span>${tableName}</span>
                    </div>
                    <div class="table-details" id="details-${tableName}" style="display: none;">
                        <ul>
                            ${columns.map(col => `
                                <li>
                                    <span class="icon is-small"><i class="fas fa-key"></i></span>
                                    ${col}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        container.innerHTML = html;
    }

    setupRunnerEvents() {
        super.setupRunnerEvents();
        
        // Adicionar highlight SQL em tempo real
        const editor = document.querySelector('.sql-editor');
        if (editor) {
            editor.addEventListener('input', () => {
                this.highlightSQL(editor);
            });
        }

        // Toggle para detalhes das tabelas
        document.querySelectorAll('.table-name').forEach(elem => {
            elem.addEventListener('click', () => {
                elem.classList.toggle('expanded');
                const detailsId = `details-${elem.dataset.table}`;
                const details = document.getElementById(detailsId);
                if (details) {
                    details.style.display = details.style.display === 'none' ? 'block' : 'none';
                }
            });
        });
    }

    highlightSQL(editor) {
        const sql = editor.textContent;
        const keywords = [
            "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES",
            "UPDATE", "DELETE", "CREATE", "TABLE", "AND", "OR",
            "ORDER BY", "GROUP BY", "JOIN", "LEFT", "RIGHT", "INNER",
            "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "NULL",
            "NOT", "UNIQUE", "CHECK", "CONSTRAINT", "CASCADE", "SET",
            "SERIAL", "INTEGER", "VARCHAR", "TEXT", "DECIMAL", "TIMESTAMP",
            "BOOLEAN", "DATE", "HAVING", "LIMIT", "OFFSET", "AS"
        ];

        const types = [
            "INTEGER", "SERIAL", "VARCHAR", "TEXT", "DECIMAL",
            "TIMESTAMP", "BOOLEAN", "DATE", "NUMERIC", "REAL"
        ];

        let highlightedSQL = sql;

        // Destacar strings
        highlightedSQL = highlightedSQL.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>');

        // Destacar números
        highlightedSQL = highlightedSQL.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="sql-number">$1</span>');

        // Destacar comentários
        highlightedSQL = highlightedSQL.replace(/--.*$/gm, match => 
            `<span class="sql-comment">${match}</span>`);

        // Destacar tipos
        types.forEach(type => {
            const regex = new RegExp(`\\b${type}\\b`, 'gi');
            highlightedSQL = highlightedSQL.replace(regex, `<span class="sql-type">$&</span>`);
        });

        // Destacar palavras-chave
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            highlightedSQL = highlightedSQL.replace(regex, `<span class="sql-keyword">$&</span>`);
        });

        // Preservar a posição do cursor
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;

        editor.innerHTML = highlightedSQL;

        // Restaurar a posição do cursor
        const newRange = document.createRange();
        newRange.setStart(editor.firstChild || editor, Math.min(cursorPosition, editor.textContent.length));
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    executeQuery(sql) {
        const editor = document.querySelector('.sql-editor');
        const result = document.getElementById('sqlResult');
        
        if (!editor || !result) return;

        try {
            const query = sql || editor.textContent;
            // Simular execução da query
            const queryResult = this.simulateQuery(query);
            result.innerHTML = this.formatQueryResult(queryResult);
        } catch (error) {
            result.innerHTML = `<div class="notification is-danger">Erro: ${error.message}</div>`;
        }
    }

    simulateQuery(query) {
        // Simulação básica de SELECT
        const selectMatch = query.match(/SELECT .* FROM (\w+)/i);
        if (selectMatch) {
            const tableName = selectMatch[1].toLowerCase();
            return this.sampleData[tableName] || [];
        }
        return [];
    }

    formatQueryResult(data) {
        if (!data.length) return '<div class="notification is-info">Nenhum resultado encontrado</div>';

        const columns = Object.keys(data[0]);
        return `
            <table class="table is-fullwidth">
                <thead>
                    <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>${columns.map(col => `<td>${row[col]}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// Extensão para JavaScript
class JSRunner extends BaseRunner {
    createUI() {
        super.createUI();
        // Adicionar elementos específicos do JavaScript
    }

    executeCode(js) {
        // Implementação específica para JavaScript
    }
} 