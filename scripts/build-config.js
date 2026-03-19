/**
 * Configuração de Build para Produção
 * Este arquivo define as configurações para otimização do projeto
 */

const buildConfig = {
    // Configurações de ambiente
    environments: {
        development: {
            minify: false,
            removeLogs: false,
            sourceMaps: true,
            cacheBusting: false
        },
        production: {
            minify: true,
            removeLogs: true,
            sourceMaps: false,
            cacheBusting: true
        }
    },

    // Arquivos para processar
    files: {
        js: [
            'public/js/index.js',
            'public/js/user-settings.js',
            'public/js/auth.js',
            'public/js/avatar-manager.js',
            'public/components/navbar/navbar.js',
            'public/components/footer/footer.js',
            'public/components/theme-selector/theme-selector.js'
        ],
        css: [
            'public/css/neohub-core.css',
            'public/css/pages/index.css'
        ],
        html: [
            'public/pages/*.html',
            'public/pages/admin/*.html'
        ]
    },

    // Configurações de minificação
    minification: {
        js: {
            compress: true,
            mangle: true,
            keep_fnames: false
        },
        css: {
            level: 2
        },
        html: {
            removeComments: true,
            collapseWhitespace: true,
            removeRedundantAttributes: true,
            useShortDoctype: true,
            removeEmptyAttributes: true,
            removeStyleLinkTypeAttributes: true,
            keepClosingSlash: true,
            minifyJS: true,
            minifyCSS: true
        }
    },

    // Padrões de logs para remover em produção
    logPatterns: [
        /console\.log\(/g,
        /console\.warn\(/g,
        /console\.info\(/g,
        /console\.debug\(/g,
        /console\.trace\(/g
    ],

    // Manter apenas estes logs em produção (se necessário)
    keepLogs: [
        /console\.error\(/g
    ],

    // Configurações de cache busting
    cacheBusting: {
        enabled: true,
        hashLength: 8,
        exclude: ['manifest.json', 'sw.js']
    }
};

module.exports = buildConfig;
