# 📋 TaskFlow — Modern Task Manager

TaskFlow is a modern, responsive task management web application built using **HTML, CSS, and Vanilla JavaScript**. It helps users organize, track, and manage tasks efficiently with a clean UI and powerful features — all powered by **localStorage (no backend required)**.

🚀 Features
📊 Dashboard

- Overview of total, completed, pending, and overdue tasks
- Visual progress bar with completion percentage
- Recent tasks preview
- Dynamic greeting and date display

📝 Task Management

- Add, edit, and delete tasks
- Mark tasks as completed or pending
- Set:
  - Priority (High, Medium, Low)
  - Category (Work, Personal, Study, etc.)
  - Due dates

🔍 Smart Filtering & Sorting

- Filter by:
  - Status (All, Pending, Completed, Overdue)
  - Priority
  - Category
- Search tasks by title or description
- Sort by:
  - Newest / Oldest
  - Due date
  - Priority

🎨 UI/UX Features

- Dark & Light mode toggle
- Responsive design (mobile + desktop)
- Drag-and-drop interaction for task status
- Toast notifications for actions

💾 Data Persistence

- Uses **localStorage** to save tasks and preferences
- No database or backend required
- Data remains even after page reload

🏗️ Project Structure
TaskFlow/
│── index.html  
│── style.css  
│── script.js

⚙️ How It Works

1. User creates a task via UI
2. Task is stored in **localStorage**
3. UI dynamically updates:
   - Dashboard stats
   - Task list
4. Filters/sorting applied in real-time
5. Changes persist across reloads

🧠 Key Concepts Used

- Modular JavaScript (IIFE pattern)
- DOM manipulation
- Event handling
- Local storage API
- Responsive CSS design system
- State management without frameworks

📦 Installation & Usage

1. Download or clone the project
2. Open `index.html` in your browser
3. Start adding tasks
