const ADMIN_API_BASE = getAdminApiBase();
const LOCAL_USERS_KEY = "farmra_admin_users";

const state = {
  users: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  bindUserMenu();
  bindSideActionButtons();
  bindAdminForm();
  hydrateAdminEmail();
  await initializeData();
});

function getAdminApiBase() {
  const apiMeta = document.querySelector('meta[name="farmra-admin-api-base"]');
  return (apiMeta?.content || "/farmra-api").replace(/\/+$/, "");
}

async function initializeData() {
  const usersLoaded = await loadUsers();

  renderUsersTable();

  if (!usersLoaded) {
    showStatus(
      "Admin API is not reachable. Local mode is active for setup and testing.",
      "warning",
    );
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
    createUserForm.addEventListener("submit", async (event) => {
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

      if (!firstName || !lastName || !email) {
        showStatus("First name, last name, and email are required.", "error");
        return;
      }

      try {
        await createUserApi({ firstName, lastName, email });

        showStatus("User created successfully.", "success");
        form.reset();
        await loadUsers();
        renderUsersTable();
      } catch (error) {
        showStatus(error instanceof Error ? error.message : String(error), "error");
      }
    });
  }

  if (createDeviceForm) {
    createDeviceForm.addEventListener("submit", handleCreateDevice);
  }

  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener("click", async () => {
      const usersLoaded = await loadUsers();
      renderUsersTable();

      if (usersLoaded) {
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

async function handleCreateDevice(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const nodeName = getInputValue("nodeName");
  const gatewayId = getInputValue("gatewayId");
  const userEmail = getInputValue("userEmail");
  const gpsLong = getInputValue("gpsLong");
  const gpsLat = getInputValue("gpsLat");

  if (!nodeName || !gatewayId || !userEmail) {
    showStatus("Node name, gateway ID, and user email are required.", "error");
    return;
  }

  try {
    await createDeviceApi({
      nodeName,
      gatewayId,
      userEmail,
      gpsLong,
      gpsLat,
    });

    showStatus("Device created successfully.", "success");
    form.reset();
  } catch (err) {
    showStatus(err.message, "error");
  }
}

async function loadUsers() {
  try {
    const payload = await requestJson(`${ADMIN_API_BASE}/users`);
    state.users = normalizeUserCollection(payload);
    writeLocalUsers(state.users);
    return true;
  } catch (error) {
    reportRecoverableError(error, "load users");
    state.users = readLocalUsers();
    return false;
  }
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
    const missingFieldsMessage =
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.missing) &&
      parsed.missing.length > 0
        ? `${parsed.error || "Missing required fields"}: ${parsed.missing.join(", ")}`
        : null;

    const message =
      missingFieldsMessage ||
      (parsed &&
        typeof parsed === "object" &&
        (parsed.message || parsed.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parsed;
}

//calls flask to insert new user
async function createUserApi({ firstName, lastName, email }) {
  return requestJson(`${ADMIN_API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email,
      is_admin: false,
      firstName,
      lastName,
      isAdmin: false,
    }),
  });
}

//calls flask to insert new device
async function createDeviceApi({
  nodeName,
  gatewayId,
  userEmail,
  gpsLong,
  gpsLat,
}) {
  return requestJson(`${ADMIN_API_BASE}/devices`, {
    method: "POST",
    body: JSON.stringify({
      node_name: nodeName,
      gateway_id: gatewayId,
      user_email: userEmail,
      gps_long: gpsLong || null,
      gps_lat: gpsLat || null,
      nodeName,
      gatewayId,
      userEmail,
      gpsLong: gpsLong || null,
      gpsLat: gpsLat || null,
    }),
  });
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
  let firstName = String(
    entry.firstName || entry.first_name || entry.u_fName || "",
  ).trim();
  let lastName = String(
    entry.lastName || entry.last_name || entry.u_lName || "",
  ).trim();

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

  return {
    id: String(id),
    firstName,
    lastName,
    email,
  };
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

function getInputValue(inputId) {
  const value = document.getElementById(inputId)?.value || "";
  return value.trim();
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
