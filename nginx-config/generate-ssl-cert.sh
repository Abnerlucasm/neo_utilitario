#!/bin/bash

# Script para gerar certificado SSL auto-assinado para NeoHub
# Para uso interno na rede

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Gerando certificado SSL auto-assinado para NeoHub${NC}"

# Verificar se OpenSSL está instalado
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ OpenSSL não está instalado. Instalando...${NC}"
    sudo apt update && sudo apt install -y openssl
fi

# Criar diretórios se não existirem
sudo mkdir -p /etc/ssl/certs
sudo mkdir -p /etc/ssl/private

# Configurações do certificado
CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"
CERT_FILE="$CERT_DIR/neohub.crt"
KEY_FILE="$KEY_DIR/neohub.key"
CSR_FILE="/tmp/neohub.csr"
CONFIG_FILE="/tmp/neohub-ssl.conf"

# Criar arquivo de configuração para o certificado
cat > "$CONFIG_FILE" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=BR
ST=São Paulo
L=São Paulo
O=NeoHub
OU=IT Department
CN=neohub.local
emailAddress=admin@neohub.local

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = neohub.local
DNS.2 = *.neohub.local
DNS.3 = admin.neohub.local
DNS.4 = api.neohub.local
DNS.5 = localhost
IP.1 = 127.0.0.1
IP.2 = 192.168.1.15
EOF

echo -e "${YELLOW}📝 Gerando chave privada...${NC}"
sudo openssl genrsa -out "$KEY_FILE" 2048

echo -e "${YELLOW}📝 Gerando certificado...${NC}"
sudo openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -config "$CONFIG_FILE"

# Definir permissões corretas
sudo chmod 644 "$CERT_FILE"
sudo chmod 600 "$KEY_FILE"

# Limpar arquivos temporários
rm -f "$CSR_FILE" "$CONFIG_FILE"

echo -e "${GREEN}✅ Certificado SSL gerado com sucesso!${NC}"
echo -e "${BLUE}📁 Certificado: $CERT_FILE${NC}"
echo -e "${BLUE}🔑 Chave privada: $KEY_FILE${NC}"
echo -e "${YELLOW}⏰ Válido por: 365 dias${NC}"

# Verificar o certificado
echo -e "${BLUE}🔍 Verificando certificado...${NC}"
sudo openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|DNS:|IP Address:|Not After)"

echo -e "${GREEN}🎉 Configuração SSL concluída!${NC}"
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo -e "   1. Copie o arquivo de configuração do nginx:"
echo -e "      ${BLUE}sudo cp /home/neoutilitario/nginx-config/neohub.conf /etc/nginx/sites-available/${NC}"
echo -e "   2. Ative o site:"
echo -e "      ${BLUE}sudo ln -s /etc/nginx/sites-available/neohub.conf /etc/nginx/sites-enabled/${NC}"
echo -e "   3. Teste a configuração:"
echo -e "      ${BLUE}sudo nginx -t${NC}"
echo -e "   4. Reinicie o nginx:"
echo -e "      ${BLUE}sudo systemctl restart nginx${NC}"
echo -e "   5. Adicione ao /etc/hosts:"
echo -e "      ${BLUE}echo '192.168.1.15 neohub.local admin.neohub.local api.neohub.local' | sudo tee -a /etc/hosts${NC}"
