class TaskManager {
    constructor() {
        this.API_URL = 'https://miniappsprouttodoapi.ru/task';
        this.tasks = [];
        this.init();
    }

    async init() {
        this.updateDate();
        this.bindEvents();
        await this.loadTasks();
        this.setupTelegram();
    }

    updateDate() {
        const dateElement = document.getElementById('current-date');
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        dateElement.textContent = now.toLocaleDateString('ru-RU', options);
    }

    bindEvents() {
        document.getElementById('add-btn').addEventListener('click', () => this.addTask());
        document.getElementById('task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Скрыть клавиатуру при клике вне поля ввода (для мобильных)
        document.addEventListener('click', (e) => {
            if (e.target.id !== 'task-input') {
                document.getElementById('task-input').blur();
            }
        });
    }

    setupTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#ffffff');
            Telegram.WebApp.setBackgroundColor('#f5f5f5');
            
            // Адаптивный интерфейс для Telegram
            document.body.style.paddingTop = '0';
            document.querySelector('.container').style.marginTop = '16px';
        }
    }

    async loadTasks() {
        try {
            this.showLoading();
            const response = await fetch(this.API_URL);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            this.tasks = await response.json();
            this.renderTasks();
        } catch (error) {
            this.showToast('Ошибка загрузки задач');
        } finally {
            this.hideLoading();
        }
    }

    async addTask() {
        const input = document.getElementById('task-input');
        const taskName = input.value.trim();
        
        if (!taskName) {
            this.showToast('Введите задачу');
            input.focus();
            return;
        }

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: taskName })
            });

            if (!response.ok) throw new Error('Ошибка создания');
            
            const newTask = await response.json();
            // ДОБАВЛЯЕМ ЗАДАЧУ В МАССИВ tasks
            this.tasks.unshift(newTask);
            this.renderTasks();
            
            input.value = '';
            this.showToast('Задача добавлена');
        } catch (error) {
            this.showToast('Ошибка');
            console.error('Add task error:', error);
        }
    }

    async updateTaskStatus(taskId, done) {
        try {
            const response = await fetch(`${this.API_URL}/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ done })
            });

            if (!response.ok) throw new Error('Ошибка обновления');
            
            const updatedTask = await response.json();
            // ОБНОВЛЯЕМ ЗАДАЧУ В МАССИВЕ
            const index = this.tasks.findIndex(t => t.id === taskId);
            if (index !== -1) this.tasks[index] = updatedTask;
            
            this.renderTasks();
        } catch (error) {
            this.showToast('Ошибка');
            console.error('Update task error:', error);
        }
    }

    async deleteTask(taskId) {
        try {
            const response = await fetch(`${this.API_URL}/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Ошибка удаления');
            
            // УДАЛЯЕМ ЗАДАЧУ ИЗ МАССИВА
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.renderTasks();
            this.showToast('Задача удалена');
        } catch (error) {
            this.showToast('Ошибка');
            console.error('Delete task error:', error);
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasks-list');
        const emptyState = document.getElementById('empty-state');
        
        // Сортировка: сначала активные, потом выполненные, самые новые сверху
        const sortedTasks = [...this.tasks].sort((a, b) => {
            if (a.done === b.done) {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            return a.done ? 1 : -1;
        });

        if (sortedTasks.length === 0) {
            tasksList.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            tasksList.innerHTML = sortedTasks.map(task => this.createTaskElement(task)).join('');
            
            // Добавляем обработчики событий для новых элементов
            sortedTasks.forEach(task => {
                const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
                if (taskElement) {
                    const checkbox = taskElement.querySelector('.task-checkbox');
                    const deleteBtn = taskElement.querySelector('.delete-btn');
                    
                    checkbox.addEventListener('click', () => 
                        this.updateTaskStatus(task.id, !task.done)
                    );
                    
                    deleteBtn.addEventListener('click', () => 
                        this.deleteTask(task.id)
                    );
                }
            });
        }
    }

    createTaskElement(task) {
        const date = new Date(task.created_at);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let dateText;
        if (diffDays === 1) {
            dateText = 'Сегодня';
        } else if (diffDays === 2) {
            dateText = 'Вчера';
        } else if (diffDays <= 7) {
            dateText = `${diffDays - 1} дня назад`;
        } else {
            dateText = date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short'
            });
        }

        return `
            <li class="task-item ${task.done ? 'task-done' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${task.done ? 'checked' : ''}"></div>
                <div class="task-content">
                    <div class="task-name">${this.escapeHtml(task.name)}</div>
                    <div class="task-meta">
                        <span class="task-date">${dateText}</span>
                        <span class="task-status">${task.done ? 'выполнено' : 'активно'}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="delete-btn" title="Удалить">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </li>
        `;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showToast(message, duration = 2000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
});