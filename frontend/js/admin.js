const ADMIN_API_BASE = getAdminApiBase();
const LOCAL_USERS_KEY = "farmra_admin_users";
const LOCAL_GATEWAYS_KEY = "farmra_admin_gateways";
const DEFAULT_GATEWAYS = [
  { id: "1001", label: "Gateway 1001" },
  { id: "1002", label: "Gateway 1002" },
  { id: "1003", label: "Gateway 1003" },
];

const state = {
  users: [],
  gateways: [],
  remoteUsersLoaded: false,
  remoteGatewaysLoaded: false,
};

document.addEventListener("DOMContentLoaded", async () => {
  bindUserMenu();
  bindSideActionButtons();
  bindAdminForm();
  hydrateAdminEmail();
  await initializeData();
});

async function loadUserInfo() {
  try {
    const res = await fetch("/farmra-api/me");
    const data = await res.json();

    //Admin Email
    const emailSpan = document.getElementById("userEmail");
    if (emailSpan && data.email) {
      emailSpan.textContent = data.email;
    }

    //Admin Name - Display greeting
    const greetingSpan = document.getElementById("userGreeting");
    if (greetingSpan && data.name) {
      greetingSpan.textContent = `Hi, ${data.name}!`;
    }
  } catch (err) {
    console.error("Failed to load user info:", err);
  }
}

function getAdminApiBase() {
  const apiMeta = document.querySelector('meta[name="farmra-admin-api-base"]');
  return (apiMeta?.content || "/api/admin").replace(/\/+$/, "");
}

async function initializeData() {
  const gatewaysLoaded = await loadGateways();
  const usersLoaded = await loadUsers();

  renderGatewayList();
  renderUsersTable();

  if (!gatewaysLoaded && !usersLoaded) {
    showStatus(
      "Admin API is not reachable. Local mode is active for setup and testing.",
      "warning",
    );
    return;
  }

  if (!gatewaysLoaded) {
    showStatus("Gateway list loaded from local defaults.", "warning");
  }
}

function bindUserMenu() {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

  if (!userMenuBtn || !userDropdown) {
    return;
  }

  userMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.hidden = !userDropdown.hidden;
    userMenuBtn.classList.toggle("active");
  });

  document.addEventListener("click", (event) => {
    if (!userDropdown.hidden && !userDropdown.contains(event.target)) {
      userDropdown.hidden = true;
      userMenuBtn.classList.remove("active");
    }
  });
}

function bindSideActionButtons() {
  const sideButtons = Array.from(
    document.querySelectorAll("#left-panel .side-btn[data-target]"),
  );

  sideButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sideButtons.forEach((button) => button.classList.remove("active"));
      btn.classList.add("active");

      const targetId = btn.dataset.target;
      const targetSection = targetId ? document.getElementById(targetId) : null;
      if (!targetSection) {
        return;
      }

      const topOffset = 92;
      const targetTop =
        targetSection.getBoundingClientRect().top +
        globalThis.scrollY -
        topOffset;
      globalThis.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  });
}

function bindAdminForm() {
  const createUserForm = document.getElementById("createUserForm");
  const createDeviceForm = document.getElementById("createDeviceForm");
  const refreshUsersBtn = document.getElementById("refreshUsersBtn");

  if (createUserForm) {
    createUserForm.addEventListener("submit", handleCreateUser);
  }

  if (createDeviceForm) {
    createDeviceForm.addEventListener("submit", handleCreateDevice);
  }

  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener("click", async () => {
      const gatewaysLoaded = await loadGateways();
      const usersLoaded = await loadUsers();
      renderGatewayList();
      renderUsersTable();

      if (gatewaysLoaded && usersLoaded) {
        showStatus("Admin data refreshed from API.", "success");
        return;
      }

      showStatus(
        "API refresh partially unavailable. Showing local data where needed.",
        "warning",
      );
    });
  }
}

async function handleCreateUser(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const firstName = getInputValue("firstName");
  const lastName = getInputValue("lastName");
  const email = getInputValue("googleEmail");
  const gatewayIds = getCheckedGatewayIds("createGatewayList");

  if (gatewayIds.length === 0) {
    showStatus("Select at least one gateway for initial access.", "error");
    return;
  }

  const payload = {
    firstName,
    lastName,
    email,
    googleEmail: email,
    gateways: gatewayIds,
    gatewayIds,
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);

  try {
    const remoteResult = await createUserRemote(payload);
    state.remoteUsersLoaded = true;

    const normalized = normalizeUser(remoteResult) || {
      id: createLocalId(),
      firstName,
      lastName,
      email,
      gateways: gatewayIds,
    };

    upsertUser(normalized);
    writeLocalUsers(state.users);
    form.reset();
    renderGatewayList();
    renderUsersTable();
    showStatus("User created successfully.", "success");
    return;
  } catch (error) {
    reportRecoverableError(error, "create-user request");
    state.remoteUsersLoaded = false;

    const localUser = {
      id: createLocalId(),
      firstName,
      lastName,
      email,
      gateways: gatewayIds,
    };

    upsertUser(localUser);
    writeLocalUsers(state.users);
    form.reset();
    renderGatewayList();
    renderUsersTable();
    showStatus(
      "Could not reach the admin API. User was saved locally for now.",
      "warning",
    );
  } finally {
    setButtonBusy(submitBtn, false);
  }
}

/*async function handleCreateUser(event) {
  event.preventDefault();

  const firstName = getInputValue("firstName");
  const lastName = getInputValue("lastName");
  const email = getInputValue("googleEmail");

  try {
    await createUserApi({
      firstName,
      lastName,
      email,
      isAdmin: false
    });

    showStatus("User created successfully.", "success");
    event.target.reset();
    loadUsers(); // refresh table
  } catch (err) {
    showStatus(err.message, "error");
  }
}
*/
async function handleCreateDevice(event) {
  event.preventDefault();

  const nodeName = getInputValue("nodeName");
  const gatewayId = getInputValue("gatewayId");
  const userEmail = getInputValue("userEmail");
  const gpsLong = getInputValue("gpsLong");
  const gpsLat = getInputValue("gpsLat");

  try {
    await createDeviceApi({
      nodeName,
      gatewayId,
      userEmail,
      gpsLong,
      gpsLat,
    });

    showStatus("Device created successfully.", "success");
    event.target.reset();
  } catch (err) {
    showStatus(err.message, "error");
  }
}

async function loadUsers() {
  try {
    const payload = await requestJson(`${ADMIN_API_BASE}/users`);
    state.users = normalizeUserCollection(payload);
    writeLocalUsers(state.users);
    state.remoteUsersLoaded = true;
    return true;
  } catch (error) {
    reportRecoverableError(error, "load users");
    state.remoteUsersLoaded = false;
    state.users = readLocalUsers();
    return false;
  }
}

async function loadGateways() {
  try {
    const payload = await requestJson(`${ADMIN_API_BASE}/gateways`);
    const gateways = normalizeGatewayCollection(payload);

    if (gateways.length === 0) {
      throw new Error("No gateways in response");
    }

    state.gateways = gateways;
    writeLocalGateways(gateways);
    state.remoteGatewaysLoaded = true;
    return true;
  } catch (error) {
    reportRecoverableError(error, "load gateways");
    state.remoteGatewaysLoaded = false;
    state.gateways = readLocalGateways();
    return false;
  }
}

async function createUserRemote(payload) {
  return requestJson(`${ADMIN_API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function requestJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  const rawText = await response.text();
  const parsed = rawText ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    const message =
      (parsed &&
        typeof parsed === "object" &&
        (parsed.message || parsed.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parsed;
}

//calls flask to insert new user
async function createUserApi({ firstName, lastName, email, isAdmin }) {
  const res = await fetch("/farmra-api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: email,
      is_admin: isAdmin,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create user");
  return data;
}

//calls flask to insert new device
async function createDeviceApi({
  nodeName,
  gatewayId,
  userEmail,
  gpsLong,
  gpsLat,
}) {
  const res = await fetch("/farmra-api/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_name: nodeName,
      gateway_id: gatewayId,
      user_email: userEmail, // <-- IMPORTANT
      gps_long: gpsLong || null,
      gps_lat: gpsLat || null,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create device");
  return data;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    reportRecoverableError(error, "parse JSON");
    return null;
  }
}

function normalizeUserCollection(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : payload?.users || payload?.items || payload?.data || [];

  return candidates.map((entry) => normalizeUser(entry)).filter(Boolean);
}

function normalizeUser(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id =
    entry.id ??
    entry.userId ??
    entry.user_id ??
    entry.u_id ??
    entry.uid ??
    entry.email;

  if (id == null) {
    return null;
  }

  const nameFromSingleField = String(entry.u_name || entry.name || "").trim();
  let firstName = String(entry.firstName || entry.first_name || "").trim();
  let lastName = String(entry.lastName || entry.last_name || "").trim();

  if (!firstName && nameFromSingleField) {
    const parts = nameFromSingleField.split(/\s+/);
    firstName = parts.shift() || "";
    lastName = parts.join(" ");
  }

  const email = String(
    entry.email ||
      entry.googleEmail ||
      entry.google_email ||
      entry.u_email ||
      "",
  ).trim();

  const rawGateways =
    entry.gateways ||
    entry.gatewayIds ||
    entry.gateway_ids ||
    entry.nodes ||
    [];
  const gateways = Array.isArray(rawGateways)
    ? rawGateways
        .map((gateway) => {
          if (typeof gateway === "string" || typeof gateway === "number") {
            return String(gateway);
          }

          return String(
            gateway?.id ??
              gateway?.gatewayId ??
              gateway?.gateway_id ??
              gateway?.n_id ??
              gateway?.node_id ??
              "",
          ).trim();
        })
        .filter(Boolean)
    : [];

  return {
    id: String(id),
    firstName,
    lastName,
    email,
    gateways,
  };
}

function normalizeGatewayCollection(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : payload?.gateways ||
      payload?.nodes ||
      payload?.items ||
      payload?.data ||
      [];

  return candidates.map((entry) => normalizeGateway(entry)).filter(Boolean);
}

function normalizeGateway(entry) {
  if (typeof entry === "string" || typeof entry === "number") {
    const id = String(entry).trim();
    if (!id) {
      return null;
    }
    return { id, label: `Gateway ${id}` };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawId =
    entry.id ??
    entry.gatewayId ??
    entry.gateway_id ??
    entry.n_id ??
    entry.nodeId ??
    entry.node_id;

  if (rawId == null) {
    return null;
  }

  const id = String(rawId);
  const label =
    String(
      entry.label ||
        entry.name ||
        entry.gatewayName ||
        entry.gateway_name ||
        "",
    ).trim() || `Gateway ${id}`;

  return { id, label };
}

function renderGatewayList() {
  const container = document.getElementById("createGatewayList");
  if (!container) {
    return;
  }

  const gateways =
    state.gateways.length > 0 ? state.gateways : readLocalGateways();
  if (gateways.length === 0) {
    container.innerHTML = '<p class="helper-text">No gateways available.</p>';
    return;
  }

  container.innerHTML = gateways
    .map((gateway, index) => {
      const checkboxId = `create-gateway-${index}`;
      return `
				<label class="gateway-item" for="${checkboxId}">
					<input type="checkbox" id="${checkboxId}" value="${escapeHtml(gateway.id)}" />
					<span>${escapeHtml(gateway.label)}</span>
				</label>
			`;
    })
    .join("");
}

function getCheckedGatewayIds(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked'),
  ).map((checkbox) => checkbox.value);
}

function renderUsersTable() {
  const tableBody = document.getElementById("usersTableBody");
  if (!tableBody) {
    return;
  }

  if (state.users.length === 0) {
    tableBody.innerHTML = `
			<tr class="empty-row">
				<td colspan="2">No users found.</td>
			</tr>
		`;
    return;
  }

  tableBody.innerHTML = state.users
    .map((user) => {
      const fullName = escapeHtml(formatFullName(user));
      const email = escapeHtml(user.email || "-");

      return `
				<tr>
					<td>${fullName}</td>
					<td>${email}</td>
				</tr>
			`;
    })
    .join("");
}

function upsertUser(user) {
  const index = state.users.findIndex((entry) => entry.id === user.id);
  if (index >= 0) {
    state.users[index] = user;
    return;
  }

  state.users.unshift(user);
}

function formatFullName(user) {
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (name) {
    return name;
  }

  return user.email || "Unnamed User";
}

function readLocalUsers() {
  const fallback = [];
  if (!globalThis.localStorage) {
    return fallback;
  }

  try {
    const raw = globalThis.localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    return parsed.map((entry) => normalizeUser(entry)).filter(Boolean);
  } catch (error) {
    reportRecoverableError(error, "read local users");
    return fallback;
  }
}

function writeLocalUsers(users) {
  if (!globalThis.localStorage) {
    return;
  }

  try {
    globalThis.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (error) {
    reportRecoverableError(error, "write local users");
    globalThis.console.warn("Unable to save local user data.");
  }
}

function readLocalGateways() {
  const fallback = DEFAULT_GATEWAYS;
  if (!globalThis.localStorage) {
    return fallback;
  }

  try {
    const raw = globalThis.localStorage.getItem(LOCAL_GATEWAYS_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    const normalized = parsed
      .map((entry) => normalizeGateway(entry))
      .filter(Boolean);

    return normalized.length > 0 ? normalized : fallback;
  } catch (error) {
    reportRecoverableError(error, "read local gateways");
    return fallback;
  }
}

function writeLocalGateways(gateways) {
  if (!globalThis.localStorage) {
    return;
  }

  try {
    globalThis.localStorage.setItem(
      LOCAL_GATEWAYS_KEY,
      JSON.stringify(gateways),
    );
  } catch (error) {
    reportRecoverableError(error, "write local gateways");
    globalThis.console.warn("Unable to save local gateway data.");
  }
}

function getInputValue(inputId) {
  const value = document.getElementById(inputId)?.value || "";
  return value.trim();
}

function setButtonBusy(button, isBusy) {
  if (!button || !(button instanceof HTMLButtonElement)) {
    return;
  }

  if (isBusy) {
    button.dataset.originalText = button.textContent || "";
    button.textContent = "Saving...";
    button.disabled = true;
    return;
  }

  button.textContent =
    button.dataset.originalText || button.textContent || "Save";
  button.disabled = false;
}

function createLocalId() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `${Date.now()}-${random}`;
}

function showStatus(message, type) {
  const statusBox = document.getElementById("adminStatus");
  if (!statusBox) {
    return;
  }

  statusBox.hidden = false;
  statusBox.textContent = message;
  statusBox.classList.remove("info", "success", "warning", "error");
  statusBox.classList.add(type || "info");
}

function hydrateAdminEmail() {
  const emailNode = document.getElementById("adminUserEmail");
  if (!emailNode) {
    return;
  }

  const storedEmail =
    globalThis.localStorage?.getItem("farmra_admin_email") ||
    globalThis.sessionStorage?.getItem("farmra_admin_email");

  if (storedEmail) {
    emailNode.textContent = storedEmail;
  }
}

function reportRecoverableError(error, context) {
  const reason = error instanceof Error ? error.message : String(error);
  globalThis.console.warn(`[Admin] ${context}: ${reason}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
