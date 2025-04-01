class BaseExercise {
    constructor(config) {
        this.config = config;
        this.solution = '';
    }

    validateAnswer(answer) {
        // Implementação base para validação
        return true;
    }

    showSolution() {
        // Implementação base para mostrar solução
    }

    showFeedback(isCorrect, message) {
        const feedback = document.getElementById('exerciseFeedback');
        feedback.classList.remove('is-hidden', 'is-success', 'is-danger');
        feedback.classList.add(isCorrect ? 'is-success' : 'is-danger');
        feedback.textContent = message;
    }
} 