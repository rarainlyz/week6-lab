const AUTH_KEY = "moviehub.auth";

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const membersPanel = document.querySelector("#members-panel");
const memberRows = document.querySelector("#member-rows");
const memberCount = document.querySelector("#member-count");
const memberSearch = document.querySelector("#member-search");
const pageMessage = document.querySelector("#page-message");
const emptyState = document.querySelector("#empty-state");
const signOutButton = document.querySelector("#sign-out");

let auth = readAuth();
let currentMember = null;
let members = [];

function readAuth() {
  const saved = localStorage.getItem(AUTH_KEY);
  if (!saved) return null;

  try {
    const value = JSON.parse(saved);
    return typeof value.token === "string" && value.token ? value : null;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (auth?.token) headers.set("Authorization", `Bearer ${auth.token}`);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || `คำขอไม่สำเร็จ (${response.status})`);
  }
  return body;
}

function showLogin(message = "") {
  loginPanel.hidden = false;
  membersPanel.hidden = true;
  signOutButton.hidden = true;
  loginMessage.textContent = message;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function filteredMembers() {
  const query = memberSearch.value.trim().toLocaleLowerCase("th");
  if (!query) return members;
  return members.filter((member) =>
    `${member.displayName} ${member.email}`.toLocaleLowerCase("th").includes(query),
  );
}

function renderMembers() {
  const admins = members.filter((member) => member.role === "admin").length;
  memberCount.textContent = `ทั้งหมด ${members.length} คน (admin ${admins})`;
  memberRows.replaceChildren();

  const visibleMembers = filteredMembers();
  emptyState.hidden = visibleMembers.length > 0;

  for (const member of visibleMembers) {
    const row = document.createElement("tr");
    const identityCell = document.createElement("td");
    const name = document.createElement("div");
    const email = document.createElement("div");
    const roleCell = document.createElement("td");
    const role = document.createElement("span");
    const dateCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const action = document.createElement("button");

    name.className = "member-name";
    name.textContent = member.displayName;
    email.className = "member-email";
    email.textContent = member.email;
    identityCell.append(name, email);

    role.className = `role-badge${member.role === "admin" ? " admin" : ""}`;
    role.textContent = member.role;
    roleCell.append(role);

    dateCell.textContent = formatDate(member.createdAt);
    actionCell.className = "action-cell";
    action.className = "role-action";
    action.type = "button";
    action.dataset.memberId = String(member.id);
    action.dataset.role = member.role === "admin" ? "member" : "admin";
    action.textContent = member.role === "admin" ? "ลดเป็น member" : "เลื่อนเป็น admin";
    action.disabled = member.id === currentMember?.id;
    actionCell.append(action);

    row.append(identityCell, roleCell, dateCell, actionCell);
    memberRows.append(row);
  }
}

async function loadMembers() {
  if (!auth?.token) {
    showLogin();
    return;
  }

  try {
    currentMember = await request("/api/me");
    if (currentMember.role !== "admin") {
      showLogin("บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าจัดการสมาชิก");
      return;
    }

    const result = await request("/api/admin/members");
    members = result.items;
    loginPanel.hidden = true;
    membersPanel.hidden = false;
    signOutButton.hidden = false;
    pageMessage.textContent = "";
    renderMembers();
  } catch (error) {
    auth = null;
    localStorage.removeItem(AUTH_KEY);
    showLogin(error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  loginMessage.textContent = "";

  try {
    const form = new FormData(loginForm);
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    auth = { token: result.token };
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    loginForm.reset();
    await loadMembers();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

memberSearch.addEventListener("input", renderMembers);

memberRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-member-id]");
  if (!button || button.disabled) return;

  button.disabled = true;
  pageMessage.textContent = "";
  try {
    const member = await request(`/api/admin/members/${button.dataset.memberId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: button.dataset.role }),
    });
    members = members.map((item) => (item.id === member.id ? member : item));
    renderMembers();
  } catch (error) {
    pageMessage.textContent = error.message;
    button.disabled = false;
  }
});

signOutButton.addEventListener("click", () => {
  auth = null;
  currentMember = null;
  members = [];
  localStorage.removeItem(AUTH_KEY);
  showLogin();
});

loadMembers();
