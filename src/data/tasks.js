// LocalStorage-backed task store. The Super Administrator (or any user with
// the `assign_tasks` permission) can create tasks and assign them to specific
// users. Assignees can view their tasks and mark them complete.

const STORAGE_KEY = 'cca.tasks.v1';

const seed = () => ([
  {
    id: 't-1',
    title: 'Verify HR records for new intake',
    description: 'Cross-check the 12 new staff records against IPPIS export.',
    assigneeId: 'u-hr',
    assignedBy: 'u-super',
    dueDate: '2026-05-30',
    priority: 'High',
    status: 'In Progress',
    createdAt: '2026-05-10',
  },
  {
    id: 't-2',
    title: 'Quarterly audit walkthrough',
    description: 'Review audit trail entries for Q2 and flag anomalies.',
    assigneeId: 'u-audit',
    assignedBy: 'u-super',
    dueDate: '2026-06-15',
    priority: 'Medium',
    status: 'Pending',
    createdAt: '2026-05-12',
  },
]);

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  const initial = seed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const write = (tasks) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event('cca:tasks-changed'));
};

export const listTasks = () => read();

export const tasksForUser = (userId) =>
  read().filter((t) => t.assigneeId === userId);

export const createTask = (data) => {
  const tasks = read();
  const task = {
    id: 't-' + Math.random().toString(36).slice(2, 9),
    title: data.title,
    description: data.description || '',
    assigneeId: data.assigneeId,
    assignedBy: data.assignedBy,
    dueDate: data.dueDate || '',
    priority: data.priority || 'Medium',
    status: data.status || 'Pending',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  tasks.push(task);
  write(tasks);
  return task;
};

export const updateTask = (id, patch) => {
  const tasks = read();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch };
  write(tasks);
  return tasks[idx];
};

export const deleteTask = (id) => {
  write(read().filter((t) => t.id !== id));
};
