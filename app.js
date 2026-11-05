/*
 * Daily To-Do — all the app's logic lives in this file.
 *
 * How it works, in short:
 *  1. Everything is stored in one object called `data`, saved in the browser (localStorage).
 *  2. Each calendar day has its own list of tasks: data.days["2026-11-05"].tasks
 *  3. When you open the app on a new day, unfinished tasks from earlier days pop up
 *     and you choose to keep them for today or discard them.
 *  4. Completing tasks earns points, levels and awards (badges).
 */

// ---------- Saving & loading ----------

const STORAGE_KEY = "dailyTodo.v1";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.days) return saved;
  } catch (e) {
    console.warn("Could not read saved data", e);
  }
  return { days: {}, badges: {} }; // fresh start
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // If cloud sync is switched on (see sync.js), send the change to your other devices too.
  if (window.cloudSave) window.cloudSave(data);
}

let data = load();

// ---------- Date helpers ----------

// Today's date as "YYYY-MM-DD" in your local time zone.
function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function prettyDate(key, opts = { month: "short", day: "numeric" }) {
  return keyToDate(key).toLocaleDateString(undefined, opts);
}

function getDay(key) {
  if (!data.days[key]) data.days[key] = { tasks: [] };
  return data.days[key];
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Rewards: points, levels, streaks ----------

const POINTS_PER_TASK = 10;
const POINTS_PER_BADGE = 50;
const LEVEL_NAMES = ["Beginner", "Starter", "Doer", "Achiever", "Go-getter", "Pro", "Master", "Legend"];

function allTasks() {
  return Object.values(data.days).flatMap((d) => d.tasks);
}

function totalDone() {
  return allTasks().filter((t) => t.done).length;
}

function points() {
  return totalDone() * POINTS_PER_TASK + Object.keys(data.badges).length * POINTS_PER_BADGE;
}

// Each level needs 100 more points than the one before (100, 200, 300 …).
function levelInfo(pts) {
  let level = 1, need = 100, floor = 0;
  while (pts >= floor + need) { floor += need; level++; need += 100; }
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  return { level, name, into: pts - floor, need };
}

// A "perfect day" = at least 3 tasks, all completed.
function isPerfect(day) {
  return day && day.tasks.length >= 3 && day.tasks.every((t) => t.done);
}

function perfectDays() {
  return Object.values(data.days).filter(isPerfect).length;
}

// Streak = how many days in a row (ending today or yesterday) you finished at least one task.
function streak() {
  const hasDone = (key) => data.days[key]?.tasks.some((t) => t.done);
  const d = new Date();
  if (!hasDone(todayKey(d))) d.setDate(d.getDate() - 1); // today not started yet is OK
  let count = 0;
  while (hasDone(todayKey(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

// ---------- Awards ----------
// Each award has a check() that returns true once it's earned. Add your own here!

const BADGES = [
  { id: "first",     emoji: "🌱", name: "First Step",    desc: "Complete your first task",       check: () => totalDone() >= 1 },
  { id: "ten",       emoji: "✋", name: "High Ten",       desc: "Complete 10 tasks",              check: () => totalDone() >= 10 },
  { id: "fifty",     emoji: "🚀", name: "Liftoff",        desc: "Complete 50 tasks",              check: () => totalDone() >= 50 },
  { id: "hundred",   emoji: "💯", name: "Century",        desc: "Complete 100 tasks",             check: () => totalDone() >= 100 },
  { id: "fivehund",  emoji: "🏆", name: "Champion",       desc: "Complete 500 tasks",             check: () => totalDone() >= 500 },
  { id: "perfect1",  emoji: "✨", name: "Perfect Day",    desc: "Finish all tasks (3+) in a day", check: () => perfectDays() >= 1 },
  { id: "perfect5",  emoji: "🌟", name: "Flawless Five",  desc: "Have 5 perfect days",            check: () => perfectDays() >= 5 },
  { id: "streak3",   emoji: "🔥", name: "On Fire",        desc: "3-day streak",                   check: () => streak() >= 3 },
  { id: "streak7",   emoji: "📅", name: "Week Warrior",   desc: "7-day streak",                   check: () => streak() >= 7 },
  { id: "streak30",  emoji: "👑", name: "Unstoppable",    desc: "30-day streak",                  check: () => streak() >= 30 },
  { id: "busy",      emoji: "🐝", name: "Busy Bee",       desc: "Complete 10 tasks in one day",   check: () => Object.values(data.days).some((d) => d.tasks.filter((t) => t.done).length >= 10) },
  { id: "early",     emoji: "🌅", name: "Early Bird",     desc: "Complete a task before 8 AM",    check: () => allTasks().some((t) => t.done && new Date(t.doneAt).getHours() < 8) },
  { id: "owl",       emoji: "🦉", name: "Night Owl",      desc: "Complete a task after 10 PM",    check: () => allTasks().some((t) => t.done && new Date(t.doneAt).getHours() >= 22) },
  { id: "second",    emoji: "🔁", name: "Second Chance",  desc: "Finish a task carried over from a past day", check: () => allTasks().some((t) => t.done && t.carriedFrom) },
  { id: "level5",    emoji: "🎖️", name: "Level 5",        desc: "Reach level 5",                  check: () => levelInfo(points()).level >= 5 },
];

// Look for newly earned awards and celebrate them.
function checkBadges() {
  const levelBefore = levelInfo(points()).level;
  let earnedAny = false;
  // Loop until nothing new is earned (badges give points, which can unlock "Level 5").
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of BADGES) {
      if (!data.badges[b.id] && b.check()) {
        data.badges[b.id] = new Date().toISOString();
        toast(`${b.emoji} Award unlocked: ${b.name}! +${POINTS_PER_BADGE} pts`);
        earnedAny = changed = true;
      }
    }
  }
  const levelAfter = levelInfo(points());
  if (levelAfter.level > levelBefore) toast(`⬆️ Level up! You're now level ${levelAfter.level} · ${levelAfter.name}`);
  if (earnedAny || levelAfter.level > levelBefore) confetti();
  save();
}

// ---------- Task actions ----------

function addTask(text, extra = {}) {
  getDay(todayKey()).tasks.push({ id: newId(), text, done: false, doneAt: null, ...extra });
  save();
}

function findTask(id) {
  return getDay(todayKey()).tasks.find((t) => t.id === id);
}

function toggleTask(id) {
  const t = findTask(id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  save();
  if (t.done) {
    const day = getDay(todayKey());
    if (isPerfect(day)) toast("✨ Every task done today. Amazing!");
    checkBadges();
  }
}

function deleteTask(id) {
  const day = getDay(todayKey());
  day.tasks = day.tasks.filter((t) => t.id !== id);
  save();
}

function renameTask(id, text) {
  const t = findTask(id);
  if (t && text.trim()) { t.text = text.trim(); save(); }
}

// ---------- Unfinished tasks from earlier days ----------

// Collects unfinished tasks from past days that you haven't decided about yet.
function pendingCarryOvers() {
  const today = todayKey();
  const list = [];
  for (const [key, day] of Object.entries(data.days)) {
    if (key >= today || day.reviewed) continue;
    for (const t of day.tasks) if (!t.done && !t.decided) list.push({ key, task: t });
  }
  return list.sort((a, b) => a.key.localeCompare(b.key));
}

function markReviewedIfDone() {
  for (const [key, day] of Object.entries(data.days)) {
    if (key < todayKey() && day.tasks.every((t) => t.done || t.decided)) day.reviewed = true;
  }
  save();
}

function decide(key, taskId, keep) {
  const t = data.days[key].tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.decided = keep ? "kept" : "discarded";
  if (keep) addTask(t.text, { carriedFrom: t.carriedFrom || key });
  markReviewedIfDone();
  renderCarry();
  render();
}

function renderCarry() {
  const items = pendingCarryOvers();
  const modal = document.getElementById("carryModal");
  if (items.length === 0) { modal.hidden = true; return; }

  const ul = document.getElementById("carryList");
  ul.innerHTML = "";
  for (const { key, task } of items) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text"></span>
      <button class="btn small" data-act="discard">Discard</button>
      <button class="btn small primary" data-act="keep">Add to today</button>`;
    li.querySelector(".text").textContent = task.text;
    const from = document.createElement("span");
    from.className = "from";
    from.textContent = "from " + prettyDate(key, { weekday: "short", month: "short", day: "numeric" });
    li.querySelector(".text").appendChild(from);
    li.querySelector('[data-act="keep"]').onclick = () => decide(key, task.id, true);
    li.querySelector('[data-act="discard"]').onclick = () => decide(key, task.id, false);
    ul.appendChild(li);
  }
  modal.hidden = false;
}

document.getElementById("keepAll").onclick = () => {
  for (const { key, task } of pendingCarryOvers()) decide(key, task.id, true);
};
document.getElementById("discardAll").onclick = () => {
  for (const { key, task } of pendingCarryOvers()) decide(key, task.id, false);
};

// ---------- Drawing the screen ----------

function render() {
  const key = todayKey();
  const day = getDay(key);

  // Header
  document.getElementById("weekday").textContent = keyToDate(key).toLocaleDateString(undefined, { weekday: "long" });
  document.getElementById("dateTitle").textContent = prettyDate(key, { month: "long", day: "numeric" });
  document.getElementById("streak").textContent = streak();
  document.getElementById("points").textContent = points();

  // Level bar
  const lv = levelInfo(points());
  document.getElementById("levelName").textContent = `Level ${lv.level} · ${lv.name}`;
  document.getElementById("levelNext").textContent = `${lv.into} / ${lv.need} pts to next level`;
  document.getElementById("levelBar").style.width = (lv.into / lv.need) * 100 + "%";

  // Progress ring
  const done = day.tasks.filter((t) => t.done).length;
  const total = day.tasks.length;
  const pct = total ? (done / total) * 100 : 0;
  document.getElementById("ring").style.strokeDashoffset = 100 - pct;
  document.getElementById("progressText").textContent = `${done} of ${total} done`;
  document.getElementById("progressHint").textContent =
    total === 0 ? "Add your first task for today 👇"
    : done === total ? "All done! Enjoy your day 🎉"
    : `${total - done} to go · +${POINTS_PER_TASK} pts each`;

  renderTasks(day);
  renderBadges();
  renderHistory();
}

function renderTasks(day) {
  const ul = document.getElementById("taskList");
  ul.innerHTML = "";
  if (day.tasks.length === 0) {
    ul.innerHTML = '<li class="empty">Nothing here yet.</li>';
    return;
  }
  // Unfinished tasks first, finished ones at the bottom.
  const sorted = [...day.tasks].sort((a, b) => a.done - b.done);
  for (const t of sorted) {
    const li = document.createElement("li");
    li.className = "card task" + (t.done ? " done" : "");
    li.innerHTML = `
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Mark done" />
      <span class="text" title="Tap to edit"></span>
      ${t.carriedFrom ? `<span class="tag">from ${prettyDate(t.carriedFrom)}</span>` : ""}
      <button class="icon-btn" aria-label="Delete task">✕</button>`;
    li.querySelector(".text").textContent = t.text;
    li.querySelector("input").onchange = () => { toggleTask(t.id); render(); };
    li.querySelector(".icon-btn").onclick = () => { deleteTask(t.id); render(); };
    li.querySelector(".text").onclick = () => startEdit(li, t);
    ul.appendChild(li);
  }
}

function startEdit(li, t) {
  const span = li.querySelector(".text");
  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = t.text;
  span.replaceWith(input);
  input.focus();
  const finish = () => { renameTask(t.id, input.value); render(); };
  input.onblur = finish;
  input.onkeydown = (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") { input.value = t.text; input.blur(); }
  };
}

function renderBadges() {
  const grid = document.getElementById("badgeGrid");
  grid.innerHTML = "";
  let earned = 0;
  for (const b of BADGES) {
    const when = data.badges[b.id];
    if (when) earned++;
    const div = document.createElement("div");
    div.className = "card badge" + (when ? "" : " locked");
    div.innerHTML = `<div class="emoji">${b.emoji}</div><strong></strong><small></small>`;
    div.querySelector("strong").textContent = b.name;
    div.querySelector("small").textContent = when ? `Earned ${new Date(when).toLocaleDateString()}` : b.desc;
    grid.appendChild(div);
  }
  document.getElementById("awardCount").textContent = `${earned} of ${BADGES.length} awards earned · ${totalDone()} tasks completed all-time`;
}

function renderHistory() {
  const ul = document.getElementById("historyList");
  ul.innerHTML = "";
  const keys = Object.keys(data.days).filter((k) => data.days[k].tasks.length).sort().reverse();
  if (keys.length === 0) { ul.innerHTML = '<li class="empty">Your past days will show up here.</li>'; return; }
  for (const k of keys) {
    const tasks = data.days[k].tasks;
    const done = tasks.filter((t) => t.done).length;
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `<span><strong></strong><br><span class="muted"></span></span><span>${isPerfect(data.days[k]) ? "✨" : ""} ${done}/${tasks.length}</span>`;
    li.querySelector("strong").textContent = k === todayKey() ? "Today" : prettyDate(k, { weekday: "short", month: "short", day: "numeric" });
    li.querySelector(".muted").textContent = tasks.map((t) => (t.done ? "✓ " : "○ ") + t.text).join(" · ");
    ul.appendChild(li);
  }
}

// ---------- Little celebrations ----------

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function confetti() {
  const colors = ["#4f46e5", "#f59e0b", "#16a34a", "#ec4899", "#06b6d4"];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.5 + Math.random() * 1.5 + "s";
    c.style.animationDelay = Math.random() * 0.3 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

// ---------- Buttons, tabs, backup ----------

document.getElementById("addForm").onsubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById("newTask");
  const text = input.value.trim();
  if (!text) return;
  addTask(text);
  input.value = "";
  render();
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "tab-" + btn.dataset.tab));
  };
});

document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `daily-todo-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

document.getElementById("importFile").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.days) throw new Error("Not a Daily To-Do backup");
    if (!confirm("Replace the tasks on this device with the backup?")) return;
    data = { badges: {}, ...parsed };
    save();
    startDay();
    toast("✅ Backup restored");
  } catch (err) {
    alert("Sorry, that file couldn't be restored: " + err.message);
  }
  e.target.value = "";
};

// ---------- Start up ----------

let currentDay = todayKey();

function startDay() {
  getDay(todayKey());
  markReviewedIfDone();
  checkBadges();
  render();
  renderCarry();
}

startDay();

// Lets sync.js read the data and swap in the latest copy from the cloud.
window.DailyTodo = {
  getData: () => data,
  replaceData(newData) {
    data = { days: {}, badges: {}, ...newData };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    startDay();
  },
  toast,
};

// If the app stays open past midnight, switch to the new day automatically.
setInterval(() => {
  if (todayKey() !== currentDay) { currentDay = todayKey(); startDay(); }
}, 30 * 1000);

// Also check when you come back to the tab/app.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && todayKey() !== currentDay) { currentDay = todayKey(); startDay(); }
});
