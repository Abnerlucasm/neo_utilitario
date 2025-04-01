class ExerciseManager {
    constructor(config) {
        this.config = {
            validateSQL: false,
            autoComplete: false,
            ...config
        };
        this.exercises = new Map();
    }

    init() {
        this.setupExerciseEvents();
        this.loadExercises();
    }

    setupExerciseEvents() {
        const submitButton = document.getElementById('submitAnswer');
        const showSolutionButton = document.getElementById('showSolution');

        if (submitButton) {
            submitButton.addEventListener('click', () => this.checkAnswer());
        }

        if (showSolutionButton) {
            showSolutionButton.addEventListener('click', () => this.showSolution());
        }
    }

    loadExercises() {
        // Carregar exercícios do conteúdo atual
        const exerciseArea = document.getElementById('exerciseArea');
        if (!exerciseArea) return;

        const exerciseQuestion = document.getElementById('exerciseQuestion');
        if (exerciseQuestion) {
            exerciseQuestion.textContent = this.getCurrentExercise()?.question || '';
        }
    }

    getCurrentExercise() {
        // Implementar lógica para obter exercício atual
        return {
            question: 'Escreva uma consulta SQL para selecionar todos os usuários.',
            solution: 'SELECT * FROM users;'
        };
    }

    checkAnswer() {
        const answer = document.querySelector('.exercise-editor')?.textContent;
        if (!answer) return;

        const exercise = this.getCurrentExercise();
        if (!exercise) return;

        const isCorrect = this.validateAnswer(answer, exercise.solution);
        this.showFeedback(isCorrect);
    }

    validateAnswer(answer, solution) {
        if (this.config.validateSQL) {
            // Implementar validação específica para SQL
            return this.validateSQLAnswer(answer, solution);
        }
        return answer.trim().toLowerCase() === solution.trim().toLowerCase();
    }

    validateSQLAnswer(answer, solution) {
        // Implementar comparação de queries SQL
        // Isso pode envolver parser SQL e comparação de ASTs
        return true; // Temporário
    }

    showSolution() {
        const exercise = this.getCurrentExercise();
        if (!exercise) return;

        const editor = document.querySelector('.exercise-editor');
        if (editor) {
            editor.textContent = exercise.solution;
        }
    }

    showFeedback(isCorrect) {
        const feedback = document.getElementById('exerciseFeedback');
        if (!feedback) return;

        feedback.classList.remove('is-hidden', 'is-success', 'is-danger');
        feedback.classList.add(isCorrect ? 'is-success' : 'is-danger');
        feedback.textContent = isCorrect ? 
            'Correto! Muito bem!' : 
            'Incorreto. Tente novamente ou veja a solução.';
    }
} 