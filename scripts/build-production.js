#!/usr/bin/env node

/**
 * Script de Build para Produção
 * Otimiza o projeto para produção: minifica, remove logs, gera cache busting
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const buildConfig = require('./build-config');

class ProductionBuilder {
    constructor() {
        this.config = buildConfig.environments.production;
        this.buildDir = 'dist';
        this.fileHashes = new Map();
    }

    async build() {
        console.log('🚀 Iniciando build para produção...');
        
        try {
            // Criar diretório de build
            this.createBuildDirectory();
            
            // Processar arquivos JavaScript
            await this.processJavaScriptFiles();
            
            // Processar arquivos CSS
            await this.processCSSFiles();
            
            // Processar arquivos HTML
            await this.processHTMLFiles();
            
            // Copiar arquivos estáticos
            await this.copyStaticFiles();
            
            // Gerar arquivo de hash para cache busting
            await this.generateHashFile();
            
            console.log('✅ Build para produção concluído!');
            console.log(`📁 Arquivos otimizados em: ${this.buildDir}/`);
            
        } catch (error) {
            console.error('❌ Erro durante o build:', error);
            process.exit(1);
        }
    }

    createBuildDirectory() {
        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true });
        }
        fs.mkdirSync(this.buildDir, { recursive: true });
        console.log('📁 Diretório de build criado');
    }

    async processJavaScriptFiles() {
        console.log('🔧 Processando arquivos JavaScript...');
        
        for (const filePath of buildConfig.files.js) {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const processedContent = this.processJavaScript(content);
                const outputPath = this.getOutputPath(filePath);
                
                // Criar diretório se não existir
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                fs.writeFileSync(outputPath, processedContent);
                console.log(`✅ Processado: ${filePath}`);
            }
        }
    }

    processJavaScript(content) {
        let processedContent = content;
        
        // Remover logs se configurado
        if (this.config.removeLogs) {
            processedContent = this.removeLogs(processedContent);
        }
        
        // Minificar se configurado
        if (this.config.minify) {
            processedContent = this.minifyJavaScript(processedContent);
        }
        
        return processedContent;
    }

    removeLogs(content) {
        let processedContent = content;
        
        // Remover logs conforme padrões definidos
        for (const pattern of buildConfig.logPatterns) {
            // Manter apenas logs de erro se configurado
            if (buildConfig.keepLogs.some(keepPattern => keepPattern.test(content))) {
                // Lógica mais complexa para manter apenas console.error
                processedContent = processedContent.replace(pattern, (match, offset, string) => {
                    // Verificar se é console.error
                    const beforeMatch = string.substring(Math.max(0, offset - 20), offset);
                    if (beforeMatch.includes('console.error')) {
                        return match; // Manter console.error
                    }
                    return '// ' + match; // Comentar outros logs
                });
            } else {
                processedContent = processedContent.replace(pattern, '// ' + '$&');
            }
        }
        
        return processedContent;
    }

    minifyJavaScript(content) {
        // Minificação básica (remover espaços desnecessários, quebras de linha)
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentários de bloco
            .replace(/\/\/.*$/gm, '') // Remover comentários de linha
            .replace(/\s+/g, ' ') // Substituir múltiplos espaços por um
            .replace(/\s*([{}();,=])\s*/g, '$1') // Remover espaços ao redor de operadores
            .replace(/;\s*}/g, '}') // Remover ponto e vírgula antes de }
            .trim();
    }

    async processCSSFiles() {
        console.log('🎨 Processando arquivos CSS...');
        
        for (const filePath of buildConfig.files.css) {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const processedContent = this.processCSS(content);
                const outputPath = this.getOutputPath(filePath);
                
                // Criar diretório se não existir
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                fs.writeFileSync(outputPath, processedContent);
                console.log(`✅ Processado: ${filePath}`);
            }
        }
    }

    processCSS(content) {
        let processedContent = content;
        
        if (this.config.minify) {
            processedContent = this.minifyCSS(processedContent);
        }
        
        return processedContent;
    }

    minifyCSS(content) {
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentários
            .replace(/\s+/g, ' ') // Substituir múltiplos espaços por um
            .replace(/\s*([{}:;,>+~])\s*/g, '$1') // Remover espaços ao redor de operadores
            .replace(/;\s*}/g, '}') // Remover ponto e vírgula antes de }
            .trim();
    }

    async processHTMLFiles() {
        console.log('📄 Processando arquivos HTML...');
        
        // Processar arquivos HTML principais
        const htmlFiles = [
            'public/pages/index.html',
            'public/pages/utilitarios.html',
            'public/pages/user-settings.html',
            'public/pages/glassfish.html',
            'public/pages/consultabd.html',
            'public/pages/login.html'
        ];
        
        for (const filePath of htmlFiles) {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const processedContent = this.processHTML(content);
                const outputPath = this.getOutputPath(filePath);
                
                // Criar diretório se não existir
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                fs.writeFileSync(outputPath, processedContent);
                console.log(`✅ Processado: ${filePath}`);
            }
        }
    }

    processHTML(content) {
        let processedContent = content;
        
        if (this.config.minify) {
            processedContent = this.minifyHTML(processedContent);
        }
        
        // Aplicar cache busting se configurado
        if (this.config.cacheBusting) {
            processedContent = this.applyCacheBusting(processedContent);
        }
        
        return processedContent;
    }

    minifyHTML(content) {
        return content
            .replace(/<!--[\s\S]*?-->/g, '') // Remover comentários HTML
            .replace(/\s+/g, ' ') // Substituir múltiplos espaços por um
            .replace(/>\s+</g, '><') // Remover espaços entre tags
            .trim();
    }

    applyCacheBusting(content) {
        // Aplicar hash aos arquivos JS e CSS
        const jsPattern = /src="([^"]*\.js)"/g;
        const cssPattern = /href="([^"]*\.css)"/g;
        
        return content
            .replace(jsPattern, (match, filePath) => {
                const hash = this.getFileHash(filePath);
                return `src="${filePath}?v=${hash}"`;
            })
            .replace(cssPattern, (match, filePath) => {
                const hash = this.getFileHash(filePath);
                return `href="${filePath}?v=${hash}"`;
            });
    }

    getFileHash(filePath) {
        if (this.fileHashes.has(filePath)) {
            return this.fileHashes.get(filePath);
        }
        
        const hash = crypto.randomBytes(4).toString('hex');
        this.fileHashes.set(filePath, hash);
        return hash;
    }

    async copyStaticFiles() {
        console.log('📋 Copiando arquivos estáticos...');
        
        const staticFiles = [
            'public/manifest.json',
            'public/sw.js',
            'public/assets',
            'public/icons'
        ];
        
        for (const filePath of staticFiles) {
            if (fs.existsSync(filePath)) {
                const outputPath = path.join(this.buildDir, path.basename(filePath));
                
                if (fs.statSync(filePath).isDirectory()) {
                    this.copyDirectory(filePath, outputPath);
                } else {
                    fs.copyFileSync(filePath, outputPath);
                }
                
                console.log(`✅ Copiado: ${filePath}`);
            }
        }
    }

    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const files = fs.readdirSync(src);
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            
            if (fs.statSync(srcPath).isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    getOutputPath(filePath) {
        const relativePath = path.relative('public', filePath);
        return path.join(this.buildDir, relativePath);
    }

    async generateHashFile() {
        const hashFile = {
            buildTime: new Date().toISOString(),
            version: this.getFileHash('version'),
            files: Object.fromEntries(this.fileHashes)
        };
        
        fs.writeFileSync(
            path.join(this.buildDir, 'build-info.json'),
            JSON.stringify(hashFile, null, 2)
        );
        
        console.log('📊 Arquivo de informações de build gerado');
    }
}

// Executar build se chamado diretamente
if (require.main === module) {
    const builder = new ProductionBuilder();
    builder.build();
}

module.exports = ProductionBuilder;
