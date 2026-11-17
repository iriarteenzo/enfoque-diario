const DB_NAME = 'EnfoqueDiarioDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';
const STATE_KEY = 'root_state';

export const DEFAULT_STATE = {
  version: 2,
  updatedAt: Date.now(),
  user: { name: 'Usuario', hearts: 2, theme: 'dark' },
  categories: [
    { id: 'cat_work', name: 'Trabajo', color: '#2563eb', icon: '💼' },
    { id: 'cat_health', name: 'Salud', color: '#059669', icon: '🌿' },
    { id: 'cat_personal', name: 'Personal', color: '#7c3aed', icon: '✨' }
  ],
  tasks: [],
  routines: [
    { id: 'r_1', title: 'Leer 20 min', days: [true, true, false, false, false, false, false] },
    { id: 'r_2', title: 'Hidratación 2L', days: [true, false, false, false, false, false, false] }
  ]
};

class StorageService {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => reject(new Error('No se pudo abrir IndexedDB'));
    });
  }

  sanitizeText(str, max = 150) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().slice(0, max);
  }

  sanitizeAndValidate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Estructura JSON inválida.');
    }

    const clean = structuredClone(DEFAULT_STATE);
    clean.updatedAt = Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now();

    if (input.user && typeof input.user === 'object') {
      clean.user.name = this.sanitizeText(input.user.name || 'Usuario', 40) || 'Usuario';
      clean.user.hearts = Number.isFinite(input.user.hearts) ? Math.max(0, input.user.hearts) : 2;
      clean.user.theme = input.user.theme === 'light' ? 'light' : 'dark';
    }

    if (Array.isArray(input.categories) && input.categories.length > 0) {
      clean.categories = input.categories.slice(0, 25).map((c, i) => ({
        id: this.sanitizeText(c.id || `cat_${i}`, 32),
        name: this.sanitizeText(c.name || 'General', 30),
        color: /^#[0-9A-Fa-f]{6}$/.test(c.color) ? c.color : '#2563eb',
        icon: this.sanitizeText(c.icon || '📌', 4)
      }));
    }

    const defaultCatId = clean.categories[0].id;

    if (Array.isArray(input.tasks)) {
      clean.tasks = input.tasks.slice(0, 500).map((t, i) => ({
        id: this.sanitizeText(t.id || `t_${Date.now()}_${i}`, 40),
        title: this.sanitizeText(t.title || 'Tarea sin título', 120),
        categoryId: this.sanitizeText(t.categoryId || defaultCatId, 32),
        startTime: /^\d{2}:\d{2}$/.test(t.startTime) ? t.startTime : '09:00',
        endTime: /^\d{2}:\d{2}$/.test(t.endTime) ? t.endTime : '10:00',
        completed: Boolean(t.completed),
        isFrog: Boolean(t.isFrog),
        repeat: ['none', 'daily', 'weekly'].includes(t.repeat) ? t.repeat : 'none',
        steps: Array.isArray(t.steps)
          ? t.steps.slice(0, 20).map((s, si) => ({
              id: this.sanitizeText(s.id || `s_${si}`, 32),
              text: this.sanitizeText(s.text || '', 100),
              done: Boolean(s.done)
            }))
          : []
      }));
    }

    if (Array.isArray(input.routines)) {
      clean.routines = input.routines.slice(0, 50).map((r, i) => ({
        id: this.sanitizeText(r.id || `r_${i}`, 32),
        title: this.sanitizeText(r.title || 'Rutina', 80),
        days: Array.isArray(r.days) && r.days.length === 7 ? r.days.map(Boolean) : Array(7).fill(false)
      }));
    }

    return clean;
  }

  async getState() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
      req.onsuccess = () => {
        resolve(req.result ? this.sanitizeAndValidate(req.result) : structuredClone(DEFAULT_STATE));
      };
      req.onerror = () => resolve(structuredClone(DEFAULT_STATE));
    });
  }

  async saveState(state) {
    await this.init();
    const clean = this.sanitizeAndValidate({ ...state, updatedAt: Date.now() });
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(clean, STATE_KEY);
      req.onsuccess = () => resolve(clean);
      req.onerror = () => reject(req.error);
    });
  }

  async importJSON(file) {
    if (!file || file.size > 2 * 1024 * 1024) {
      throw new Error('El archivo debe ser un JSON válido menor a 2 MB.');
    }
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('El archivo JSON está dañado y no se puede leer.');
    }
    return this.saveState(parsed);
  }
}

export const storage = new StorageService();
