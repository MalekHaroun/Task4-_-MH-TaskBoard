/* MyTaskBoard — lightweight Kanban workspace
   Tasks and the selected visual theme are stored locally in this browser. */

   const STORAGE_KEY = "mytaskboard.tasks.v1";
   const THEME_KEY = "mytaskboard.theme.v1";
   const LEGACY_STORAGE_KEY = "dayline.tasks.v1";
   const LEGACY_THEME_KEY = "dayline.theme.v1";
   const STATUSES = ["todo", "in-progress", "completed"];
   const STATUS_LABELS = {
     todo: "To Do",
     "in-progress": "In Progress",
     completed: "Completed"
   };
   // Lower number = shown first. Within the same priority, newest tasks stay on top.
   const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
   
   const taskForm = document.getElementById("task-form");
   const taskTitle = document.getElementById("task-title");
   const taskDescription = document.getElementById("task-description");
   const taskCategory = document.getElementById("task-category");
   const taskPriority = document.getElementById("task-priority");
   const searchInput = document.getElementById("search-input");
   const categoryFilter = document.getElementById("category-filter");
   const board = document.getElementById("board");
   const clearCompletedButton = document.getElementById("clear-completed");
   const themeToggle = document.getElementById("theme-toggle");
   const toast = document.getElementById("toast");
   const editDialog = document.getElementById("edit-dialog");
   const editForm = document.getElementById("edit-form");
   
   let tasks = loadTasks();
   let draggedTaskId = null;
   let toastTimer = null;
   
   // Read and lightly validate saved data so an outdated or damaged entry cannot break the board.
   function loadTasks() {
     try {
       const savedValue = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]";
       const saved = JSON.parse(savedValue);
       if (!Array.isArray(saved)) return [];
   
       return saved.filter((task) =>
         task &&
         typeof task.id === "string" &&
         typeof task.title === "string" &&
         STATUSES.includes(task.status) &&
         ["Low", "Medium", "High"].includes(task.priority) &&
         typeof task.category === "string"
       ).map((task) => ({
         id: task.id,
         title: task.title,
         description: typeof task.description === "string" ? task.description : "",
         category: task.category,
         priority: task.priority,
         status: task.status,
         createdAt: task.createdAt || new Date().toISOString(),
         updatedAt: task.updatedAt || task.createdAt || new Date().toISOString()
       }));
     } catch (error) {
       console.warn("Could not read saved MyTaskBoard tasks:", error);
       return [];
     }
   }
   
   function saveTasks() {
     try {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
       return true;
     } catch (error) {
       console.error("Could not save MyTaskBoard tasks:", error);
       showToast("Storage is unavailable. Your changes may not survive a refresh.");
       return false;
     }
   }
   
   function createId() {
     if (window.crypto && typeof window.crypto.randomUUID === "function") {
       return window.crypto.randomUUID();
     }
     return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
   }
   
   function createElement(tag, className, text) {
     const element = document.createElement(tag);
     if (className) element.className = className;
     if (text !== undefined) element.textContent = text;
     return element;
   }
   
   function showToast(message) {
     window.clearTimeout(toastTimer);
     toast.textContent = message;
     toast.classList.add("is-visible");
     toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
   }
   
   // Filter by search and category, then sort High → Medium → Low.
   // Array.sort is stable, so tasks with the same priority keep their order (newest first).
   function getFilteredTasks() {
     const query = searchInput.value.trim().toLocaleLowerCase();
     const category = categoryFilter.value;
   
     return tasks
       .filter((task) => {
         const matchesTitle = task.title.toLocaleLowerCase().includes(query);
         const matchesCategory = category === "All" || task.category === category;
         return matchesTitle && matchesCategory;
       })
       .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
   }
   
   function renderOverview() {
     const total = tasks.length;
     const completed = tasks.filter((task) => task.status === "completed").length;
     const active = total - completed;
     const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
   
     document.getElementById("total-count").textContent = total;
     document.getElementById("active-count").textContent = active;
     document.getElementById("completed-count").textContent = completed;
     document.getElementById("progress-label").textContent = `${percentage}%`;
     document.getElementById("progress-bar").style.width = `${percentage}%`;
     clearCompletedButton.disabled = completed === 0;
   }
   
   function renderTasks() {
     const lists = {
       todo: document.getElementById("list-todo"),
       "in-progress": document.getElementById("list-in-progress"),
       completed: document.getElementById("list-completed")
     };
     const counts = { todo: 0, "in-progress": 0, completed: 0 };
     const filteredTasks = getFilteredTasks();
   
     Object.values(lists).forEach((list) => list.replaceChildren());
   
     filteredTasks.forEach((task) => {
       counts[task.status] += 1;
       lists[task.status].appendChild(createTaskCard(task));
     });
   
     STATUSES.forEach((status) => {
       document.getElementById(`count-${status}`).textContent = counts[status];
       if (counts[status] === 0) {
         const isFiltering = searchInput.value.trim() !== "" || categoryFilter.value !== "All";
         const empty = createElement("div", "empty-state");
         empty.appendChild(createElement("span", "empty-state-icon", isFiltering ? "⌕" : "＋"));
         empty.appendChild(createElement("strong", "", isFiltering ? "No matching tasks" : "Nothing here yet"));
         empty.appendChild(createElement("span", "", isFiltering ? "Try another search or filter." : "Tasks you place here will appear here."));
         lists[status].appendChild(empty);
       }
     });
   
     const hasFilters = searchInput.value.trim() !== "" || categoryFilter.value !== "All";
     document.getElementById("visible-summary").textContent = hasFilters
       ? `Showing ${filteredTasks.length} of ${tasks.length} tasks`
       : `Showing all ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
     renderOverview();
   }
   
   function createTaskCard(task) {
     const card = createElement("article", "task-card");
     card.dataset.priority = task.priority;
     card.dataset.taskId = task.id;
     card.draggable = true;
     card.setAttribute("aria-label", `${task.title}, ${task.priority} priority, ${STATUS_LABELS[task.status]}`);
   
     const top = createElement("div", "task-card-top");
     top.appendChild(createElement("h4", "task-card-title", task.title));
     top.appendChild(createElement("span", "drag-grip", "⠿"));
     card.appendChild(top);
   
     const description = createElement("p", "task-description", task.description);
     card.appendChild(description);
   
     const meta = createElement("div", "task-meta");
     meta.appendChild(createElement("span", "category-tag", task.category));
     meta.appendChild(createElement("span", "priority-tag", `${task.priority} priority`));
     card.appendChild(meta);
   
     const footer = createElement("div", "task-card-footer");
     const statusSelect = createElement("select", "status-select");
     statusSelect.setAttribute("aria-label", `Move ${task.title} to another column`);
     STATUSES.forEach((status) => {
       const option = createElement("option", "", STATUS_LABELS[status]);
       option.value = status;
       option.selected = task.status === status;
       statusSelect.appendChild(option);
     });
     statusSelect.addEventListener("change", () => updateTaskStatus(task.id, statusSelect.value));
     footer.appendChild(statusSelect);
   
     const editButton = createElement("button", "card-action", "✎");
     editButton.type = "button";
     editButton.setAttribute("aria-label", `Edit ${task.title}`);
     editButton.title = "Edit task";
     editButton.addEventListener("click", () => openEditDialog(task));
     footer.appendChild(editButton);
   
     const deleteButton = createElement("button", "card-action delete-action", "×");
     deleteButton.type = "button";
     deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
     deleteButton.title = "Delete task";
     deleteButton.addEventListener("click", () => deleteTask(task.id));
     footer.appendChild(deleteButton);
   
     card.appendChild(footer);
     card.addEventListener("dragstart", handleDragStart);
     card.addEventListener("dragend", handleDragEnd);
     return card;
   }
   
   function handleAddTask(event) {
     event.preventDefault();
     const title = taskTitle.value.trim();
     if (!title) {
       taskTitle.focus();
       return;
     }
   
     const now = new Date().toISOString();
     tasks.unshift({
       id: createId(),
       title,
       description: taskDescription.value.trim(),
       category: taskCategory.value,
       priority: taskPriority.value,
       status: "todo",
       createdAt: now,
       updatedAt: now
     });
   
     saveTasks();
     taskForm.reset();
     taskTitle.focus();
     renderTasks();
     showToast("Task added to your To Do list.");
   }
   
   function updateTaskStatus(id, newStatus) {
     if (!STATUSES.includes(newStatus)) return;
     const task = tasks.find((item) => item.id === id);
     if (!task || task.status === newStatus) return;
   
     task.status = newStatus;
     task.updatedAt = new Date().toISOString();
     saveTasks();
     renderTasks();
     showToast(`Moved to ${STATUS_LABELS[newStatus]}.`);
   }
   
   function deleteTask(id) {
     const task = tasks.find((item) => item.id === id);
     if (!task) return;
     if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
   
     tasks = tasks.filter((item) => item.id !== id);
     saveTasks();
     renderTasks();
     showToast("Task deleted.");
   }
   
   function clearCompleted() {
     const completedCount = tasks.filter((task) => task.status === "completed").length;
     if (completedCount === 0) return;
     if (!window.confirm(`Clear ${completedCount} completed ${completedCount === 1 ? "task" : "tasks"}?`)) return;
   
     tasks = tasks.filter((task) => task.status !== "completed");
     saveTasks();
     renderTasks();
     showToast("Completed tasks cleared.");
   }
   
   function openEditDialog(task) {
     document.getElementById("edit-id").value = task.id;
     document.getElementById("edit-title").value = task.title;
     document.getElementById("edit-description").value = task.description;
     document.getElementById("edit-category").value = task.category;
     document.getElementById("edit-priority").value = task.priority;
   
     if (typeof editDialog.showModal === "function") {
       editDialog.showModal();
     } else {
       showToast("Your browser does not support editing tasks in this dialog.");
     }
     document.getElementById("edit-title").focus();
   }
   
   function saveEditedTask(event) {
     event.preventDefault();
     const id = document.getElementById("edit-id").value;
     const task = tasks.find((item) => item.id === id);
     const title = document.getElementById("edit-title").value.trim();
     if (!task || !title) return;
   
     task.title = title;
     task.description = document.getElementById("edit-description").value.trim();
     task.category = document.getElementById("edit-category").value;
     task.priority = document.getElementById("edit-priority").value;
     task.updatedAt = new Date().toISOString();
   
     saveTasks();
     editDialog.close();
     renderTasks();
     showToast("Your changes have been saved.");
   }
   
   // Native HTML5 drag and drop lets a card move between workflow columns.
   function handleDragStart(event) {
     draggedTaskId = event.currentTarget.dataset.taskId;
     event.currentTarget.classList.add("dragging");
     event.dataTransfer.effectAllowed = "move";
     event.dataTransfer.setData("text/plain", draggedTaskId);
   }
   
   function handleDragEnd(event) {
     event.currentTarget.classList.remove("dragging");
     draggedTaskId = null;
     document.querySelectorAll(".column.is-drop-target").forEach((column) => column.classList.remove("is-drop-target"));
   }
   
   function setupDropZones() {
     document.querySelectorAll(".column").forEach((column) => {
       column.addEventListener("dragover", (event) => {
         if (!draggedTaskId) return;
         event.preventDefault();
         event.dataTransfer.dropEffect = "move";
         column.classList.add("is-drop-target");
       });
   
       column.addEventListener("dragleave", (event) => {
         if (!column.contains(event.relatedTarget)) column.classList.remove("is-drop-target");
       });
   
       column.addEventListener("drop", (event) => {
         event.preventDefault();
         column.classList.remove("is-drop-target");
         const id = event.dataTransfer.getData("text/plain") || draggedTaskId;
         const newStatus = column.dataset.status;
         if (id && STATUSES.includes(newStatus)) updateTaskStatus(id, newStatus);
       });
     });
   }
   
   function applyTheme(theme) {
     const selectedTheme = theme === "dark" ? "dark" : "light";
     document.documentElement.dataset.theme = selectedTheme;
     const isDark = selectedTheme === "dark";
     themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
     themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
     document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#071522" : "#f3f8fc");
     try { localStorage.setItem(THEME_KEY, selectedTheme); } catch (error) { /* Theme still works for this session. */ }
   }
   
   function initialiseTheme() {
     let savedTheme = "light";
     try { savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY) || "light"; } catch (error) { /* Use light theme. */ }
     applyTheme(savedTheme);
   }
   
   function initialiseDate() {
     const now = new Date();
     document.getElementById("today-date").textContent = new Intl.DateTimeFormat("en-GB", {
       weekday: "short", day: "numeric", month: "short", year: "numeric"
     }).format(now);
     document.getElementById("footer-year").textContent = now.getFullYear();
   }
   
   // Event listeners and first render.
   taskForm.addEventListener("submit", handleAddTask);
   searchInput.addEventListener("input", renderTasks);
   categoryFilter.addEventListener("change", renderTasks);
   document.getElementById("reset-filters").addEventListener("click", () => {
     searchInput.value = "";
     categoryFilter.value = "All";
     renderTasks();
   });
   clearCompletedButton.addEventListener("click", clearCompleted);
   themeToggle.addEventListener("click", () => {
     const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
     applyTheme(nextTheme);
   });
   editForm.addEventListener("submit", saveEditedTask);
   document.getElementById("cancel-edit").addEventListener("click", () => editDialog.close());
   document.getElementById("close-dialog").addEventListener("click", () => editDialog.close());
   editDialog.addEventListener("click", (event) => {
     if (event.target === editDialog) editDialog.close();
   });
   
   initialiseTheme();
   initialiseDate();
   setupDropZones();
   renderTasks();