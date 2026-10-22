const AUTH_KEY = "moviehub.auth";

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const adminPanel = document.querySelector("#admin-panel");
const adminNav = document.querySelector("#admin-nav");
const pageMessage = document.querySelector("#page-message");
const signOutButton = document.querySelector("#sign-out");
const pageLinks = [...document.querySelectorAll("[data-page-link]")];
const pages = [...document.querySelectorAll("[data-page]")];

const statCards = document.querySelector("#stat-cards");
const newestMemberRows = document.querySelector("#newest-member-rows");
const newestMembersEmpty = document.querySelector("#newest-members-empty");
const topMovies = document.querySelector("#top-movies");
const topMoviesEmpty = document.querySelector("#top-movies-empty");

const memberRows = document.querySelector("#member-rows");
const memberCount = document.querySelector("#member-count");
const memberSearch = document.querySelector("#member-search");
const memberEmptyState = document.querySelector("#member-empty-state");

const movieRows = document.querySelector("#movie-rows");
const movieCount = document.querySelector("#movie-count");
const movieSearch = document.querySelector("#movie-search");
const movieEmptyState = document.querySelector("#movie-empty-state");
const movieDialog = document.querySelector("#movie-dialog");
const movieForm = document.querySelector("#movie-form");
const movieDialogTitle = document.querySelector("#movie-dialog-title");
const movieFormMessage = document.querySelector("#movie-form-message");
const movieIDField = document.querySelector("#movie-id-field");
const posterPreview = document.querySelector("#poster-preview");
const saveMovieButton = document.querySelector("#save-movie");
const deleteDialog = document.querySelector("#delete-dialog");
const deleteImpact = document.querySelector("#delete-impact");
const deleteMessage = document.querySelector("#delete-message");
const confirmDeleteButton = document.querySelector("#confirm-delete");

let auth = readAuth();
let currentMember = null;
let members = [];
let movies = [];
let genres = null;
let movieBeingDeleted = null;
let movieSearchTimer;

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

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

function setAuth(value) {
  auth = value;
  if (value) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (auth?.token) headers.set("Authorization", "Bearer " + auth.token);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  let body = null;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      throw new RequestError("เซิร์ฟเวอร์ตอบข้อมูลไม่ถูกต้อง", response.status);
    }
  }

  if (!response.ok) {
    throw new RequestError(body?.error?.message || `คำขอไม่สำเร็จ (${response.status})`, response.status);
  }
  return body;
}

function showLogin(message = "") {
  currentMember = null;
  loginPanel.hidden = false;
  adminPanel.hidden = true;
  adminNav.hidden = true;
  signOutButton.hidden = true;
  loginMessage.textContent = message;
}

function showAdmin() {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  adminNav.hidden = false;
  signOutButton.hidden = false;
}

function showPage(pageName) {
  for (const page of pages) page.hidden = page.dataset.page !== pageName;
  for (const link of pageLinks) {
    const active = link.dataset.pageLink === pageName;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  pageMessage.textContent = "";
}

function showPageError(error) {
  if (error.status === 401) {
    setAuth(null);
    showLogin(error.message);
    return;
  }
  pageMessage.textContent = error.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
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

function renderDashboard(stats) {
  const cards = [
    ["หนังทั้งหมด", stats.movies],
    ["สมาชิก", stats.members],
    ["ผู้ดูแล", stats.admins],
    ["คะแนนโหวต", stats.votes],
    ["หนังในรายการอยากดู", stats.wishlistItems],
  ];
  const cardNodes = cards.map(([label, value]) => {
    const card = document.createElement("article");
    const title = document.createElement("div");
    const number = document.createElement("div");
    card.className = "stat-card";
    title.className = "stat-label";
    title.textContent = label;
    number.className = "stat-value";
    number.textContent = Number(value).toLocaleString("th-TH");
    card.append(title, number);
    return card;
  });
  statCards.replaceChildren(...cardNodes);

  const memberNodes = (stats.newestMembers || []).map((member) => {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    const name = document.createElement("div");
    const email = document.createElement("div");
    name.className = "member-name";
    name.textContent = member.displayName;
    email.className = "member-email";
    email.textContent = member.email;
    identity.append(name, email);
    const role = document.createElement("td");
    role.textContent = member.role;
    const joined = document.createElement("td");
    joined.textContent = formatDate(member.createdAt);
    row.append(identity, role, joined);
    return row;
  });
  newestMemberRows.replaceChildren(...memberNodes);
  newestMembersEmpty.hidden = memberNodes.length > 0;

  const movieNodes = (stats.topVoted || []).map((movie) => {
    const item = document.createElement("article");
    const image = document.createElement("img");
    const info = document.createElement("div");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    item.className = "top-movie";
    image.alt = "";
    image.loading = "lazy";
    if (movie.poster) {
      image.src = movie.poster;
    } else {
      image.className = "poster-placeholder";
    }
    info.className = "top-movie-info";
    title.className = "top-movie-title";
    title.textContent = movie.titleTh || movie.title;
    meta.className = "top-movie-meta";
    meta.textContent = `คะแนน ${Number(movie.voteAverage).toFixed(1)} · ${movie.voteCount} โหวต`;
    info.append(title, meta);
    item.append(image, info);
    return item;
  });
  topMovies.replaceChildren(...movieNodes);
  topMoviesEmpty.hidden = movieNodes.length > 0;
}

async function loadDashboard() {
  renderDashboard(await request("/api/admin/stats"));
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
  const visibleMembers = filteredMembers();
  const rows = visibleMembers.map((member) => {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    const name = document.createElement("div");
    const email = document.createElement("div");
    const roleCell = document.createElement("td");
    const role = document.createElement("span");
    const actionCell = document.createElement("td");
    const action = document.createElement("button");

    name.className = "member-name";
    name.textContent = member.displayName;
    email.className = "member-email";
    email.textContent = member.email;
    identity.append(name, email);

    role.className = `role-badge${member.role === "admin" ? " admin" : ""}`;
    role.textContent = member.role;
    roleCell.append(role);
    const joinedCell = document.createElement("td");
    joinedCell.textContent = formatDate(member.createdAt);

    actionCell.className = "action-cell";
    action.className = "role-action";
    action.type = "button";
    action.dataset.memberId = String(member.id);
    action.dataset.role = member.role === "admin" ? "member" : "admin";
    action.textContent = member.role === "admin" ? "ลดเป็น member" : "เลื่อนเป็น admin";
    action.disabled = member.id === currentMember?.id;
    actionCell.append(action);
    row.append(identity, roleCell, joinedCell, actionCell);
    return row;
  });
  memberRows.replaceChildren(...rows);
  memberEmptyState.hidden = rows.length > 0;
}

async function loadMembers() {
  const result = await request("/api/admin/members");
  members = result.items;
  renderMembers();
}

function posterURL(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return "https://image.tmdb.org/t/p/w500" + path;
  return "";
}

function filteredMovies() {
  const query = movieSearch.value.trim().toLocaleLowerCase("th");
  if (!query) return movies;
  return movies.filter((movie) =>
    `${movie.title} ${movie.titleTh || ""}`.toLocaleLowerCase("th").includes(query),
  );
}

function renderMovies() {
  const visibleMovies = filteredMovies();
  movieCount.textContent = `แสดง ${visibleMovies.length} เรื่อง`;
  const rows = visibleMovies.map((movie) => {
    const row = document.createElement("tr");
    const movieCell = document.createElement("td");
    const wrapper = document.createElement("div");
    const image = document.createElement("img");
    const title = document.createElement("div");
    const actions = document.createElement("td");
    const edit = document.createElement("button");
    const remove = document.createElement("button");
    const poster = posterURL(movie.poster);

    wrapper.className = "movie-cell";
    image.className = "movie-poster";
    image.alt = "";
    image.loading = "lazy";
    if (poster) image.src = poster;
    title.className = "movie-title";
    title.textContent = movie.titleTh || movie.title;
    wrapper.append(image, title);
    movieCell.append(wrapper);
    const genreCell = document.createElement("td");
    genreCell.textContent = movie.genre || "-";
    const yearCell = document.createElement("td");
    yearCell.textContent = movie.year || "-";
    const ratingCell = document.createElement("td");
    ratingCell.textContent = Number(movie.rating).toFixed(1);

    actions.className = "action-cell";
    edit.className = "text-action";
    edit.type = "button";
    edit.dataset.movieId = String(movie.id);
    edit.dataset.action = "edit";
    edit.textContent = "แก้ไข";
    remove.className = "text-action danger";
    remove.type = "button";
    remove.dataset.movieId = String(movie.id);
    remove.dataset.action = "delete";
    remove.textContent = "ลบ";
    actions.append(edit, remove);
    row.append(movieCell, genreCell, yearCell, ratingCell, actions);
    return row;
  });
  movieRows.replaceChildren(...rows);
  movieEmptyState.hidden = rows.length > 0;
}

async function loadMovies(query = "") {
  const result = await request(`/api/movies?q=${encodeURIComponent(query)}`);
  movies = result.items;
  renderMovies();
}

async function loadGenres() {
  if (genres) return;
  const result = await request("/api/genres");
  genres = result.items;
  const select = movieForm.elements.namedItem("genreId");
  for (const genre of genres) {
    const option = document.createElement("option");
    option.value = String(genre.id);
    option.textContent = genre.nameTh ? `${genre.nameTh} (${genre.nameEn})` : genre.nameEn;
    select.append(option);
  }
}

function setMovieFormValue(name, value) {
  movieForm.elements.namedItem(name).value = value ?? "";
}

function updatePosterPreview() {
  const url = posterURL(movieForm.elements.namedItem("posterPath").value.trim());
  posterPreview.hidden = !url;
  if (url) posterPreview.src = url;
  else posterPreview.removeAttribute("src");
}

async function openMovieDialog(movieID = null) {
  movieForm.reset();
  movieFormMessage.textContent = "";
  posterPreview.hidden = true;
  await loadGenres();

  if (movieID === null) {
    movieDialogTitle.textContent = "เพิ่มหนัง";
    movieIDField.hidden = false;
    setMovieFormValue("originalLanguage", "en");
  } else {
    const movie = await request(`/api/admin/movies/${movieID}`);
    movieDialogTitle.textContent = `แก้ไขหนัง #${movie.id}`;
    movieIDField.hidden = true;
    setMovieFormValue("id", movie.id);
    setMovieFormValue("title", movie.title);
    setMovieFormValue("titleTh", movie.titleTh);
    setMovieFormValue("originalTitle", movie.originalTitle);
    setMovieFormValue("originalLanguage", movie.originalLanguage);
    setMovieFormValue("genreId", movie.genreId);
    setMovieFormValue("releaseDate", movie.releaseDate);
    setMovieFormValue("posterPath", movie.posterPath);
    setMovieFormValue("overview", movie.overview);
    setMovieFormValue("overviewTh", movie.overviewTh);
    updatePosterPreview();
  }
  movieDialog.showModal();
}

async function loadAdminPage() {
  if (!auth?.token) {
    showLogin();
    return;
  }

  const pageName = location.pathname.split("/").filter(Boolean).at(-1) || "dashboard";
  const page = ["dashboard", "movies", "members"].includes(pageName) ? pageName : "dashboard";
  try {
    currentMember = await request("/api/me");
    if (currentMember.role !== "admin") {
      setAuth(null);
      showLogin("บัญชีนี้ไม่มีสิทธิ์เข้าถึงหลังบ้าน กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล");
      return;
    }

    showAdmin();
    showPage(page);
    if (page === "dashboard") await loadDashboard();
    if (page === "movies") await loadMovies();
    if (page === "members") await loadMembers();
  } catch (error) {
    if (error.status === 401) {
      setAuth(null);
      showLogin(error.message);
    } else {
      showAdmin();
      showPage(page);
      showPageError(error);
    }
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
    setAuth({ token: result.token });
    loginForm.reset();
    await loadAdminPage();
  } catch (error) {
    loginMessage.textContent = error.message || "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    submitButton.disabled = false;
  }
});

memberSearch.addEventListener("input", renderMembers);

memberRows.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
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
    showPageError(error);
    button.disabled = false;
  }
});

document.querySelector("#add-movie").addEventListener("click", async () => {
  try {
    await openMovieDialog();
  } catch (error) {
    showPageError(error);
  }
});

movieRows.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-movie-id]");
  if (!button) return;
  button.disabled = true;

  try {
    if (button.dataset.action === "edit") {
      await openMovieDialog(button.dataset.movieId);
      return;
    }
    const movie = await request(`/api/admin/movies/${button.dataset.movieId}`);
    movieBeingDeleted = movie;
    deleteImpact.textContent =
      `“${movie.titleTh || movie.title}” จะถูกลบ พร้อมรีวิว ${movie.impact.reviews} รายการ, ` +
      `คะแนน ${movie.impact.votes} รายการ และรายการอยากดู ${movie.impact.wishlist} รายการ`;
    deleteMessage.textContent = "";
    deleteDialog.showModal();
  } catch (error) {
    showPageError(error);
  } finally {
    button.disabled = false;
  }
});

movieSearch.addEventListener("input", () => {
  window.clearTimeout(movieSearchTimer);
  movieSearchTimer = window.setTimeout(async () => {
    try {
      await loadMovies(movieSearch.value);
    } catch (error) {
      showPageError(error);
    }
  }, 200);
});

movieForm.elements.namedItem("posterPath").addEventListener("input", updatePosterPreview);

movieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!movieForm.reportValidity()) return;
  saveMovieButton.disabled = true;
  movieFormMessage.textContent = "";

  try {
    const values = new FormData(movieForm);
    const idText = String(values.get("id") || "").trim();
    const id = idText ? Number(idText) : 0;
    if (!Number.isSafeInteger(id) || id < 0) {
      throw new Error("Movie ID ต้องเป็นเลขจำนวนเต็มบวก หรือเว้นว่างไว้");
    }
    const genreText = String(values.get("genreId") || "");
    const body = {
      id,
      title: String(values.get("title") || "").trim(),
      titleTh: String(values.get("titleTh") || "").trim() || null,
      originalTitle: String(values.get("originalTitle") || "").trim(),
      originalLanguage: String(values.get("originalLanguage") || "").trim(),
      overview: String(values.get("overview") || "").trim() || null,
      overviewTh: String(values.get("overviewTh") || "").trim() || null,
      posterPath: String(values.get("posterPath") || "").trim() || null,
      releaseDate: String(values.get("releaseDate") || "") || null,
      genreId: genreText ? Number(genreText) : null,
    };
    const editing = movieIDField.hidden;
    await request(editing ? `/api/admin/movies/${movieForm.elements.namedItem("id").value}` : "/api/admin/movies", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    movieDialog.close();
    await loadMovies(movieSearch.value);
  } catch (error) {
    if (error.status === 401) {
      movieDialog.close();
      showPageError(error);
    } else {
      movieFormMessage.textContent = error.message || "บันทึกหนังไม่สำเร็จ";
    }
  } finally {
    saveMovieButton.disabled = false;
  }
});

document.querySelector("#close-movie-dialog").addEventListener("click", () => movieDialog.close());
document.querySelector("#cancel-movie-dialog").addEventListener("click", () => movieDialog.close());
document.querySelector("#cancel-delete").addEventListener("click", () => deleteDialog.close());

confirmDeleteButton.addEventListener("click", async () => {
  if (!movieBeingDeleted) return;
  confirmDeleteButton.disabled = true;
  deleteMessage.textContent = "";
  try {
    await request(`/api/admin/movies/${movieBeingDeleted.id}`, { method: "DELETE" });
    deleteDialog.close();
    movieBeingDeleted = null;
    await loadMovies(movieSearch.value);
  } catch (error) {
    deleteMessage.textContent = error.message || "ลบหนังไม่สำเร็จ";
    if (error.status === 401) {
      deleteDialog.close();
      showPageError(error);
    }
  } finally {
    confirmDeleteButton.disabled = false;
  }
});

signOutButton.addEventListener("click", () => {
  setAuth(null);
  members = [];
  movies = [];
  showLogin();
});

loadAdminPage();
