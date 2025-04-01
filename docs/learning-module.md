# Módulo de Aprendizagem

## Visão Geral
O módulo de aprendizagem é uma plataforma que permite criar e gerenciar conteúdo educacional de forma estruturada. Ele foi projetado para ser flexível e permitir diferentes tipos de conteúdo.

## Como Funciona

### 1. Criação de Módulos
- Primeiro, você cria um módulo (ex: PostgreSQL, JavaScript, etc.)
- Cada módulo tem um ID único, título e descrição
- O módulo serve como um container para todo o conteúdo relacionado

### 2. Estrutura do Conteúdo
- Módulos são divididos em seções (ex: "Introdução", "Conceitos Básicos", etc.)
- Cada seção contém uma ou mais páginas
- Páginas podem conter texto em Markdown, código e componentes interativos

### 3. Fluxo de Acesso
- **Usuários Normais**: Acessam o conteúdo através de `/learn/[modulo-id]`
- **Administradores**: Acessam o painel admin em `/admin/learning/modules`
- Para criar conteúdo, primeiro crie um módulo e depois acesse seu editor

### 4. Tipos de Páginas
1. **Página de Listagem**: `/learn/[modulo-id]`
   - Mostra todas as seções e páginas disponíveis
   - Permite navegação estruturada pelo conteúdo

2. **Página de Conteúdo**: `/learn/[modulo-id]/[pagina-id]`
   - Exibe o conteúdo específico da página
   - Suporta Markdown e componentes interativos

3. **Página Admin**: `/admin/learning/module/[modulo-id]`
   - Interface para editar conteúdo
   - Gerenciamento de seções e páginas

### 5. Componentes Interativos
- Podem ser adicionados às páginas
- Exemplos: terminais SQL, editores de código, quizzes
- São reutilizáveis entre diferentes módulos

### 6. Permissões
- Visualização: Disponível para todos os usuários
- Edição: Restrita a administradores
- Criação de módulos: Apenas administradores

### 7. Recursos
- Editor WYSIWYG para conteúdo
- Suporte a Markdown
- Preview em tempo real
- Versionamento de conteúdo
- Componentes interativos

## Próximos Passos
1. Sistema de progresso do usuário
2. Exportação de conteúdo
3. Temas personalizados
4. Suporte a múltiplos idiomas
5. Sistema de busca integrado

## Índice
- [Módulo de Aprendizagem](#módulo-de-aprendizagem)
  - [Visão Geral](#visão-geral)
  - [Como Funciona](#como-funciona)
    - [1. Criação de Módulos](#1-criação-de-módulos)
    - [2. Estrutura do Conteúdo](#2-estrutura-do-conteúdo)
    - [3. Fluxo de Acesso](#3-fluxo-de-acesso)
    - [4. Tipos de Páginas](#4-tipos-de-páginas)
    - [5. Componentes Interativos](#5-componentes-interativos)
    - [6. Permissões](#6-permissões)
    - [7. Recursos](#7-recursos)
  - [Próximos Passos](#próximos-passos)
  - [Índice](#índice)
  - [Estrutura do Projeto](#estrutura-do-projeto)

## Estrutura do Projeto 