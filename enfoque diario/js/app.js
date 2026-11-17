import { storage } from './storage.js';
import { cloudSync } from './cloud-sync.js';

let appState = null;
let draftSteps = [];
let undoSnapshot = null;
let toastTimer = null;

// Inicialización
async function initApp() {
  appState = await storage.getState();
  applyTheme(appState.user.theme);
  renderAll();
  bindEvents();
  registerServiceWorker();
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}

async function commitState(newState) {
  appState = await storage.saveState(newState);
  renderAll();
}

function showToast(message, canUndo = false) {
  const toast = document.getElementById('toast');
  toast.replaceChildren();

  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);

  if (canUndo && undoSnapshot) {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = 'Deshacer';
    undoBtn.onclick = async () => {
      await commitState(undoSnapshot);
      undoSnapshot = null;
      toast.classList.add('hidden');
    };
    toast.appendChild(undoBtn);
  }

  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

// Renderizado seguro (100% DOM APIs / textContent, inmune a XSS)
function renderAll() {
  document.getElementById('heartsCount').textContent = appState.user.hearts;
  document.getElementById('userNameInput').value = appState.user.name;
  document.getElementById('userAvatar').textContent = appState.user.name.charAt(0).toUpperCase();

  renderStories();
  renderFeed();
  renderRoutines();
  renderCategorySelect();
}

function renderStories() {
  const bar = document.getElementById('storiesBar');
  bar.replaceChildren();

  appState.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story';
    btn.innerHTML = `<div class="story-ring"><div class="story-inner">${cat.icon}</div></div>`;
    const label = document.createElement('span');
    label.className = 'story-label';
    label.textContent = cat.name;
    btn.appendChild(label);
    bar.appendChild(btn);
  });
}

function renderFeed() {
  const feed = document.getElementById('tasksFeed');
  feed.replaceChildren();

  if (appState.tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No tienes tareas pendientes hoy. Toca "+ Nueva tarea" para empezar.';
    feed.appendChild(empty);
    return;
  }

  // Ordenar: "Sapos" (tareas críticas) primero, completadas al final
  const sorted = [...appState.tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || Number(b.isFrog) - Number(a.isFrog));

  sorted.forEach(task => {
    const cat = appState.categories.find(c => c.id === task.categoryId) || appState.categories;
    const card = document.createElement('article');
    card.className = `task ${task.completed ? 'completed' : ''}`;

    // Header
    const header = document.createElement('div');
    header.className = 'ig-header';
    const catInfo = document.createElement('div');
    catInfo.className = 'ig-cat';
    catInfo.textContent = `${cat.icon} ${cat.name} ${task.isFrog ? '• 🐸 Prioridad' : ''}`;
    header.appendChild(catInfo);
    card.appendChild(header);

    // Body con color de categoría
    const body = document.createElement('div');
    body.className = 'ig-body';
    body.style.backgroundColor = cat.color;

    const info = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'ig-title';
    title.textContent = task.title;
    const meta = document.createElement('div');
    meta.className = 'ig-time-meta';
    meta.textContent = `⏰ ${task.startTime} – ${task.endTime}`;
    info.append(title, meta);

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = `check ${task.completed ? 'done' : ''}`;
    checkBtn.setAttribute('aria-label', `Marcar "${task.title}" como ${task.completed ? 'pendiente' : 'completada'}`);
    checkBtn.textContent = task.completed ? '✓' : '';
    checkBtn.onclick = () => toggleTask(task.id);

    body.append(info, checkBtn);
    card.appendChild(body);

    // Subtareas si existen
    if (task.steps.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'task-details-wrap';
      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'steps';

      task.steps.forEach(step => {
        const sBtn = document.createElement('button');
        sBtn.type = 'button';
        sBtn.className = `step ${step.done ? 'done' : ''}`;
        sBtn.textContent = `${step.done ? '☑' : '☐'} ${step.text}`;
        sBtn.onclick = () => toggleStep(task.id, step.id);
        stepsDiv.appendChild(sBtn);
      });
      wrap.appendChild(stepsDiv);
      card.appendChild(wrap);
    }

    // Acciones inferiores
    const actions = document.createElement('div');
    actions.className = 'ig-actions';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action-btn danger';
    delBtn.setAttribute('aria-label', 'Eliminar tarea');
    delBtn.textContent = '🗑';
    delBtn.onclick = () => deleteTask(task.id);
    actions.appendChild(delBtn);
    card.appendChild(actions);

    feed.appendChild(card);
  });
}

function renderRoutines() {
  const body = document.getElementById('routinesBody');
  body.replaceChildren();
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  appState.routines.forEach(r => {
    const row = document.createElement('div');
    row.className = 'routine-row';
    row.setAttribute('role', 'row');

    const nameCell = document.createElement('div');
    nameCell.className = 'routine-cell name';
    nameCell.setAttribute('role', 'rowheader');
    nameCell.textContent = r.title;
    row.appendChild(nameCell);

    r.days.forEach((done, idx) => {
      const cell = document.createElement('div');
      cell.className = 'routine-cell';
      cell.setAttribute('role', 'cell');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `routine-dot ${done ? 'on' : ''}`;
      btn.setAttribute('aria-pressed', String(done));
      btn.setAttribute('aria-label', `${r.title} - ${dayNames[idx]}`);
      btn.textContent = done ? '✓' : '';
      btn.onclick = async () => {
        const updated = structuredClone(appState);
        const target = updated.routines.find(item => item.id === r.id);
        target.days[idx] = !target.days[idx];
        await commitState(updated);
      };

      cell.appendChild(btn);
      row.appendChild(cell);
    });

    body.appendChild(row);
  });
}

function renderCategorySelect() {
  const sel = document.getElementById('taskCategory');
  sel.replaceChildren();
  appState.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icon} ${c.name}`;
    sel.appendChild(opt);
  });
}

// Acciones de Negocio
async function toggleTask(id) {
  const updated = structuredClone(appState);
  const t = updated.tasks.find(item => item.id === id);
  if (!t) return;
  t.completed = !t.completed;
  if (t.completed && t.isFrog) updated.user.hearts += 1;
  await commitState(updated);
}

async function toggleStep(taskId, stepId) {
  const updated = structuredClone(appState);
  const t = updated.tasks.find(item => item.id === taskId);
  const s = t?.steps.find(item => item.id === stepId);
  if (s) s.done = !s.done;
  await commitState(updated);
}

async function deleteTask(id) {
  undoSnapshot = structuredClone(appState);
  const updated = structuredClone(appState);
  updated.tasks = updated.tasks.filter(t => t.id !== id);
  await commitState(updated);
  showToast('Tarea eliminada', true);
}

// Eventos DOM
function bindEvents() {
  const dialog = document.getElementById('taskDialog');
  const form = document.getElementById('taskForm');

  // Navegación entre vistas
  document.querySelectorAll('.nav button[data-view]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    };
  });

  // Cambio de tema
  document.getElementById('themeToggleBtn').onclick = async () => {
    const nextTheme = appState.user.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    await commitState({ ...appState, user: { ...appState.user, theme: nextTheme } });
  };

  // Abrir/Cerrar <dialog>
  const openModal = () => {
    form.reset();
    draftSteps = [];
    document.getElementById('subtasksDraftList').replaceChildren();
    dialog.showModal();
  };
  document.getElementById('openNewTaskBtn').onclick = openModal;
  document.getElementById('quickAddNavBtn').onclick = openModal;
  document.getElementById('closeTaskDialog').onclick = () => dialog.close();
  document.getElementById('cancelTaskBtn').onclick = () => dialog.close();
  dialog.onclick = (e) => { if (e.target === dialog) dialog.close(); };

  // Añadir subtarea en borrador
  document.getElementById('addStepBtn').onclick = () => {
    const input = document.getElementById('newStepInput');
    const text = input.value.trim();
    if (!text) return;
    draftSteps.push({ id: `s_${Date.now()}`, text, done: false });
    input.value = '';
    const list = document.getElementById('subtasksDraftList');
    const item = document.createElement('div');
    item.className = 'step';
    item.textContent = `• ${text}`;
    list.appendChild(item);
  };

  // Guardar nueva tarea
  form.onsubmit = async (e) => {
    e.preventDefault();
    const newTask = {
    id: t_${Date.now()},
    title: document.getElementById('taskTitle').value,
    categoryId: document.getElementById('taskCategory').value,
    startTime: document.getElementById('taskStart').value,
    endTime: document.getElementById('taskEnd').value,
    isFrog: document.getElementById('taskIsFrog').checked,
    repeat: document.getElementById('taskRepeat').value,
    completed: false,
    steps: draftSteps
    };
    await commitState({ ...appState, tasks: [newTask, ...appState.tasks] });
    dialog.close();
    showToast('Tarea creada');
  };
  // Nueva rutina
    document.getElementById('addRoutineBtn').onclick = async () => {
    const title = prompt('Nombre del nuevo hábito:');
    if (!title?.trim()) return;
    const newRoutine = { id: r_${Date.now()}, title: title.trim(), days: Array(7).fill(false) };
    await commitState({ ...appState, routines: [...appState.routines, newRoutine] });
  };
  // Perfil, Exportación e Importación JSON
    document.getElementById('saveProfileBtn').onclick = async () => {
    const name = document.getElementById('userNameInput').value;
    await commitState({ ...appState, user: { ...appState.user, name } });
    showToast('Perfil actualizado');
    };
    document.getElementById('exportJsonBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = enfoque-diario-${new Date().toISOString().slice(0, 10)}.json;
    a.click();
    URL.revokeObjectURL(url);
    };
    document.getElementById('importJsonInput').onchange = async (e) => {
    try {
    appState = await storage.importJSON(e.target.files);
    applyTheme(appState.user.theme);
    renderAll();
    showToast('Agenda restaurada con éxito');
    } catch (err) {
    showToast(err.message);
    } finally {
    e.target.value = '';
    }
  };
  // Conexión Nube Gratuita
    document.getElementById('cloudLoginBtn').onclick = async () => {
    try {
    const email = document.getElementById('cloudEmailInput').value;
    await cloudSync.sendMagicLink(email);
    showToast('Revisa tu correo para confirmar el acceso');
    } catch (err) {
    showToast(err.message);
    }
    };
    }
    function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
}
initApp();