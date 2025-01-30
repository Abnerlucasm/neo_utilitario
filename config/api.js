const API_BASE_URL = '/api';

const API_ROUTES = {
    SERVICES: `${API_BASE_URL}/servicos`,
    SERVICE_STATUS: (id) => `${API_BASE_URL}/servicos/${id}/status`,
    SERVICE_APPLICATIONS: (id) => `${API_BASE_URL}/servicos/${id}/applications`,
    SERVICE_CONFIG: (id) => `${API_BASE_URL}/servicos/${id}/domain-config`,
    // ... outras rotas
};

module.exports = {
    API_BASE_URL,
    API_ROUTES
}; 