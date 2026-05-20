/* ─────────────────────────────────────────────────────────────────────────────
   TASKNET ADMIN CONSOLE - CORE APPLICATION JAVASCRIPT
   ───────────────────────────────────────────────────────────────────────────── */

// API Configuration
const API_BASE = ""; // Relative path works perfectly since FastAPI serves this folder!

// State Manager
const state = {
  activeTab: "dashboard",
  users: [],
  events: [],
  tasks: [],
  appraisals: [],
  summaries: [],
  stats: {},
  editingUserId: null
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Check for Single Sign-On (SSO) authentication query parameter from main app redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("auth") === "success") {
    localStorage.setItem("admin_logged_in", "true");
    
    // Securely cache the returning origin of the personnel app (Flutter portal)
    const returnTo = urlParams.get("return_to");
    if (returnTo) {
      localStorage.setItem("admin_return_url", returnTo);
    }
    
    // Clean up query parameters from the address bar for security and aesthetics
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  checkAuth();
  setupNavigation();
  setupEventListeners();

  // Start real-time auto-updating every 3 seconds in the background
  setInterval(() => {
    if (localStorage.getItem("admin_logged_in") === "true") {
      loadCurrentTab(true);
    }
  }, 3000);
});

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION (SPA ROUTER)
// ─────────────────────────────────────────────────────────────────────────────

function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      
      const target = link.getAttribute("data-target");
      if (!target) return;
      
      // Update links active states
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      // Update viewport content panels
      const panels = document.querySelectorAll(".tab-content");
      panels.forEach(p => p.classList.remove("active"));
      
      const targetPanel = document.getElementById(`view-${target}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
      
      // Update header labels
      state.activeTab = target;
      updateHeaderLabels();
      
      // Load relevant tab data
      loadCurrentTab();
    });
  });
}

function updateHeaderLabels() {
  const titleEl = document.getElementById("view-title");
  const subtitleEl = document.getElementById("view-subtitle");
  
  const headers = {
    dashboard: { title: "Dashboard Overview", sub: "Personnel Appraisal Admin Console" },
    users: { title: "Users Accounts Manager", sub: "Create and manage system user credentials & access roles" },
    events: { title: "Events Planner & Evaluation", sub: "Schedule school events and view rating response indices" },
    tasks: { title: "Special Tasks Assignments", sub: "Assign special tasks to Deans and audit coordinator rubrics" },
    appraisals: { title: "Appraisals & Performance summaries", sub: "Lock historical records & review RPMS Monthly Grade summaries" }
  };
  
  if (headers[state.activeTab]) {
    titleEl.textContent = headers[state.activeTab].title;
    subtitleEl.textContent = headers[state.activeTab].sub;
  }
}

function loadCurrentTab(isSilent = false) {
  switch (state.activeTab) {
    case "dashboard":
      fetchStats();
      break;
    case "users":
      fetchUsers(isSilent);
      break;
    case "events":
      fetchEvents(isSilent);
      break;
    case "tasks":
      fetchTasks(isSilent);
      break;
    case "appraisals":
      fetchAppraisals(isSilent);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CONTROLS SETUP
// ─────────────────────────────────────────────────────────────────────────────

function setupEventListeners() {
  // Global Reload Button
  const btnRefresh = document.getElementById("btn-refresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      btnRefresh.style.pointerEvents = "none";
      loadCurrentTab();
      showToast("Database records synced");
      setTimeout(() => btnRefresh.style.pointerEvents = "auto", 800);
    });
  }

  // Global Logout Button
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }

  // Users Filter Inputs
  const userSearch = document.getElementById("user-search-input");
  const userRole = document.getElementById("user-role-filter");
  if (userSearch) userSearch.addEventListener("input", filterUsers);
  if (userRole) userRole.addEventListener("change", filterUsers);

  // Events Search Input
  const eventSearch = document.getElementById("event-search-input");
  if (eventSearch) eventSearch.addEventListener("input", filterEvents);

  // Tasks Search Input
  const taskSearch = document.getElementById("task-search-input");
  if (taskSearch) taskSearch.addEventListener("input", filterTasks);

  // Trigger Modal Openers
  const btnAddUser = document.getElementById("btn-add-user");
  if (btnAddUser) {
    btnAddUser.addEventListener("click", () => {
      state.editingUserId = null;
      document.getElementById("modal-user-title").textContent = "Add New User Account";
      document.getElementById("form-user").reset();
      document.getElementById("form-user-id").value = "";
      openModal("modal-user");
    });
  }

  const btnAddEvent = document.getElementById("btn-add-event");
  if (btnAddEvent) {
    btnAddEvent.addEventListener("click", () => {
      document.getElementById("form-event").reset();
      // Set date placeholder to today
      const today = new Date().toISOString().split('T')[0];
      document.getElementById("form-event-date").value = today;
      openModal("modal-event");
    });
  }

  const btnAddTask = document.getElementById("btn-add-task");
  if (btnAddTask) {
    btnAddTask.addEventListener("click", () => {
      document.getElementById("form-task").reset();
      const today = new Date().toISOString().split('T')[0];
      document.getElementById("form-task-due").value = today;
      openModal("modal-task");
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNCHRONOUS API QUERIES
// ─────────────────────────────────────────────────────────────────────────────

// 1. Dashboard View
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    if (!res.ok) throw new Error("Stats lookup failed");
    
    const data = await res.json();
    state.stats = data;
    
    // Update KPI metrics counters
    document.getElementById("stat-total-users").textContent = data.total_users;
    document.getElementById("stat-total-tasks").textContent = data.total_tasks;
    document.getElementById("stat-total-events").textContent = data.total_events;
    document.getElementById("stat-flagged-appraisals").textContent = data.flagged_appraisals;
    
    document.getElementById("stat-pending-tasks").textContent = `${data.pending_tasks} pending`;
    document.getElementById("stat-awaiting-events").textContent = `${data.awaiting_events} awaiting rating`;
    document.getElementById("stat-locked-appraisals").textContent = `${data.locked_appraisals} locked (${data.archived_appraisals} archived)`;
    document.getElementById("stat-server-time").textContent = data.server_time;
    
    // Render custom statistics chart
    renderStatsChart(data);
  } catch (err) {
    console.error(err);
    showToast("Error updating dashboard statistics", "error");
  }
}

// 2. Users View
async function fetchUsers(isSilent = false) {
  const tbody = document.getElementById("users-table-body");
  if (!isSilent) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-state">Loading users registry...</td></tr>`;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`);
    if (!res.ok) throw new Error("Users fetch failed");
    
    state.users = await res.json();
    filterUsers(); // Re-apply the current search and role filters!
  } catch (err) {
    if (!isSilent) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-state" style="color: var(--color-coral);">Failed to read users database.</td></tr>`;
    }
    console.error(err);
  }
}

// 3. Events View
async function fetchEvents(isSilent = false) {
  const tbody = document.getElementById("events-table-body");
  if (!isSilent) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-state">Loading school events index...</td></tr>`;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/events`);
    if (!res.ok) throw new Error("Events fetch failed");
    
    state.events = await res.json();
    filterEvents();
  } catch (err) {
    if (!isSilent) {
      tbody.innerHTML = `<tr><td colspan="8" class="loading-state" style="color: var(--color-coral);">Failed to read events.</td></tr>`;
    }
    console.error(err);
  }
}

// 4. Special Tasks View
async function fetchTasks(isSilent = false) {
  const tbody = document.getElementById("tasks-table-body");
  if (!isSilent) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-state">Loading assigned special tasks...</td></tr>`;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/tasks`);
    if (!res.ok) throw new Error("Tasks fetch failed");
    
    state.tasks = await res.json();
    filterTasks();
  } catch (err) {
    if (!isSilent) {
      tbody.innerHTML = `<tr><td colspan="9" class="loading-state" style="color: var(--color-coral);">Failed to read tasks database.</td></tr>`;
    }
    console.error(err);
  }
}

// 5. Appraisals View
async function fetchAppraisals(isSilent = false) {
  const appTbody = document.getElementById("appraisals-table-body");
  const sumTbody = document.getElementById("summaries-table-body");
  
  if (!isSilent) {
    appTbody.innerHTML = `<tr><td colspan="10" class="loading-state">Loading appraisal log...</td></tr>`;
    sumTbody.innerHTML = `<tr><td colspan="10" class="loading-state">Loading monthly evaluations...</td></tr>`;
  }
  
  try {
    // Parallel fetches
    const [appRes, sumRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/appraisals`),
      fetch(`${API_BASE}/api/admin/summaries`)
    ]);
    
    if (!appRes.ok || !sumRes.ok) throw new Error("Appraisals loading failed");
    
    state.appraisals = await appRes.json();
    state.summaries = await sumRes.json();
    
    renderAppraisalsTable(state.appraisals);
    renderSummariesTable(state.summaries);
  } catch (err) {
    if (!isSilent) {
      appTbody.innerHTML = `<tr><td colspan="10" class="loading-state" style="color: var(--color-coral);">Failed to fetch appraisal data.</td></tr>`;
      sumTbody.innerHTML = `<tr><td colspan="10" class="loading-state" style="color: var(--color-coral);">Failed to fetch summaries.</td></tr>`;
    }
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE RENDERS & FILTER CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body");
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-state">No users matching search filters found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = users.map(user => {
    let roleBadge = "badge-blue";
    if (user.role === "Dean") roleBadge = "badge-purple";
    else if (user.role === "Student") roleBadge = "badge-mint";
    else if (user.role === "Coordinator") roleBadge = "badge-cyan";
    else if (user.role === "Admin" || user.role === "Principal") roleBadge = "badge-coral";
    
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">USR-${user.id}</td>
        <td style="font-weight: 500; color: var(--text-main);">${user.name}</td>
        <td><span class="badge ${roleBadge}">${user.role}</span></td>
        <td>${user.department || '<span style="color: var(--text-muted);">None</span>'}</td>
        <td class="actions-col">
          <div class="btn-action-group">
            <button class="btn-table-action edit" onclick="editUser(${user.id}, '${escapeQuote(user.name)}', '${user.role}', '${escapeQuote(user.department || '')}')" title="Edit user">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="btn-table-action delete" onclick="deleteUser(${user.id})" title="Delete account">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterUsers() {
  const searchVal = document.getElementById("user-search-input").value.trim().toLowerCase();
  const roleVal = document.getElementById("user-role-filter").value;
  
  const filtered = state.users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchVal) || 
                          (user.department && user.department.toLowerCase().includes(searchVal));
    const matchesRole = roleVal === "" || user.role === roleVal;
    
    return matchesSearch && matchesRole;
  });
  
  renderUsersTable(filtered);
}

function renderEventsTable(events) {
  const tbody = document.getElementById("events-table-body");
  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-state">No scheduled school events found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = events.map(evt => {
    let statusClass = "status-pending";
    let statusText = "Awaiting Ratings";
    
    if (evt.status === "rated") {
      statusClass = "status-active";
      statusText = "Fully Rated";
    } else if (evt.status === "flagged") {
      statusClass = "status-flagged";
      statusText = "Low Performance";
    }
    
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">${evt.id}</td>
        <td style="font-weight: 500; color: var(--text-main);">${evt.name}</td>
        <td>${evt.organizer}</td>
        <td><span class="badge badge-blue">${evt.department}</span></td>
        <td>${evt.date}</td>
        <td>${evt.attendees} attendees</td>
        <td><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td class="actions-col">
          <button class="btn-table-action delete" onclick="deleteEvent('${evt.id}')" title="Cancel event">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function filterEvents() {
  const searchVal = document.getElementById("event-search-input").value.trim().toLowerCase();
  
  const filtered = state.events.filter(evt => {
    return evt.name.toLowerCase().includes(searchVal) || 
           evt.organizer.toLowerCase().includes(searchVal) || 
           evt.id.toLowerCase().includes(searchVal);
  });
  
  renderEventsTable(filtered);
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById("tasks-table-body");
  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-state">No assigned special tasks found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = tasks.map(task => {
    let statusClass = "status-pending";
    let statusText = "Assigned";
    
    if (task.status === "evaluated") {
      statusClass = "status-active";
      statusText = "Evaluated";
    } else if (task.status === "flagged") {
      statusClass = "status-flagged";
      statusText = "Flagged Deficient";
    } else if (task.status === "notSubmitted") {
      statusClass = "status-flagged";
      statusText = "Overdue / Pending";
    }
    
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">${task.id}</td>
        <td style="font-weight: 500; color: var(--text-main);">${task.task}</td>
        <td>${task.personnel}</td>
        <td><span class="badge badge-purple">${task.department}</span></td>
        <td>${task.assigned_by}</td>
        <td>${task.due_date}</td>
        <td><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td style="font-weight: 700; color: ${task.score !== null ? 'var(--color-mint)' : 'var(--text-muted)'}">
          ${task.score !== null ? `${task.score} / 100` : '—'}
        </td>
        <td class="actions-col">
          <button class="btn-table-action delete" onclick="deleteTask('${task.id}')" title="Delete Task">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function filterTasks() {
  const searchVal = document.getElementById("task-search-input").value.trim().toLowerCase();
  
  const filtered = state.tasks.filter(task => {
    return task.task.toLowerCase().includes(searchVal) || 
           task.personnel.toLowerCase().includes(searchVal) || 
           task.id.toLowerCase().includes(searchVal);
  });
  
  renderTasksTable(filtered);
}

function renderAppraisalsTable(appraisals) {
  const tbody = document.getElementById("appraisals-table-body");
  if (appraisals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading-state">No appraisal records found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = appraisals.map(rec => {
    let statusClass = "status-active";
    if (rec.appraisal_status === "Flagged") statusClass = "status-flagged";
    else if (rec.appraisal_status === "Pending") statusClass = "status-pending";
    
    // Generate Gold star strings
    const fullStars = Math.floor(rec.star_rating);
    const halfStar = rec.star_rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    const starsHtml = `
      <div class="star-container" title="Rating: ${rec.star_rating} / 5.0">
        ${'<span>★</span>'.repeat(fullStars)}
        ${halfStar ? '<span style="font-size: 15px; opacity:0.8;">½</span>' : ''}
        ${'<span style="color: var(--text-muted);">☆</span>'.repeat(emptyStars)}
      </div>
    `;
    
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">APP-${rec.appraisal_id}</td>
        <td style="font-family: monospace;">USR-${rec.personnel_id || '—'}</td>
        <td><span class="badge ${rec.appraisal_type === 'Event' ? 'badge-blue' : rec.appraisal_type === 'Report' ? 'badge-mint' : 'badge-purple'}">${rec.appraisal_type}</span></td>
        <td style="font-family: monospace;">REF-${rec.reference_id}</td>
        <td style="font-weight: 700; color: var(--text-main);">${rec.total_points.toFixed(2)}</td>
        <td>${starsHtml}</td>
        <td><span class="badge-status ${statusClass}">${rec.appraisal_status}</span></td>
        <td>
          <span class="badge ${rec.is_locked ? 'badge-coral' : 'badge-blue'}" style="font-size: 10px;">
            ${rec.is_locked ? 'Locked' : 'Open'}
          </span>
        </td>
        <td>
          <span class="badge ${rec.is_archived ? 'badge-gold' : 'badge-mint'}" style="font-size: 10px;">
            ${rec.is_archived ? 'Archived' : 'Active'}
          </span>
        </td>
        <td class="actions-col" style="width: 140px;">
          <div class="btn-action-group">
            <button class="btn-table-action ${rec.is_locked ? 'active' : ''}" onclick="toggleLock(${rec.appraisal_id})" title="Toggle Record Lock">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
            <button class="btn-table-action ${rec.is_archived ? 'active' : ''}" onclick="toggleArchive(${rec.appraisal_id})" title="Toggle Historical Archive">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderSummariesTable(summaries) {
  const tbody = document.getElementById("summaries-table-body");
  if (summaries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading-state">No monthly performance summaries generated yet.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = summaries.map(sum => {
    let gradeBadge = "badge-blue";
    if (sum.overall_grade === "Outstanding") gradeBadge = "badge-mint";
    else if (sum.overall_grade === "Very Satisfactory") gradeBadge = "badge-cyan";
    else if (sum.overall_grade === "Satisfactory") gradeBadge = "badge-gold";
    else if (sum.overall_grade === "Unsatisfactory") gradeBadge = "badge-coral";
    
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">SUM-${sum.summary_id}</td>
        <td style="font-family: monospace;">USR-${sum.personnel_id || '—'}</td>
        <td style="font-weight: 700; color: var(--text-main);">${sum.period}</td>
        <td style="font-weight: 600;">${sum.total_appraisal_points.toFixed(2)}</td>
        <td>${sum.avg_event_score !== null ? sum.avg_event_score.toFixed(2) : '<span style="color: var(--text-muted);">—</span>'}</td>
        <td>${sum.avg_task_score !== null ? sum.avg_task_score.toFixed(2) : '<span style="color: var(--text-muted);">—</span>'}</td>
        <td>${sum.report_timing_points} pts</td>
        <td style="color: ${sum.escalation_count > 0 ? 'var(--color-coral)' : 'var(--text-sub)'}">${sum.escalation_count} failures</td>
        <td><span class="badge ${gradeBadge}">${sum.overall_grade || 'No Score'}</span></td>
        <td style="font-size: 11px; color: var(--text-sub);">${sum.summary_date}</td>
      </tr>
    `;
  }).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CONTROLLERS & FORM ACTION HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

// 1. User Form Submission
async function handleUserSubmit(e) {
  e.preventDefault();
  
  const idVal = document.getElementById("form-user-id").value;
  const name = document.getElementById("form-user-name").value.trim();
  const role = document.getElementById("form-user-role").value;
  let department = document.getElementById("form-user-dept").value.trim();
  
  if (department === "" || department.toLowerCase() === "null") {
    department = null;
  }
  
  const payload = { name, role, department };
  const isEditing = idVal !== "";
  
  const url = isEditing ? `${API_BASE}/api/admin/users/${idVal}` : `${API_BASE}/api/admin/users`;
  const method = isEditing ? "PUT" : "POST";
  
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Account operation failed");
    }
    
    closeModal("modal-user");
    fetchUsers();
    showToast(isEditing ? "Account updated successfully" : "User created successfully!");
  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  }
}

// 2. Event Form Submission
async function handleEventSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById("form-event-id").value.trim();
  const name = document.getElementById("form-event-name").value.trim();
  const date = document.getElementById("form-event-date").value;
  const organizer = document.getElementById("form-event-organizer").value.trim();
  const department = document.getElementById("form-event-dept").value.trim();
  const attendees = parseInt(document.getElementById("form-event-attendees").value) || 0;
  
  const payload = { id, name, date, organizer, department, attendees };
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Failed scheduling event");
    }
    
    closeModal("modal-event");
    fetchEvents();
    showToast("School Event scheduled successfully!");
  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  }
}

// 3. Task Form Submission
async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById("form-task-id").value.trim() || null;
  const task = document.getElementById("form-task-name").value.trim();
  const personnel = document.getElementById("form-task-personnel").value.trim();
  const department = document.getElementById("form-task-dept").value.trim();
  const assigned_by = document.getElementById("form-task-assigned-by").value.trim();
  const due_date = document.getElementById("form-task-due").value;
  
  const payload = { id, task, personnel, department, assigned_by, due_date };
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Failed to assign task");
    }
    
    closeModal("modal-task");
    fetchTasks();
    showToast("Special Task assigned successfully!");
  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD & ROW EVENT ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function editUser(id, name, role, department) {
  state.editingUserId = id;
  document.getElementById("modal-user-title").textContent = "Edit User Details";
  document.getElementById("form-user-id").value = id;
  document.getElementById("form-user-name").value = name;
  document.getElementById("form-user-role").value = role;
  document.getElementById("form-user-dept").value = department === "null" ? "" : department;
  
  openModal("modal-user");
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to permanently delete this user account?")) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    
    fetchUsers();
    showToast("User account deleted successfully");
  } catch (err) {
    console.error(err);
    showToast("Could not delete user", "error");
  }
}

async function deleteEvent(id) {
  if (!confirm(`Are you sure you want to cancel event ${id}? This clears event evaluations.`)) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/events/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    
    fetchEvents();
    showToast("Event cancelled and evaluations cleared");
  } catch (err) {
    console.error(err);
    showToast("Could not delete event", "error");
  }
}

async function deleteTask(id) {
  if (!confirm(`Are you sure you want to remove special task ${id}?`)) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    
    fetchTasks();
    showToast("Special task removed");
  } catch (err) {
    console.error(err);
    showToast("Could not delete task", "error");
  }
}

async function toggleLock(appraisalId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/appraisals/${appraisalId}/lock`, { method: "PATCH" });
    if (!res.ok) throw new Error("Lock action failed");
    
    const data = await res.json();
    fetchAppraisals();
    showToast(data.is_locked ? "Record locked successfully" : "Record unlocked successfully");
  } catch (err) {
    console.error(err);
    showToast("Error updating lock state", "error");
  }
}

async function toggleArchive(appraisalId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/appraisals/${appraisalId}/archive`, { method: "PATCH" });
    if (!res.ok) throw new Error("Archive action failed");
    
    const data = await res.json();
    fetchAppraisals();
    showToast(data.is_archived ? "Record archived historically" : "Record moved back to active logs");
  } catch (err) {
    console.error(err);
    showToast("Error updating archive state", "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFIER (GLIDE ALERTS)
// ─────────────────────────────────────────────────────────────────────────────

function showToast(message, type = "success") {
  const toast = document.getElementById("toast-notification");
  const msgEl = document.getElementById("toast-message");
  const iconEl = document.getElementById("toast-icon");
  
  msgEl.textContent = message;
  
  if (type === "success") {
    toast.style.borderColor = "var(--color-mint)";
    toast.style.boxShadow = "0 10px 30px rgba(0, 245, 160, 0.15)";
    iconEl.textContent = "✓";
    iconEl.style.background = "var(--grad-mint)";
  } else {
    toast.style.borderColor = "var(--color-coral)";
    toast.style.boxShadow = "0 10px 30px rgba(255, 75, 43, 0.15)";
    iconEl.textContent = "✕";
    iconEl.style.background = "var(--grad-coral)";
  }
  
  toast.classList.add("active");
  
  // Clear any existing timeout
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC SVG CHART GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function renderStatsChart(stats) {
  const svg = document.getElementById("dashboard-svg-chart");
  svg.innerHTML = ""; // Clear existing drawings
  
  const values = [
    { label: "Active Users", val: stats.total_users || 0, color1: "#3B82F6", color2: "#1D4ED8" },
    { label: "Special Tasks", val: stats.total_tasks || 0, color1: "#8B5CF6", color2: "#7C3AED" },
    { label: "Events Registry", val: stats.total_events || 0, color1: "#EC4899", color2: "#DB2777" },
    { label: "All Appraisals", val: stats.total_appraisals || 0, color1: "#6366F1", color2: "#4F46E5" }
  ];
  
  // Find maximum value to normalize bar heights
  const max = Math.max(...values.map(v => v.val), 5); // Default min max of 5
  
  // Create Gradients in SVGdefs
  let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  values.forEach((v, index) => {
    let grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", `grad-${index}`);
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "100%");
    grad.setAttribute("x2", "0%");
    grad.setAttribute("y2", "0%");
    
    let stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", v.color1);
    stop1.setAttribute("stop-opacity", "0.2");
    
    let stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", v.color2);
    stop2.setAttribute("stop-opacity", "1");
    
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  });
  svg.appendChild(defs);
  
  // Draw bars
  const width = 60;
  const gap = 40;
  const startX = 35;
  const startY = 160;
  
  values.forEach((v, i) => {
    const barHeight = (v.val / max) * 120;
    const x = startX + i * (width + gap);
    const y = startY - barHeight;
    
    // Glowing backing line
    let glow = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    glow.setAttribute("x", x);
    glow.setAttribute("y", y);
    glow.setAttribute("width", width);
    glow.setAttribute("height", barHeight);
    glow.setAttribute("rx", 6);
    glow.setAttribute("fill", v.color1);
    glow.setAttribute("opacity", "0.05");
    glow.setAttribute("filter", "blur(4px)");
    svg.appendChild(glow);
    
    // Main Bar
    let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "chart-bar");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", barHeight);
    rect.setAttribute("rx", 6);
    rect.setAttribute("fill", `url(#grad-${i})`);
    rect.setAttribute("stroke", v.color1);
    rect.setAttribute("stroke-width", "1");
    rect.setAttribute("style", "transition: all 0.5s ease-out;");
    svg.appendChild(rect);
    
    // Numeric value label
    let textVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textVal.setAttribute("x", x + width / 2);
    textVal.setAttribute("y", y - 10);
    textVal.setAttribute("text-anchor", "middle");
    textVal.setAttribute("fill", "var(--text-main)");
    textVal.setAttribute("font-size", "12px");
    textVal.setAttribute("font-family", "var(--font-heading)");
    textVal.setAttribute("font-weight", "700");
    textVal.textContent = v.val;
    svg.appendChild(textVal);
    
    // Axis labels
    let textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textLabel.setAttribute("x", x + width / 2);
    textLabel.setAttribute("y", startY + 22);
    textLabel.setAttribute("text-anchor", "middle");
    textLabel.setAttribute("fill", "var(--text-sub)");
    textLabel.setAttribute("font-size", "10px");
    textLabel.setAttribute("font-weight", "500");
    textLabel.textContent = v.label;
    svg.appendChild(textLabel);
  });
  
  // Baseline grid
  let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "15");
  line.setAttribute("y1", startY);
  line.setAttribute("x2", "385");
  line.setAttribute("y2", startY);
  line.setAttribute("stroke", "var(--border-card)");
  line.setAttribute("stroke-width", "1");
  svg.appendChild(line);
}

// Helper: Escape quote characters to avoid HTML breaks
function escapeQuote(str) {
  if (!str) return "";
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMINISTRATOR AUTHENTICATION CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

function checkAuth() {
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");
  
  if (localStorage.getItem("admin_logged_in") === "true") {
    if (loginScreen) loginScreen.style.display = "none";
    if (appContainer) {
      appContainer.style.display = "flex";
      appContainer.style.opacity = "1";
    }
    loadCurrentTab();
  } else {
    // Instead of showing the local admin sign-in form (Image 2), redirect back to the personnel app login page (Image 1)
    const returnUrl = localStorage.getItem("admin_return_url");
    const targetUrl = returnUrl || "http://localhost:54842/";
    
    // Hide containers immediately to avoid any visual flash of the admin sign-in page
    if (loginScreen) loginScreen.style.display = "none";
    if (appContainer) appContainer.style.display = "none";
    
    window.location.href = targetUrl;
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  
  const usernameInput = document.getElementById("login-username").value.trim();
  const passwordInput = document.getElementById("login-password").value;
  const errorMsgEl = document.getElementById("login-error-msg");
  
  errorMsgEl.textContent = "";
  
  if (usernameInput === "admin" && passwordInput === "password") {
    localStorage.setItem("admin_logged_in", "true");
    
    // Animate login transition
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("app-container");
    
    if (loginScreen) {
      loginScreen.style.opacity = "0";
      loginScreen.style.transform = "scale(0.98)";
    }
    
    setTimeout(() => {
      if (loginScreen) loginScreen.style.display = "none";
      if (appContainer) {
        appContainer.style.display = "flex";
        appContainer.style.opacity = "1";
      }
      
      // Load current active tab
      loadCurrentTab();
      showToast("Signed in as Administrator");
    }, 400);
  } else {
    errorMsgEl.textContent = "Invalid username or password";
    
    // Add visual shake animation to login card for premium UX feel
    const loginCard = document.querySelector(".login-card");
    if (loginCard) {
      loginCard.style.animation = "none";
      void loginCard.offsetWidth; // Trigger reflow to restart animation
      loginCard.style.animation = "shake 0.4s ease";
    }
  }
}

function logout() {
  openModal("modal-logout-confirm");
}

function executeLogout() {
  closeModal("modal-logout-confirm");
  
  // Capture return URL to redirect back to the personnel app login page (e.g. port 54842)
  const returnUrl = localStorage.getItem("admin_return_url");
  
  localStorage.removeItem("admin_logged_in");
  // Keep admin_return_url in localStorage so that subsequent direct visits redirect back to the active personnel portal
  
  // Clear the session details
  const appContainer = document.getElementById("app-container");
  
  if (appContainer) appContainer.style.opacity = "0";
  setTimeout(() => {
    if (appContainer) appContainer.style.display = "none";
    if (returnUrl) {
      window.location.href = returnUrl;
    } else {
      // Fallback redirect to default personnel portal address
      window.location.href = "http://localhost:54842/";
    }
  }, 400);
}
