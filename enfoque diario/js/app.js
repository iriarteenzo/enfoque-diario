import { storage } from './storage.js';
import { cloudSync } from './cloud-sync.js';

let appState = null;
let draftSteps = [];
let undoSnapshot = null;
let toastTimer = null;
let activeStoryTaskId = null;

async function initApp() {
  appState = await storage.getState();

  // Verificar si venimos de un Magic Link o ya hay sesión activa
  const session = cloudSync.captureSessionFromUrl();
  if (session) {
    document.getElementById('cloudStatusText').textContent = `Conectado como ${session.email}`;
    const remoteState = await cloudSync.pullState(session);
    // Si la nube tiene datos más recientes que el dispositivo, actualizar local
    if (remoteState && remoteState.updatedAt > appState.updatedAt) {
      appState = await storage.saveState(remoteState);
      showToast('Agenda sincronizada desde la nube ☁️');
    }
  }

  applyTheme(appState.user.theme);
  updateHeaderDate();
  renderAll();
  bindEvents();
  registerServiceWorker();
}

async function commitState(newState) {
  appState = await storage.saveState(newState);
  renderAll();

  // Subir cambios en segundo plano si hay sesión activa
  const session = cloudSync.getSession();
  if (session) {
    cloudSync.pushState(session, appState).catch(() => {});
  }
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

  appState.categories.forEach((cat) => {
    const pendingTask = appState.tasks.find((t) => t.categoryId === cat.id && !t.completed);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story';
    btn.setAttribute('aria-label', `Ver resumen de ${cat.name}`);

    const ring = document.createElement('div');
    ring.className = `story-ring ${pendingTask ? '' : 'done'}`;

    const inner = document.createElement('div');
    inner.className = 'story-inner';
    inner.textContent = cat.icon;
    ring.appendChild(inner);

    const label = document.createElement('span');
    label.className = 'story-label';
    label.textContent = cat.name;

    btn.append(ring, label);
    btn.onclick = () => openStoryForCategory(cat, pendingTask);
    bar.appendChild(btn);
  });
}

function openStoryForCategory(cat, task) {
  const storyDialog = document.getElementById('storyDialog');
  const shell = document.getElementById('storyShell');
  shell.style.backgroundColor = cat.color;

  document.getElementById('storyModalCat').textContent = `${cat.icon} ${cat.name}`;
  const completeBtn = document.getElementById('storyCompleteBtn');

  if (task) {
    activeStoryTaskId = task.id;
    document.getElementById('storyModalTitle').textContent = task.title;
    document.getElementById('storyModalMeta').textContent = `⏰ ${task.startTime} – ${task.endTime}`;
    completeBtn.classList.remove('hidden');
  } else {
    activeStoryTaskId = null;
    document.getElementById('storyModalTitle').textContent = '¡Todo al día en esta categoría!';
    document.getElementById('storyModalMeta').textContent = 'No tienes tareas pendientes aquí.';
    completeBtn.classList.add('hidden');
  }

  storyDialog.showModal();
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

  const sorted = [...appState.tasks].sort(
    (a, b) => Number(a.completed) - Number(b.completed) || Number(b.isFrog) - Number(a.isFrog)
  );

  sorted.forEach((task) => {
    const cat = appState.categories.find((c) => c.id === task.categoryId) || appState.categories[0];
    const card = document.createElement('article');
    card.className = `task ${task.completed ? 'completed' : ''}`;

    const header = document.createElement('div');
    header.className = 'ig-header';
    const catInfo = document.createElement('div');
    catInfo.className = 'ig-cat';
    catInfo.textContent = `${cat.icon} ${cat.name} ${task.isFrog ? '• 🐸 Prioridad' : ''}`;
    header.appendChild(catInfo);
    card.appendChild(header);

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

    if (task.steps.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'task-details-wrap';
      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'steps';

      task.steps.forEach((step) => {
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

    const actions = document.createElement('div');
    actions.className = 'ig-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-action-btn';
    editBtn.setAttribute('aria-label', 'Editar tarea');
    editBtn.textContent = '✏️';
    editBtn.onclick = () => openTaskModal(task);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action-btn danger';
    delBtn.setAttribute('aria-label', 'Eliminar tarea');
    delBtn.textContent = '🗑';
    delBtn.onclick = () => deleteTask(task.id);

    actions.append(editBtn, delBtn);
    card.appendChild(actions);

    feed.appendChild(card);
  });
}

function renderRoutines() {
  const body = document.getElementById('routinesBody');
  body.replaceChildren();
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  appState.routines.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'routine-row';
    row.setAttribute('role', 'row');

    const nameCell = document.createElement('div');
    nameCell.className = 'routine-cell name';
    nameCell.setAttribute('role', 'rowheader');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = r.title;

    const delRoutineBtn = document.createElement('button');
    delRoutineBtn.type = 'button';
    delRoutineBtn.className = 'routine-del';
    delRoutineBtn.setAttribute('aria-label', `Eliminar hábito ${r.title}`);
    delRoutineBtn.textContent = '✕';
    delRoutineBtn.onclick = async () => {
      undoSnapshot = structuredClone(appState);
      const updated = structuredClone(appState);
      updated.routines = updated.routines.filter((item) => item.id !== r.id);
      await commitState(updated);
      showToast('Hábito eliminado', true);
    };

    nameCell.append(titleSpan, delRoutineBtn);
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
        const target = updated.routines.find((item) => item.id === r.id);
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
  appState.categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icon} ${c.name}`;
    sel.appendChild(opt);
  });
}

function renderDraftSteps() {
  const list = document.getElementById('subtasksDraftList');
  list.replaceChildren();
  draftSteps.forEach((step, idx) => {
    const item = document.createElement('div');
    item.className = 'step';

    const span = document.createElement('span');
    span.textContent = `• ${step.text}`;

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.textContent = '✕';
    rmBtn.setAttribute('aria-label', 'Quitar paso');
    rmBtn.onclick = () => {
      draftSteps.splice(idx, 1);
      renderDraftSteps();
    };
    item.append(span, rmBtn);
    list.appendChild(item);
  });
}

function openTaskModal(taskToEdit = null) {
  const dialog = document.getElementById('taskDialog');
  const form = document.getElementById('taskForm');
  const details = document.getElementById('taskAdvancedDetails');
  form.reset();

  if (taskToEdit) {
    document.getElementById('taskDialogTitle').textContent = 'Editar tarea';
    document.getElementById('editingTaskId').value = taskToEdit.id;
    document.getElementById('taskTitle').value = taskToEdit.title;
    document.getElementById('taskCategory').value = taskToEdit.categoryId;
    document.getElementById('taskStart').value = taskToEdit.startTime;
    document.getElementById('taskEnd').value = taskToEdit.endTime;
    document.getElementById('taskIsFrog').checked = taskToEdit.isFrog;
    document.getElementById('taskRepeat').value = taskToEdit.repeat;
    draftSteps = structuredClone(taskToEdit.steps);
    details.open = draftSteps.length > 0 || taskToEdit.repeat !== 'none';
  } else {
    document.getElementById('taskDialogTitle').textContent = 'Nueva tarea';
    document.getElementById('editingTaskId').value = '';
    draftSteps = [];
    details.open = false;
  }

  renderDraftSteps();
  dialog.showModal();
}

async function toggleTask(id) {
  const updated = structuredClone(appState);
  const t = updated.tasks.find((item) => item.id === id);
  if (!t) return;
  t.completed = !t.completed;
  if (t.completed && t.isFrog) {
    updated.user.hearts += 1;
    showToast('🐸 ¡Sapo completado! +1 ❤️');
  }
  await commitState(updated);
}

async function toggleStep(taskId, stepId) {
  const updated = structuredClone(appState);
  const t = updated.tasks.find((item) => item.id === taskId);
  const s = t?.steps.find((item) => item.id === stepId);
  if (s) s.done = !s.done;
  await commitState(updated);
}

async function deleteTask(id) {
  undoSnapshot = structuredClone(appState);
  const updated = structuredClone(appState);
  updated.tasks = updated.tasks.filter((t) => t.id !== id);
  await commitState(updated);
  showToast('Tarea eliminada', true);
}

function bindEvents() {
  const taskDialog = document.getElementById('taskDialog');
  const storyDialog = document.getElementById('storyDialog');
  const form = document.getElementById('taskForm');

  document.querySelectorAll('.nav button[data-view]').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.nav button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    };
  });

  document.getElementById('themeToggleBtn').onclick = async () => {
    const nextTheme = appState.user.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    await commitState({ ...appState, user: { ...appState.user, theme: nextTheme } });
  };
  document.getElementById('heartsBadge').onclick = () => {
    showToast('Completa tareas críticas (🐸) para ganar corazones ❤️');
  };
  document.getElementById('openNewTaskBtn').onclick = () => openTaskModal();
  document.getElementById('quickAddNavBtn').onclick = () => openTaskModal();
  document.getElementById('closeTaskDialog').onclick = () => taskDialog.close();
  document.getElementById('cancelTaskBtn').onclick = () => taskDialog.close();

  taskDialog.onclick = (e) => {
    if (e.target === taskDialog) taskDialog.close();
  };

  document.getElementById('closeStoryBtn').onclick = () => storyDialog.close();
  storyDialog.onclick = (e) => {
    if (e.target === storyDialog) storyDialog.close();
  };
  document.getElementById('storyCompleteBtn').onclick = async () => {
    if (activeStoryTaskId) {
      await toggleTask(activeStoryTaskId);
      storyDialog.close();
    }
  };

  document.getElementById('addStepBtn').onclick = () => {
    const input = document.getElementById('newStepInput');
    const text = input.value.trim();
    if (!text) return;
    draftSteps.push({ id: `s_${Date.now()}`, text, done: false });
    input.value = '';
    renderDraftSteps();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const editingId = document.getElementById('editingTaskId').value;
    const payload = {
      id: editingId || `t_${Date.now()}`,
      title: document.getElementById('taskTitle').value,
      categoryId: document.getElementById('taskCategory').value,
      startTime: document.getElementById('taskStart').value,
      endTime: document.getElementById('taskEnd').value,
      isFrog: document.getElementById('taskIsFrog').checked,
      repeat: document.getElementById('taskRepeat').value,
      completed: false,
      steps: draftSteps
    };

    let nextTasks;
    if (editingId) {
      nextTasks = appState.tasks.map((t) => (t.id === editingId ? { ...t, ...payload, completed: t.completed } : t));
    } else {
      nextTasks = [payload, ...appState.tasks];
    }

    await commitState({ ...appState, tasks: nextTasks });
    taskDialog.close();
    showToast(editingId ? 'Tarea actualizada' : 'Tarea creada');
  };

  document.getElementById('addRoutineBtn').onclick = async () => {
    const title = prompt('Nombre del nuevo hábito:');
    if (!title?.trim()) return;
    const newRoutine = { id: `r_${Date.now()}`, title: title.trim(), days: Array(7).fill(false) };
    await commitState({ ...appState, routines: [...appState.routines, newRoutine] });
  };

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
    a.download = `enfoque-diario-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('importJsonInput').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      appState = await storage.importJSON(file);
      applyTheme(appState.user.theme);
      renderAll();
      showToast('Agenda restaurada con éxito');
    } catch (err) {
      showToast(err.message);
    } finally {
      e.target.value = '';
    }
  };

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
