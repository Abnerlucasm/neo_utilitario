#!/bin/bash

# Script de Deploy Automatizado para Produção
# Este script automatiza o processo de deploy

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy para produção..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERRO: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] AVISO: $1${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    error "Execute este script no diretório raiz do projeto"
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado"
fi

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    error "PM2 não está instalado. Execute: npm install -g pm2"
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    log "Instalando dependências..."
    npm install
fi

# Backup do build anterior
if [ -d "dist" ]; then
    log "Fazendo backup do build anterior..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Build para produção
log "Executando build para produção..."
npm run build:prod

# Verificar se o build foi bem-sucedido
if [ ! -d "dist" ]; then
    error "Build falhou - diretório dist não foi criado"
fi

# Verificar se os arquivos essenciais existem
if [ ! -f "dist/pages/index.html" ]; then
    error "Build falhou - arquivo index.html não encontrado"
fi

# Parar o servidor atual
log "Parando servidor atual..."
pm2 stop neodeploy || warn "Servidor não estava rodando"

# Fazer backup do servidor atual
log "Fazendo backup do servidor..."
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S) || warn "Não foi possível fazer backup do server.js"

# Copiar servidor de produção
log "Configurando servidor de produção..."
cp scripts/production-server.js server.js

# Criar diretório de logs se não existir
mkdir -p logs

# Iniciar servidor em produção
log "Iniciando servidor em produção..."
pm2 start scripts/ecosystem.config.js --env production

# Verificar se o servidor está rodando
sleep 5
if pm2 list | grep -q "neodeploy.*online"; then
    log "✅ Servidor iniciado com sucesso!"
else
    error "Falha ao iniciar o servidor"
fi

# Verificar saúde do servidor
log "Verificando saúde do servidor..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    log "✅ Servidor respondendo corretamente"
else
    warn "Servidor pode não estar respondendo corretamente"
fi

# Mostrar status
log "Status do servidor:"
pm2 status

# Mostrar logs recentes
log "Logs recentes:"
pm2 logs neodeploy --lines 10

# Limpeza
log "Limpando arquivos temporários..."
rm -f server.js.backup.* 2>/dev/null || true

log "🎉 Deploy concluído com sucesso!"
log "📊 Para monitorar: pm2 logs neodeploy"
log "🔄 Para reiniciar: pm2 restart neodeploy"
log "⏹️  Para parar: pm2 stop neodeploy"

# Salvar configuração do PM2
pm2 save

echo ""
echo "📋 Próximos passos:"
echo "1. Configure seu proxy reverso (nginx/apache) para apontar para porta 3000"
echo "2. Configure SSL/TLS no proxy reverso"
echo "3. Configure backup automático do banco de dados"
echo "4. Configure monitoramento (opcional)"
echo ""
