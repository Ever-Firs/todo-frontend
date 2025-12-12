class AuthManager {
    constructor() {
        this.API_URL = 'https://miniappsprouttodoapi.ru';
        this.token = localStorage.getItem('token');
        this.username = localStorage.getItem('username');
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Переключение между вкладками
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Форма входа
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });

        // Форма регистрации
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.register();
        });

        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!username || !password) {
            this.showToast('Заполните все поля', 'error');
            return;
        }

        try {
            console.log('Отправка запроса на вход...');
            const response = await fetch(`${this.API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Ошибка входа');
            }

            const data = await response.json();
            console.log('Получены данные:', data);

            if (!data.token) {
                throw new Error('Токен не получен');
            }

            this.token = data.token;
            this.username = username;
            
            localStorage.setItem('token', this.token);
            localStorage.setItem('username', this.username);
            
            this.showMainScreen();
            this.showToast('Вход выполнен успешно');
            
            // Инициализируем TaskManager
            window.taskManager = new TaskManager(this.token);
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showToast(error.message || 'Ошибка входа', 'error');
        }
    }

    async register() {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const confirmPassword = document.getElementById('confirm-password').value.trim();

        if (!username || !password || !confirmPassword) {
            this.showToast('Заполните все поля', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Пароли не совпадают', 'error');
            return;
        }

        if (password.length < 3) {
            this.showToast('Пароль должен быть не менее 3 символов', 'error');
            return;
        }

        try {
            console.log('Отправка запроса на регистрацию...');
            const response = await fetch(`${this.API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Ошибка регистрации');
            }

            const data = await response.json();
            console.log('Регистрация успешна:', data);

            this.showToast('Регистрация успешна! Теперь войдите в систему');
            this.switchTab('login');
            
            // Автозаполнение формы входа
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = password;
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            this.showToast(error.message || 'Ошибка регистрации', 'error');
        }
    }

    logout() {
        this.token = null;
        this.username = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        this.showAuthScreen();
        this.showToast('Выход выполнен');
        
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        
        this.switchTab('login');
    }

    checkAuth() {
        if (this.token && this.username) {
            this.showMainScreen();
            window.taskManager = new TaskManager(this.token);
        } else {
            this.showAuthScreen();
        }
    }

    showMainScreen() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        
        document.getElementById('current-user').textContent = this.username;
        this.updateDate();
    }

    showAuthScreen() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-screen').classList.add('hidden');
    }

    updateDate() {
        const dateElement = document.getElementById('current-date');
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        dateElement.textContent = now.toLocaleDateString('ru-RU', options);
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.remove('hidden');
    }
}

class TaskManager {
    constructor(token) {
        this.API_URL = 'http://localhost:8080/task';
        this.token = token;
        this.tasks = [];
        this.init();
    }

    async init() {
        console.log('TaskManager инициализирован с токеном:', this.token);
        this.bindEvents();
        await this.loadTasks();
        this.setupTelegram();
    }

    bindEvents() {
        const addBtn = document.getElementById('add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addTask());
        }

        const taskInput = document.getElementById('task-input');
        if (taskInput) {
            taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTask();
            });
        }

        // Скрыть клавиатуру при клике вне поля ввода
        document.addEventListener('click', (e) => {
            if (taskInput && e.target.id !== 'task-input') {
                taskInput.blur();
            }
        });
    }

    setupTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#ffffff');
            Telegram.WebApp.setBackgroundColor('#f5f5f5');
            
            document.body.style.paddingTop = '0';
            const container = document.querySelector('.container');
            if (container) {
                container.style.marginTop = '16px';
            }
        }
    }

    async loadTasks() {
        try {
            console.log('Загрузка задач...');
            this.showLoading();
            
            const response = await fetch(this.API_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            console.log('Статус загрузки задач:', response.status);
            
            if (response.status === 401) {
                console.log('Токен недействителен, выход из системы');
                window.authManager.logout();
                this.showToast('Сессия истекла, войдите снова', 'error');
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка загрузки задач:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const tasks = await response.json();
            console.log('Задачи загружены:', tasks);
            
            this.tasks = tasks;
            this.renderTasks();
            
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            this.showToast('Ошибка загрузки задач', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async addTask() {
        const input = document.getElementById('task-input');
        if (!input) return;
        
        const taskName = input.value.trim();
        
        if (!taskName) {
            this.showToast('Введите задачу', 'error');
            input.focus();
            return;
        }

        try {
            console.log('Добавление задачи:', taskName);
            
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({ name: taskName })
            });

            console.log('Статус добавления задачи:', response.status);
            
            if (response.status === 401) {
                window.authManager.logout();
                this.showToast('Сессия истекла, войдите снова', 'error');
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка добавления задачи:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const newTask = await response.json();
            console.log('Задача добавлена:', newTask);
            
            this.tasks.unshift(newTask);
            this.renderTasks();
            
            input.value = '';
            this.showToast('Задача добавлена');
            
        } catch (error) {
            console.error('Ошибка добавления задачи:', error);
            this.showToast('Ошибка добавления задачи', 'error');
        }
    }

    async updateTaskStatus(taskId, done) {
        try {
            console.log(`Обновление задачи ${taskId}: done=${done}`);
            
            const response = await fetch(`${this.API_URL}/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({ done })
            });

            console.log('Статус обновления задачи:', response.status);
            
            if (response.status === 401) {
                window.authManager.logout();
                this.showToast('Сессия истекла, войдите снова', 'error');
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка обновления задачи:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const updatedTask = await response.json();
            const index = this.tasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                this.tasks[index] = updatedTask;
            }
            
            this.renderTasks();
            this.showToast('Задача обновлена');
            
        } catch (error) {
            console.error('Ошибка обновления задачи:', error);
            this.showToast('Ошибка обновления задачи', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Удалить эту задачу?')) return;
        
        try {
            console.log(`Удаление задачи ${taskId}`);
            
            const response = await fetch(`${this.API_URL}/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            console.log('Статус удаления задачи:', response.status);
            
            if (response.status === 401) {
                window.authManager.logout();
                this.showToast('Сессия истекла, войдите снова', 'error');
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка удаления задачи:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.renderTasks();
            this.showToast('Задача удалена');
            
        } catch (error) {
            console.error('Ошибка удаления задачи:', error);
            this.showToast('Ошибка удаления задачи', 'error');
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasks-list');
        const emptyState = document.getElementById('empty-state');
        
        if (!tasksList || !emptyState) return;
        
        // Сортировка: сначала активные, потом выполненные
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
            
            // Добавляем обработчики событий
            sortedTasks.forEach(task => {
                const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
                if (taskElement) {
                    const checkbox = taskElement.querySelector('.task-checkbox');
                    const deleteBtn = taskElement.querySelector('.delete-btn');
                    
                    checkbox.addEventListener('click', () => {
                        this.updateTaskStatus(task.id, !task.done);
                    });
                    
                    deleteBtn.addEventListener('click', () => {
                        this.deleteTask(task.id);
                    });
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
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Документ загружен, инициализация...');
    window.authManager = new AuthManager();
});