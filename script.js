/**
 * ══════════════════════════════════════════════════════════
 *  TASKFLOW — Main Application Script
 *  Modular vanilla JS | localStorage | ES6+
 * ══════════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. STORAGE MANAGER  — localStorage abstraction layer
═══════════════════════════════════════════════════════════ */
const StorageManager = (() => {
    const KEYS = {
        TASKS:  'taskflow_tasks',
        THEME:  'taskflow_theme',
        PREFS:  'taskflow_prefs',
    };

    const get = (key, fallback = null) => {
        try {
            const raw = localStorage.getItem(key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.warn(`StorageManager.get failed for key "${key}":`, e);
            return fallback;
        }
    };

    const set = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`StorageManager.set failed for key "${key}":`, e);
            return false;
        }
    };

    const remove = (key) => {
        try { localStorage.removeItem(key); return true; }
        catch (e) { return false; }
    };

    const clearAll = () => {
        Object.values(KEYS).forEach(remove);
    };

    return {
        KEYS,
        getTasks:    ()       => get(KEYS.TASKS,  []),
        saveTasks:   (tasks)  => set(KEYS.TASKS,  tasks),
        getTheme:    ()       => get(KEYS.THEME,  'dark'),
        saveTheme:   (theme)  => set(KEYS.THEME,  theme),
        getPrefs:    ()       => get(KEYS.PREFS,  {}),
        savePrefs:   (prefs)  => set(KEYS.PREFS,  prefs),
        clearAll,
    };
})();


/* ═══════════════════════════════════════════════════════════
   2. TASK MANAGER  — Data / business logic layer
═══════════════════════════════════════════════════════════ */
const TaskManager = (() => {

    // Generate a tiny unique id (collision-safe for local use)
    const generateId = () =>
        Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // Priority sort weight
    const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

    // Returns true when a pending task's due date has passed
    const isOverdue = (task) => {
        if (!task.due || task.completed) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(task.due + 'T00:00:00');
        return due < today;
    };

    // Build a new task object from raw form data
    const buildTask = (data) => ({
        id:          generateId(),
        title:       data.title.trim(),
        description: (data.description || '').trim(),
        due:         data.due  || null,
        priority:    data.priority  || 'medium',
        category:    data.category  || 'other',
        completed:   false,
        createdAt:   new Date().toISOString(),
        completedAt: null,
    });

    // ── CRUD ──────────────────────────────────────────────
    const getAll = () => StorageManager.getTasks();

    const add = (data) => {
        const tasks = getAll();
        const task  = buildTask(data);
        tasks.unshift(task);   // newest first in storage
        StorageManager.saveTasks(tasks);
        return task;
    };

    const update = (id, data) => {
        const tasks = getAll();
        const idx   = tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;
        tasks[idx] = {
            ...tasks[idx],
            title:       data.title.trim(),
            description: (data.description || '').trim(),
            due:         data.due  || null,
            priority:    data.priority,
            category:    data.category,
        };
        StorageManager.saveTasks(tasks);
        return tasks[idx];
    };

    const remove = (id) => {
        const tasks   = getAll();
        const updated = tasks.filter(t => t.id !== id);
        StorageManager.saveTasks(updated);
        return updated.length !== tasks.length;
    };

    const toggleComplete = (id) => {
        const tasks = getAll();
        const idx   = tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;
        tasks[idx].completed   = !tasks[idx].completed;
        tasks[idx].completedAt = tasks[idx].completed ? new Date().toISOString() : null;
        StorageManager.saveTasks(tasks);
        return tasks[idx];
    };

    const getById = (id) => getAll().find(t => t.id === id) || null;

    // ── Stats ─────────────────────────────────────────────
    const getStats = () => {
        const tasks    = getAll();
        const total    = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending   = total - completed;
        const overdue   = tasks.filter(t => isOverdue(t)).length;
        const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, pending, overdue, pct };
    };

    // ── Filter & Sort ─────────────────────────────────────
    const filterAndSort = (filters) => {
        let tasks = getAll();

        // Status filter
        if (filters.status === 'completed') tasks = tasks.filter(t => t.completed);
        else if (filters.status === 'pending')   tasks = tasks.filter(t => !t.completed);
        else if (filters.status === 'overdue')   tasks = tasks.filter(t => isOverdue(t));

        // Priority filter
        if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);

        // Category filter
        if (filters.category) tasks = tasks.filter(t => t.category === filters.category);

        // Search
        if (filters.search) {
            const q = filters.search.toLowerCase();
            tasks = tasks.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.description || '').toLowerCase().includes(q)
            );
        }

        // Sort
        const now = Date.now();
        tasks.sort((a, b) => {
            switch (filters.sort) {
                case 'created_asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'due_asc':
                    if (!a.due && !b.due) return 0;
                    if (!a.due) return 1;
                    if (!b.due) return -1;
                    return new Date(a.due) - new Date(b.due);
                case 'due_desc':
                    if (!a.due && !b.due) return 0;
                    if (!a.due) return 1;
                    if (!b.due) return -1;
                    return new Date(b.due) - new Date(a.due);
                case 'priority_desc':
                    return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
                case 'created_desc':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        return tasks;
    };

    return { isOverdue, buildTask, getAll, add, update, remove, toggleComplete, getById, getStats, filterAndSort };
})();


/* ═══════════════════════════════════════════════════════════
   3. UI MANAGER  — DOM rendering layer
═══════════════════════════════════════════════════════════ */
const UIManager = (() => {

    // ── Helpers ──────────────────────────────────────────
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    /** Format ISO/date string → readable */
    const fmtDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    /** Get relative date label */
    const relativeDate = (dateStr) => {
        if (!dateStr) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const due   = new Date(dateStr + 'T00:00:00');
        const diff  = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diff === 0)  return 'Due today';
        if (diff === 1)  return 'Due tomorrow';
        if (diff === -1) return 'Due yesterday';
        if (diff < 0)    return `${Math.abs(diff)}d overdue`;
        if (diff <= 7)   return `Due in ${diff}d`;
        return fmtDate(dateStr);
    };

    /** Category display name + emoji */
    const CAT_META = {
        work:     { label: 'Work',     emoji: '💼' },
        personal: { label: 'Personal', emoji: '🏠' },
        study:    { label: 'Study',    emoji: '📚' },
        health:   { label: 'Health',   emoji: '💪' },
        finance:  { label: 'Finance',  emoji: '💰' },
        other:    { label: 'Other',    emoji: '🔖' },
    };

    const catMeta = (cat) => CAT_META[cat] || { label: cat, emoji: '🔖' };

    // ── Toast ─────────────────────────────────────────────
    const showToast = (message, type = 'success') => {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div class="toast-dot"></div><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 350);
        }, 2800);
    };

    // ── Theme ─────────────────────────────────────────────
    const applyTheme = (isDark) => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        // Sync all theme toggles
        $$('#themeToggle, #themeToggle2').forEach(el => { el.checked = isDark; });
        // Update sidebar icon label
        const label = $('#themeLabel');
        if (label) label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
        StorageManager.saveTheme(isDark ? 'dark' : 'light');
    };

    // ── View Switching ────────────────────────────────────
    const switchView = (viewName) => {
        // Hide all views
        $$('.view').forEach(v => v.classList.remove('active'));
        // Deactivate all nav items
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        // Activate target view
        const view = $(`#${viewName}View`);
        if (view) view.classList.add('active');
        // Activate matching nav item
        const navBtn = $(`.nav-item[data-view="${viewName}"]`);
        if (navBtn) navBtn.classList.add('active');
        // Scroll to top
        $('.views-container').scrollTop = 0;
    };

    // ── Dashboard Rendering ───────────────────────────────
    const renderDashboard = () => {
        const stats = TaskManager.getStats();

        // Greeting based on time of day
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const sub = `${greeting}! Here's your productivity snapshot.`;
        const greetEl = $('#dashGreeting');
        if (greetEl) greetEl.textContent = sub;

        // Current date
        const dateEl = $('#currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
            });
        }

        // Stats
        animateCount('statTotal',     stats.total);
        animateCount('statCompleted', stats.completed);
        animateCount('statPending',   stats.pending);
        animateCount('statOverdue',   stats.overdue);

        // Sub-labels
        const setLabel = (id, txt) => { const el = $('#'+id); if (el) el.textContent = txt; };
        setLabel('statTotalSub',     stats.total === 0 ? 'No tasks yet' : `${stats.total} task${stats.total !== 1 ? 's' : ''} tracked`);
        setLabel('statCompletedSub', stats.pct + '% completion rate');
        setLabel('statPendingSub',   stats.pending === 0 ? 'All clear!' : 'In progress');
        setLabel('statOverdueSub',   stats.overdue === 0 ? 'All on track!' : 'Needs attention');

        // Progress bar
        const bar  = $('#progressBar');
        const pct  = $('#progressPct');
        const lbl  = $('#progressLabel');
        if (bar)  bar.style.width  = stats.pct + '%';
        if (pct)  pct.textContent  = stats.pct + '%';
        if (lbl)  lbl.textContent  =
            stats.total === 0 ? 'Add tasks to track progress'
            : `${stats.completed} of ${stats.total} tasks completed`;

        // Segment labels
        setLabel('segCompleted', stats.completed);
        setLabel('segPending',   stats.pending);
        setLabel('segOverdue',   stats.overdue);

        // Nav badge (pending count)
        const badge = $('#navBadge');
        if (badge) {
            badge.textContent = stats.pending;
            badge.classList.toggle('visible', stats.pending > 0);
        }

        // Recent tasks (latest 5)
        renderRecentTasks();
    };

    /* Animated counter for stat values */
    const animateCount = (elId, targetVal) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const start = parseInt(el.textContent) || 0;
        const end   = targetVal;
        if (start === end) { el.textContent = end; return; }
        const duration = 500;
        const startTime = performance.now();
        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            el.textContent = Math.round(start + (end - start) * eased);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const renderRecentTasks = () => {
        const container = $('#recentTasksList');
        if (!container) return;
        const tasks = TaskManager.getAll().slice(0, 5);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 32px 16px;">
                    <div class="empty-icon" style="width:52px;height:52px;font-size:1.3rem">📋</div>
                    <p class="empty-desc">No tasks yet. Click <strong>New Task</strong> to get started.</p>
                </div>`;
            return;
        }

        container.innerHTML = tasks.map(task => {
            const overdue = TaskManager.isOverdue(task);
            const dateLabel = task.due ? relativeDate(task.due) : 'No due date';
            return `
            <div class="recent-item ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}"
                 data-id="${task.id}" role="button" tabindex="0"
                 aria-label="Task: ${escHtml(task.title)}">
                <div class="recent-check">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="recent-info">
                    <div class="recent-title">${escHtml(task.title)}</div>
                    <div class="recent-meta">${catMeta(task.category).emoji} ${catMeta(task.category).label} · ${dateLabel}</div>
                </div>
                <span class="recent-priority priority-badge ${task.priority}">${task.priority}</span>
            </div>`;
        }).join('');
    };

    // ── Tasks Grid Rendering ─────────────────────────────
    const renderTasks = (filters) => {
        const container = $('#tasksGrid');
        if (!container) return;

        const tasks = TaskManager.filterAndSort(filters);

        // Update task count label
        const countLabel = $('#taskCountLabel');
        if (countLabel) countLabel.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

        if (tasks.length === 0) {
            container.innerHTML = renderEmptyState(filters);
            return;
        }

        container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');

        // Attach drag-and-drop to each card
        $$('.task-card', container).forEach(attachDragEvents);
    };

    const renderEmptyState = (filters) => {
        const isFiltered = filters.status !== 'all' || filters.priority || filters.category || filters.search;
        if (isFiltered) {
            return `<div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3 class="empty-title">No tasks found</h3>
                <p class="empty-desc">Try adjusting your filters or search term to find what you're looking for.</p>
            </div>`;
        }
        return `<div class="empty-state">
            <div class="empty-icon">✨</div>
            <h3 class="empty-title">Your task list is empty</h3>
            <p class="empty-desc">Create your first task to start tracking your work and boosting productivity.</p>
            <div class="empty-action">
                <button class="btn-primary" id="emptyAddBtn">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Add First Task
                </button>
            </div>
        </div>`;
    };

    const renderTaskCard = (task) => {
        const overdue  = TaskManager.isOverdue(task);
        const checked  = task.completed ? 'checked' : '';
        const dateHtml = task.due ? `
            <div class="due-date ${overdue ? 'overdue' : ''}">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                ${relativeDate(task.due)}
            </div>` : `<div class="due-date"><span style="color:var(--text-muted);font-size:0.75rem">No due date</span></div>`;

        const meta = catMeta(task.category);
        const classes = [
            'task-card',
            task.priority,
            task.completed ? 'completed' : '',
            overdue        ? 'overdue'   : '',
        ].filter(Boolean).join(' ');

        return `
        <article class="${classes}" draggable="true" data-id="${task.id}" role="article"
                 aria-label="Task: ${escHtml(task.title)}">
            <div class="card-top">
                <div class="card-badges">
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                    <span class="category-badge">${meta.emoji} ${meta.label}</span>
                </div>
                <button class="task-check ${checked}" data-action="toggle" data-id="${task.id}"
                        aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="card-body">
                <h3 class="task-title">${escHtml(task.title)}</h3>
                ${task.description ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
            </div>
            <div class="card-footer">
                ${dateHtml}
                <div class="card-actions">
                    <button class="action-btn edit" data-action="edit" data-id="${task.id}" aria-label="Edit task" title="Edit">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M9.5 1.5l2 2-8 8H1.5v-2l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" data-action="delete" data-id="${task.id}" aria-label="Delete task" title="Delete">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2 3h9M5 3V2h3v1M5.5 6v4M7.5 6v4M3 3l.8 8a1 1 0 001 .9h4.4a1 1 0 001-.9L11 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </article>`;
    };

    // ── Drag & Drop ───────────────────────────────────────
    let dragSrcId = null;

    const attachDragEvents = (card) => {
        card.addEventListener('dragstart', (e) => {
            dragSrcId = card.dataset.id;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragSrcId);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            $$('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));
            dragSrcId = null;
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (card.dataset.id !== dragSrcId) {
                $$('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));
                card.classList.add('drag-over');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (!dragSrcId || dragSrcId === card.dataset.id) return;
            // Toggle completion of dropped card (pending → completed, or vice versa)
            const targetTask = TaskManager.getById(card.dataset.id);
            const srcTask    = TaskManager.getById(dragSrcId);
            if (targetTask && srcTask && targetTask.completed !== srcTask.completed) {
                TaskManager.toggleComplete(dragSrcId);
                App.refresh();
                UIManager.showToast(
                    `Task marked as ${srcTask.completed ? 'pending' : 'completed'}!`,
                    'success'
                );
            }
        });
    };

    // ── Modal: Add / Edit Task ────────────────────────────
    const openTaskModal = (task = null) => {
        const modal  = $('#taskModal');
        const title  = $('#modalHeading');
        const saveBtn = $('#saveTaskBtn');

        if (task) {
            title.textContent  = 'Edit Task';
            saveBtn.textContent = 'Update Task';
            $('#taskTitle').value    = task.title;
            $('#taskDesc').value     = task.description || '';
            $('#taskDue').value      = task.due || '';
            $('#taskPriority').value = task.priority;
            setActiveCategory(task.category);
        } else {
            title.textContent  = 'New Task';
            saveBtn.textContent = 'Save Task';
            resetForm();
        }

        clearFormErrors();
        modal.classList.add('active');
        setTimeout(() => $('#taskTitle').focus(), 100);
    };

    const closeTaskModal = () => {
        $('#taskModal').classList.remove('active');
        resetForm();
    };

    const resetForm = () => {
        $('#taskForm').reset();
        setActiveCategory('work');
        clearFormErrors();
    };

    const setActiveCategory = (cat) => {
        $('#taskCategory').value = cat;
        $$('.cat-pill').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.cat === cat);
        });
    };

    const clearFormErrors = () => {
        $$('.form-error').forEach(el => el.textContent = '');
        $$('.form-input').forEach(el => el.classList.remove('error'));
    };

    const validateForm = () => {
        clearFormErrors();
        let valid = true;
        const title    = $('#taskTitle').value.trim();
        const priority = $('#taskPriority').value;

        if (!title) {
            showFieldError('taskTitle', 'titleError', 'Title is required');
            valid = false;
        } else if (title.length < 2) {
            showFieldError('taskTitle', 'titleError', 'Title must be at least 2 characters');
            valid = false;
        }
        if (!priority) {
            showFieldError('taskPriority', 'priorityError', 'Please select a priority');
            valid = false;
        }
        return valid;
    };

    const showFieldError = (inputId, errorId, msg) => {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        if (input) input.classList.add('error');
        if (error) error.textContent = msg;
    };

    const getFormData = () => ({
        title:       $('#taskTitle').value.trim(),
        description: $('#taskDesc').value.trim(),
        due:         $('#taskDue').value || null,
        priority:    $('#taskPriority').value,
        category:    $('#taskCategory').value || 'work',
    });

    // ── Modal: Delete Confirmation ────────────────────────
    const openDeleteModal = (id, taskTitle) => {
        $('#deleteTaskTitle').textContent = `"${taskTitle}"`;
        $('#deleteModal').classList.add('active');
        $('#deleteModal').dataset.deleteId = id;
    };

    const closeDeleteModal = () => {
        $('#deleteModal').classList.remove('active');
        delete $('#deleteModal').dataset.deleteId;
    };

    // Escape HTML to prevent XSS
    const escHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    };

    return {
        showToast,
        applyTheme,
        switchView,
        renderDashboard,
        renderTasks,
        openTaskModal,
        closeTaskModal,
        openDeleteModal,
        closeDeleteModal,
        validateForm,
        getFormData,
        setActiveCategory,
        clearFormErrors,
    };
})();


/* ═══════════════════════════════════════════════════════════
   4. APP  — Main controller / event binding
═══════════════════════════════════════════════════════════ */
const App = (() => {

    // Centralized state
    const state = {
        currentView:   'dashboard',
        editingTaskId: null,
        filters: {
            status:   'all',
            priority: '',
            category: '',
            sort:     'created_desc',
            search:   '',
        },
    };

    // DOM shorthand
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => [...document.querySelectorAll(sel)];

    // ── Refresh both views ────────────────────────────────
    const refresh = () => {
        UIManager.renderDashboard();
        UIManager.renderTasks(state.filters);
    };

    // ── Navigation ────────────────────────────────────────
    const navigateTo = (viewName) => {
        state.currentView = viewName;
        UIManager.switchView(viewName);
        closeSidebar();
    };

    // ── Sidebar (mobile) ─────────────────────────────────
    const openSidebar = () => {
        $('#sidebar').classList.add('open');
        $('#sidebarOverlay').classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        $('#sidebar').classList.remove('open');
        $('#sidebarOverlay').classList.remove('show');
        document.body.style.overflow = '';
    };

    // ── Task Form Submit ──────────────────────────────────
    const handleSaveTask = () => {
        if (!UIManager.validateForm()) return;
        const data = UIManager.getFormData();

        if (state.editingTaskId) {
            TaskManager.update(state.editingTaskId, data);
            UIManager.showToast('Task updated successfully!', 'success');
            state.editingTaskId = null;
        } else {
            TaskManager.add(data);
            UIManager.showToast('Task created!', 'success');
        }

        UIManager.closeTaskModal();
        refresh();
    };

    // ── Delete Flow ───────────────────────────────────────
    const handleConfirmDelete = () => {
        const id = $('#deleteModal').dataset.deleteId;
        if (!id) return;
        TaskManager.remove(id);
        UIManager.closeDeleteModal();
        UIManager.showToast('Task deleted.', 'info');
        refresh();
    };

    // ── Toggle Complete ───────────────────────────────────
    const handleToggle = (id) => {
        const task = TaskManager.toggleComplete(id);
        if (task) {
            UIManager.showToast(
                task.completed ? '✓ Task completed!' : 'Task marked as pending.',
                task.completed ? 'success' : 'info'
            );
        }
        refresh();
    };

    // ── Theme Toggle ──────────────────────────────────────
    const handleThemeToggle = (isDark) => {
        UIManager.applyTheme(isDark);
        // Sync both toggles
        $$('#themeToggle, #themeToggle2').forEach(el => { el.checked = isDark; });
    };

    // ── Search (debounced) ────────────────────────────────
    let searchTimer = null;
    const handleSearch = (val) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.filters.search = val;
            if (state.currentView !== 'tasks') navigateTo('tasks');
            UIManager.renderTasks(state.filters);
        }, 220);
    };

    // ── Export ────────────────────────────────────────────
    const handleExport = () => {
        const tasks = TaskManager.getAll();
        if (tasks.length === 0) {
            UIManager.showToast('No tasks to export.', 'warning');
            return;
        }
        const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `taskflow-export-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UIManager.showToast('Tasks exported!', 'success');
    };

    // ── Clear All Data ────────────────────────────────────
    const handleClearData = () => {
        const confirmed = window.confirm('Are you sure you want to delete ALL tasks and reset all settings? This cannot be undone.');
        if (!confirmed) return;
        StorageManager.clearAll();
        state.filters = { status: 'all', priority: '', category: '', sort: 'created_desc', search: '' };
        UIManager.applyTheme(true);
        refresh();
        UIManager.showToast('All data cleared.', 'warning');
    };

    // ── Event Delegation (task grid clicks) ───────────────
    const handleGridClick = (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;
        const { action, id } = actionBtn.dataset;

        if (action === 'toggle') {
            handleToggle(id);
        } else if (action === 'edit') {
            const task = TaskManager.getById(id);
            if (!task) return;
            state.editingTaskId = id;
            UIManager.openTaskModal(task);
        } else if (action === 'delete') {
            const task = TaskManager.getById(id);
            if (!task) return;
            UIManager.openDeleteModal(id, task.title);
        }
    };

    // ── Recent List Clicks (dashboard) ───────────────────
    const handleRecentClick = (e) => {
        const item = e.target.closest('.recent-item');
        if (!item) return;
        const id = item.dataset.id;
        // Toggle complete on click
        handleToggle(id);
    };

    // ── Keyboard Shortcut (Cmd/Ctrl+K focuses search) ────
    const handleKeydown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            const search = $('#searchInput');
            if (search) search.focus();
        }
        if (e.key === 'Escape') {
            UIManager.closeTaskModal();
            UIManager.closeDeleteModal();
            closeSidebar();
        }
    };

    // ── Bind All Events ───────────────────────────────────
    const bindEvents = () => {

        // ─ Navigation
        $$('.nav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => navigateTo(btn.dataset.view));
        });

        // ─ View-all link on dashboard
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view]');
            if (btn && !btn.classList.contains('nav-item')) {
                navigateTo(btn.dataset.view);
            }
            // Empty state add button
            if (e.target.closest('#emptyAddBtn')) {
                UIManager.openTaskModal();
            }
        });

        // ─ Sidebar (mobile)
        $('#hamburger')?.addEventListener('click', openSidebar);
        $('#sidebarClose')?.addEventListener('click', closeSidebar);
        $('#sidebarOverlay')?.addEventListener('click', closeSidebar);

        // ─ Add Task buttons
        $('#addTaskBtn')?.addEventListener('click',  () => { state.editingTaskId = null; UIManager.openTaskModal(); });
        $('#addTaskBtn2')?.addEventListener('click', () => { state.editingTaskId = null; UIManager.openTaskModal(); });

        // ─ Modal: save / cancel / close
        $('#saveTaskBtn')?.addEventListener('click', handleSaveTask);
        $('#cancelBtn')?.addEventListener('click',   UIManager.closeTaskModal);
        $('#modalClose')?.addEventListener('click',  UIManager.closeTaskModal);

        // Submit on Enter inside form inputs (but not textarea)
        $('#taskForm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleSaveTask();
            }
        });

        // ─ Modal: click outside to close
        document.addEventListener('click', (e) => {
            if (e.target.id === 'taskModal')   UIManager.closeTaskModal();
            if (e.target.id === 'deleteModal') UIManager.closeDeleteModal();
        });

        // ─ Delete Modal
        $('#confirmDeleteBtn')?.addEventListener('click', handleConfirmDelete);
        $('#cancelDeleteBtn')?.addEventListener('click',  UIManager.closeDeleteModal);
        $('#deleteClose')?.addEventListener('click',      UIManager.closeDeleteModal);

        // ─ Category pills
        document.querySelectorAll('.cat-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const cat = pill.dataset.cat;
                UIManager.setActiveCategory(cat);
            });
        });

        // ─ Task Grid: delegated clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('#tasksGrid')) handleGridClick(e);
        });

        // ─ Recent list clicks (dashboard)
        $('#recentTasksList')?.addEventListener('click', handleRecentClick);

        // ─ Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.filters.status = tab.dataset.filter;
                UIManager.renderTasks(state.filters);
            });
        });

        // ─ Filter selects
        $('#priorityFilter')?.addEventListener('change', (e) => {
            state.filters.priority = e.target.value;
            UIManager.renderTasks(state.filters);
        });
        $('#categoryFilter')?.addEventListener('change', (e) => {
            state.filters.category = e.target.value;
            UIManager.renderTasks(state.filters);
        });
        $('#sortSelect')?.addEventListener('change', (e) => {
            state.filters.sort = e.target.value;
            UIManager.renderTasks(state.filters);
        });

        // ─ Search
        $('#searchInput')?.addEventListener('input', (e) => handleSearch(e.target.value));

        // ─ Theme toggles (both sidebar + settings)
        document.querySelectorAll('#themeToggle, #themeToggle2').forEach(toggle => {
            toggle.addEventListener('change', (e) => handleThemeToggle(e.target.checked));
        });

        // ─ Settings buttons
        $('#exportBtn')?.addEventListener('click', handleExport);
        $('#clearDataBtn')?.addEventListener('click', handleClearData);

        // ─ Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);

        // ─ Form field: clear error on input
        document.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('error');
            });
        });
    };

    // ── Init ──────────────────────────────────────────────
    const init = () => {
        // Load and apply saved theme
        const savedTheme = StorageManager.getTheme();
        const isDark = savedTheme !== 'light';
        UIManager.applyTheme(isDark);

        // Bind all events
        bindEvents();

        // Initial render
        refresh();

        // Navigate to dashboard
        navigateTo('dashboard');
    };

    return { init, refresh };
})();


/* ═══════════════════════════════════════════════════════════
   5. BOOTSTRAP
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
