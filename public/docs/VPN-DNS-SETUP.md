# 🌐 Configuração DNS para Acesso via VPN

## ✅ **Status Atual**

- ✅ **IP direto funciona**: `https://192.168.1.15:8443`
- ✅ **Domínios funcionam no servidor**: `neohub.local`, `admin.neohub.local`
- ❌ **Domínios não funcionam via VPN**: Precisa configurar DNS

## 🔧 **Soluções para Acesso via Domínio**

### **Opção 1: Configurar DNS Local (Recomendado)**

#### **Windows:**
1. Abra o **Bloco de Notas como Administrador**
2. Abra o arquivo: `C:\Windows\System32\drivers\etc\hosts`
3. Adicione no final:
   ```
   192.168.1.15 neohub.local
   192.168.1.15 admin.neohub.local
   192.168.1.15 api.neohub.local
   ```
4. Salve o arquivo
5. Reinicie o navegador

#### **Linux/Mac:**
```bash
sudo nano /etc/hosts
```
Adicione:
```
192.168.1.15 neohub.local
192.168.1.15 admin.neohub.local
192.168.1.15 api.neohub.local
```

### **Opção 2: Configurar DNS na VPN**

Se você tem controle sobre a VPN, configure o servidor DNS para resolver:
- `neohub.local` → `192.168.1.15`
- `admin.neohub.local` → `192.168.1.15`
- `api.neohub.local` → `192.168.1.15`

### **Opção 3: Usar IP Direto (Mais Simples)**

Continue usando:
```
https://192.168.1.15:8443
```

## 🧪 **Teste de Configuração**

Após configurar o DNS, teste:

```bash
# Teste de resolução DNS
ping neohub.local

# Teste de acesso
curl -k -I https://neohub.local:8443
```

## 📱 **Configuração Mobile**

Para dispositivos móveis via VPN:

1. **Android**: Use aplicativo como "Hosts Editor" (requer root)
2. **iOS**: Use aplicativo como "DNS Changer" ou configure DNS personalizado
3. **Alternativa**: Use sempre o IP direto `https://192.168.1.15:8443`

## 🔍 **Verificação de DNS**

### **Windows:**
```cmd
nslookup neohub.local
```

### **Linux/Mac:**
```bash
dig neohub.local
# ou
nslookup neohub.local
```

## 🚨 **Solução de Problemas**

### **Problema: "Site não encontrado"**
- Verificar se o DNS foi configurado corretamente
- Limpar cache DNS: `ipconfig /flushdns` (Windows) ou `sudo systemctl restart systemd-resolved` (Linux)

### **Problema: "Certificado inválido"**
- Aceitar o certificado auto-assinado
- Clicar em "Avançado" → "Prosseguir para neohub.local"

## 📋 **URLs Finais**

Após configurar DNS, você poderá acessar:

- **Principal**: `https://neohub.local:8443`
- **Admin**: `https://admin.neohub.local:8443`
- **API**: `https://api.neohub.local:8443`

---

**Nota**: Se preferir simplicidade, continue usando `https://192.168.1.15:8443`
