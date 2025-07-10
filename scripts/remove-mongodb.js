/**
 * Script para remover qualquer referência ao MongoDB
 * e garantir que apenas o PostgreSQL seja usado
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Configurações
const rootDir = path.resolve(__dirname, '..');
const ignoreDirs = [
    'node_modules', 
    '.git', 
    'public/assets', 
    'logs'
];

// Termos MongoDB para buscar
const mongoTerms = [
    'mongoose',
    'mongodb',
    'connectToMongoDB',
    'mongoose.connect',
    'mongoose.Schema',
    'mongoose.model',
    'new Schema'
];

async function findFiles(dir, fileList = []) {
    const files = await readdirAsync(dir);
    
    for (const file of files) {
        if (ignoreDirs.some(ignoreDir => dir.includes(ignoreDir))) {
            continue;
        }
        
        const filePath = path.join(dir, file);
        const stat = await statAsync(filePath);
        
        if (stat.isDirectory()) {
            fileList = await findFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

async function scanFiles() {
    try {
        console.log('Iniciando scan por arquivos com referências ao MongoDB...');
        
        const files = await findFiles(rootDir);
        const filesWithMongo = [];
        
        for (const file of files) {
            const content = await readFileAsync(file, 'utf8');
            
            if (mongoTerms.some(term => content.includes(term))) {
                filesWithMongo.push({
                    path: file,
                    relativePath: path.relative(rootDir, file)
                });
            }
        }
        
        console.log(`\nEncontrados ${filesWithMongo.length} arquivos com referências ao MongoDB:`);
        filesWithMongo.forEach(file => {
            console.log(`- ${file.relativePath}`);
        });
        
        return filesWithMongo;
    } catch (error) {
        console.error('Erro ao escanear arquivos:', error);
        return [];
    }
}

async function main() {
    try {
        const filesWithMongo = await scanFiles();
        
        if (filesWithMongo.length === 0) {
            console.log('Nenhuma referência ao MongoDB encontrada. A aplicação está usando apenas PostgreSQL.');
            return;
        }
        
        console.log('\nPara remover as referências ao MongoDB, você deve:');
        console.log('1. Remover os pacotes relacionados ao MongoDB do package.json');
        console.log('2. Verificar e corrigir cada arquivo listado acima');
        console.log('3. Certifique-se de que todas as funcionalidades estão usando PostgreSQL');
        
    } catch (error) {
        console.error('Erro ao executar o script:', error);
    }
}

// Executar o script se for chamado diretamente
if (require.main === module) {
    main();
}

module.exports = scanFiles; 