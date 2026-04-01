const GRAFANA_LOADER_TIMEOUT_MS = 20000;
let grafanaLoaderTimeoutId = null;
const INLINE_GRAFANA_LOADER_TIMEOUT_MS = 20000;
let inlineGrafanaLoaderTimeoutId = null;
const NODE_STORAGE_KEY = "farmra_selected_node";
const NODE_KEYS = new Set(["node1", "node2"]);
const NODE_NUMBERS = {
  node1: "1",
  node2: "2",
};
let NODE_LABELS = {
  node1: "Node 1",
  node2: "Node 2",
};
const NODE_GRAFANA_LINK_CACHE = new Map();
let activeNode = "node1";
let nodesData = [];

function splitUserName(fullName) {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) {
    return { firstName: "Unavailable", lastName: "Unavailable" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Unavailable" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function fetchJsonOrThrow(url, errorPrefix) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${errorPrefix}: ${res.status}`);
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", function () {
  const overlay = document.getElementById("overlay");
  const accountInfoModal = document.getElementById("accountInfoModal");
  const accountInfoCloseBtn = document.getElementById("accountInfoCloseBtn");
  const accountFirstName = document.getElementById("accountFirstName");
  const accountLastName = document.getElementById("accountLastName");
  const accountEmail = document.getElementById("accountEmail");
  const accountNodesList = document.getElementById("accountNodesList");

  function renderAccountInfoLoading() {
    if (accountFirstName) accountFirstName.textContent = "Loading...";
    if (accountLastName) accountLastName.textContent = "Loading...";
    if (accountEmail) accountEmail.textContent = "Loading...";
    if (accountNodesList) {
      accountNodesList.innerHTML = "<li>Loading...</li>";
    }
  }

  function renderAccountInfoFallback() {
    if (accountFirstName) accountFirstName.textContent = "Unavailable";
    if (accountLastName) accountLastName.textContent = "Unavailable";
    if (accountEmail) accountEmail.textContent = "Unavailable";
    if (accountNodesList) {
      accountNodesList.innerHTML = "<li>Unable to load assigned nodes</li>";
    }
  }

  function renderAccountInfoData(meData, nodes) {
    const parsedName = splitUserName(meData.name);
    const firstName = String(meData.first_name || parsedName.firstName);
    const lastName = String(meData.last_name || parsedName.lastName);
    const safeEmail = String(meData.email || "Unavailable");
    const nodeNames = Array.isArray(nodes)
      ? nodes
          .map((node) => String(node?.node_name || "").trim())
          .filter(Boolean)
      : [];

    if (accountFirstName) accountFirstName.textContent = firstName;
    if (accountLastName) accountLastName.textContent = lastName;
    if (accountEmail) accountEmail.textContent = safeEmail;

    if (!accountNodesList) {
      return;
    }

    if (nodeNames.length === 0) {
      accountNodesList.innerHTML = "<li>No nodes assigned</li>";
      return;
    }

    accountNodesList.innerHTML = nodeNames.map((name) => `<li>${name}</li>`).join("");
  }

  function setAccountModalOpen(isOpen) {
    if (!accountInfoModal) {
      return;
    }

    if (typeof accountInfoModal.showModal === "function") {
      if (overlay) {
        overlay.hidden = true;
      }

      if (isOpen && !accountInfoModal.open) {
        accountInfoModal.showModal();
      }
      if (!isOpen && accountInfoModal.open) {
        accountInfoModal.close();
      }
      accountInfoModal.hidden = !isOpen;
    } else {
      if (overlay) {
        overlay.hidden = !isOpen;
      }
      accountInfoModal.hidden = !isOpen;
    }

    document.body.classList.toggle("modal-open", isOpen);
  }

  async function openAccountInfoModal() {
    renderAccountInfoLoading();
    setAccountModalOpen(true);

    try {
      const [meData, nodes] = await Promise.all([
        fetchJsonOrThrow("/farmra-api/me", "Failed to fetch account details"),
        fetchJsonOrThrow("/farmra-api/nodes", "Failed to fetch node details"),
      ]);

      renderAccountInfoData(meData, nodes);
    } catch (error) {
      console.error("Failed to load account info:", error);
      renderAccountInfoFallback();
    }
  }

  function closeAccountInfoModal() {
    setAccountModalOpen(false);
  }

  function setNodeButtonsLabel(label) {
    document
      .querySelectorAll("#left-panel .side-btn[data-node]")
      .forEach((btn) => {
        btn.textContent = label;
      });
  }

  //Added for displaying email
  async function loadUserInfo() {
    try {
      const res = await fetch("/farmra-api/me");
      const data = await res.json();

      //Users Email
      const emailSpan = document.getElementById("userEmail");
      if (emailSpan && data.email) {
        emailSpan.textContent = data.email;
      }

      globalThis.currentUserEmail = data.email;

      //Users Name - Display greeting
      const greetingSpan = document.getElementById("userGreeting");
      if (greetingSpan && data.name) {
        greetingSpan.textContent = `Hi, ${data.name}!`;
      }
    } catch (err) {
      console.error("Failed to load user info:", err);
    }
  }

  async function loadNodes() {
    // Keep placeholders visible while data is being requested.
    setNodeButtonsLabel("Loading nodes...");

    try {
      const res = await fetch("/farmra-api/nodes");
      if (!res.ok) {
        throw new Error(`Failed to fetch nodes: ${res.status}`);
      }
      nodesData = await res.json();

      if (!Array.isArray(nodesData) || nodesData.length === 0) {
        console.warn("No nodes loaded from API");
        setNodeButtonsLabel("No nodes assigned");
        return;
      }

      nodesData.forEach((node, index) => {
        const nodeKey = `node${index + 1}`;
        if (NODE_KEYS.has(nodeKey)) {
          NODE_LABELS[nodeKey] = node.node_name || `Node ${index + 1}`;
          NODE_NUMBERS[nodeKey] = String(node.node_id);
        }
      });

      updateNodeButtonLabels();
    } catch (err) {
      console.error("Failed to load nodes:", err);
      setNodeButtonsLabel("Unable to load nodes");
    }
  }

  function updateNodeButtonLabels() {
    const nodeButtons = Array.from(
      document.querySelectorAll("#left-panel .side-btn[data-node]"),
    );

    nodeButtons.forEach((btn, index) => {
      const nodeKey = btn.dataset.node;
      const label = NODE_LABELS[nodeKey] || `Node ${index + 1}`;
      btn.textContent = label;
    });
  }

  loadUserInfo();
  loadNodes();

  // User menu functionality
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

  if (accountInfoCloseBtn) {
    accountInfoCloseBtn.addEventListener("click", closeAccountInfoModal);
  }

  if (overlay) {
    overlay.addEventListener("click", closeAccountInfoModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && accountInfoModal && !accountInfoModal.hidden) {
      closeAccountInfoModal();
    }
  });

  if (userMenuBtn && userDropdown) {
    // Toggle menu on button click
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.hidden = !userDropdown.hidden;
      userMenuBtn.classList.toggle("active");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!userDropdown.hidden && !userDropdown.contains(e.target)) {
        userDropdown.hidden = true;
        userMenuBtn.classList.remove("active");
      }
    });

    // Handle menu item clicks
    userDropdown.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const action = e.currentTarget.textContent.trim().toLowerCase();

        switch (action) {
          case "account info":
            e.preventDefault();
            openAccountInfoModal();
            break;
          case "change password":
            e.preventDefault();
            console.log("Show password change");
            // Password change view is not implemented on this page.
            break;
          case "log out":
            e.preventDefault();
            globalThis.location.href =
              "/oidc/callback?logout=https://farmra.net/login.html";
            return;
        }

        // Close menu after action
        userDropdown.hidden = true;
        userMenuBtn.classList.remove("active");
      });
    });
  }

  activeNode = readStoredNode();

  // Active state for sensor node buttons
  const nodeButtons = Array.from(
    document.querySelectorAll("#left-panel .side-btn[data-node]"),
  );
  const sidebarSection = document.querySelector("#left-panel .sidebar-section");
  const isPortraitMobile = () =>
    globalThis.matchMedia("(orientation: portrait) and (max-width: 767px)")
      .matches;

  const setActiveNodeButton = (btn, { rerender = true } = {}) => {
    nodeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    activeNode = normalizeNodeKey(btn.dataset.node);
    persistActiveNode(activeNode);

    if (!rerender) {
      return;
    }

    const activeIconAction =
      document.querySelector("#left-narrow button.icon-btn.active")?.dataset
        .action || "all";
    renderSensor(activeIconAction);
  };

  if (nodeButtons.length > 0) {
    const initialNodeButton =
      nodeButtons.find(
        (btn) => normalizeNodeKey(btn.dataset.node) === activeNode,
      ) || nodeButtons[0];

    setActiveNodeButton(initialNodeButton, { rerender: false });

    nodeButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        if (isPortraitMobile() && sidebarSection) {
          const isActive = btn.classList.contains("active");
          const isOpen = sidebarSection.classList.contains("open");

          if (isActive && !isOpen) {
            sidebarSection.classList.add("open");
            return;
          }

          if (isActive && isOpen) {
            sidebarSection.classList.remove("open");
            return;
          }
        }

        setActiveNodeButton(btn);
        if (sidebarSection) sidebarSection.classList.remove("open");
      });
    });

    document.addEventListener("click", (e) => {
      if (!isPortraitMobile() || !sidebarSection) return;
      if (
        sidebarSection.classList.contains("open") &&
        !sidebarSection.contains(e.target)
      ) {
        sidebarSection.classList.remove("open");
      }
    });

    globalThis.addEventListener("resize", () => {
      if (!isPortraitMobile() && sidebarSection) {
        sidebarSection.classList.remove("open");
      }
    });
  }

  // Active state for icon column buttons (toggle highlight)
  // Bind only to the left-narrow buttons (buttons are used for sensor toggles)
  document.querySelectorAll("#left-narrow button.icon-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll("#left-narrow .icon-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const action = btn.dataset.action;
      console.log("icon action:", action);
      // render the selected sensor/dashboard
      renderSensor(action);
    });
  });

  // Determine which icon should be active on load based on the current page
  let desiredAction = "all";
  const path = globalThis.location.pathname || "";
  if (path.endsWith("/map.html") || path.endsWith("map.html")) {
    desiredAction = "map";
  }

  // Clear any previous active state and set the desired one (works for buttons and anchors)
  document
    .querySelectorAll("#left-narrow .icon-btn")
    .forEach((b) => b.classList.remove("active"));
  const sel = document.querySelector(
    `#left-narrow .icon-btn[data-action="${desiredAction}"]`,
  );
  if (sel) sel.classList.add("active");

  // Initial render: attempt to render the corresponding sensor view (noop if no grafana-flex)
  renderSensor(desiredAction === "map" ? "all" : desiredAction);
});

/*
 * Configure Grafana iframe links here.
 *
 * - `all`: three gauges (light/moisture/temperature), three timeseries,
 *   and one table.
 * - `metrics`: each metric has four panel links: gauge, timeseries, heatmap, table.
 */
const METRIC_PANEL_TYPES = ["gauge", "timeseries", "heatmap", "table"];
const SENSOR_TYPES = ["light", "moisture", "temperature"];
let allTabTimeseriesSensor = "light";

const GRAFANA_LINKS = {
  all: {
    gauges: {
      light:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
      moisture:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
      temperature:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-3&__feature.dashboardSceneSolo=true",
    },
    timeseries: {
      light:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-2&__feature.dashboardSceneSolo=true",
      moisture:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-2&__feature.dashboardSceneSolo=true",
      temperature:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
    },
    table:
      "https://farmra.net:3000/d-solo/advlmcb/all-data?orgId=1&from=1773273600000&to=1773359100000&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
  },
  metrics: {
    light: {
      gauge:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
      timeseries:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-2&__feature.dashboardSceneSolo=true",
      heatmap:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-3&__feature.dashboardSceneSolo=true",
      table:
        "https://farmra.net:3000/d-solo/ad476cq/light-dashboard?orgId=1&timezone=browser&panelId=panel-4&__feature.dashboardSceneSolo=true",
    },
    moisture: {
      gauge:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
      timeseries:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-2&__feature.dashboardSceneSolo=true",
      heatmap:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-3&__feature.dashboardSceneSolo=true",
      table:
        "https://farmra.net:3000/d-solo/adjdbpc/new-dashboard?orgId=1&timezone=browser&panelId=panel-4&__feature.dashboardSceneSolo=true",
    },
    temperature: {
      gauge:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-3&__feature.dashboardSceneSolo=true",
      timeseries:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-1&__feature.dashboardSceneSolo=true",
      heatmap:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-2&__feature.dashboardSceneSolo=true",
      table:
        "https://farmra.net:3000/d-solo/adrltsq/temperature-graphs?orgId=1&from=1762300800000&to=1762385400000&timezone=browser&panelId=panel-4&__feature.dashboardSceneSolo=true",
    },
  },
};

// Add explicit Node 2 Grafana links here if they differ from the inferred URLs.
const NODE_GRAFANA_LINK_OVERRIDES = {
  node2: {},
};

function setOrAppendQueryParam(url, key, value) {
  if (!url) return "";

  const hashIndex = url.indexOf("#");
  const hasHash = hashIndex >= 0;
  const hash = hasHash ? url.slice(hashIndex) : "";
  const withoutHash = hasHash ? url.slice(0, hashIndex) : url;

  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const queryString = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";

  const params = new URLSearchParams(queryString);
  params.set(key, value);

  const serialized = params.toString();
  const withQuery = serialized ? `${path}?${serialized}` : path;
  return `${withQuery}${hash}`;
}

function normalizeNodeKey(nodeKey) {
  return NODE_KEYS.has(nodeKey) ? nodeKey : "node1";
}

function readStoredNode() {
  if (!globalThis.localStorage) {
    return "node1";
  }

  try {
    const stored = globalThis.localStorage.getItem(NODE_STORAGE_KEY);
    return normalizeNodeKey(stored || "node1");
  } catch (error) {
    console.warn("Unable to read stored node:", error);
    return "node1";
  }
}

function persistActiveNode(nodeKey) {
  if (!globalThis.localStorage) {
    return;
  }

  try {
    globalThis.localStorage.setItem(
      NODE_STORAGE_KEY,
      normalizeNodeKey(nodeKey),
    );
  } catch (error) {
    console.warn("Unable to persist selected node:", error);
  }
}

function getNodeNumber(nodeKey) {
  return NODE_NUMBERS[normalizeNodeKey(nodeKey)] || "1";
}

function getNodeLabel(nodeKey) {
  return NODE_LABELS[normalizeNodeKey(nodeKey)] || "Node 1";
}

function applyNodeContextToUrl(url, nodeKey) {
  if (!url) {
    return "";
  }

  const nodeNumber = getNodeNumber(nodeKey);
  let nextUrl = url;

  nextUrl = nextUrl.replaceAll(/(node[-_ ])([12])/gi, `$1${nodeNumber}`);
  nextUrl = nextUrl.replaceAll(/(node%20)([12])/gi, `$1${nodeNumber}`);
  nextUrl = setOrAppendQueryParam(nextUrl, "var-node", nodeNumber);
  nextUrl = setOrAppendQueryParam(nextUrl, "var-node_id", nodeNumber);
  nextUrl = setOrAppendQueryParam(nextUrl, "var-nodeid", nodeNumber);

  //Added by Brenden :)
  if (globalThis.currentUserEmail) {
    nextUrl = setOrAppendQueryParam(
      nextUrl,
      "var-email",
      globalThis.currentUserEmail,
    );
  }

  return nextUrl;
}

function mapGrafanaUrls(value, mapper) {
  if (typeof value === "string") {
    return mapper(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => mapGrafanaUrls(entry, mapper));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = mapGrafanaUrls(entry, mapper);
      return acc;
    }, {});
  }

  return value;
}

function mergeGrafanaLinks(base, override) {
  if (!override || typeof override !== "object") {
    return base;
  }

  const merged = Array.isArray(base) ? [...base] : { ...base };

  Object.entries(override).forEach(([key, value]) => {
    const baseValue = merged[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = mergeGrafanaLinks(baseValue, value);
      return;
    }

    merged[key] = value;
  });

  return merged;
}

function getGrafanaLinksForNode(nodeKey) {
  const normalizedNode = normalizeNodeKey(nodeKey);

  if (NODE_GRAFANA_LINK_CACHE.has(normalizedNode)) {
    return NODE_GRAFANA_LINK_CACHE.get(normalizedNode);
  }

  const inferredLinks =
    normalizedNode === "node1"
      ? GRAFANA_LINKS
      : mapGrafanaUrls(GRAFANA_LINKS, (url) =>
          applyNodeContextToUrl(url, normalizedNode),
        );

  const mergedLinks = mergeGrafanaLinks(
    inferredLinks,
    NODE_GRAFANA_LINK_OVERRIDES[normalizedNode] || {},
  );

  NODE_GRAFANA_LINK_CACHE.set(normalizedNode, mergedLinks);
  return mergedLinks;
}

function formatPanelLabel(panelType) {
  if (panelType === "timeseries") return "Time Series";
  return panelType.charAt(0).toUpperCase() + panelType.slice(1);
}

function normalizeSensor(sensor) {
  return SENSOR_TYPES.includes(sensor) ? sensor : "light";
}

function getAllPanelFallbackSrc(baseSrc, panelType, sensor) {
  const withSensor = setOrAppendQueryParam(baseSrc, "var-sensor", sensor);
  return setOrAppendQueryParam(withSensor, "var-panel", panelType);
}

function getAllPanelSrc({
  panelType,
  sensor,
  baseSrc,
  detectedAllUrls,
  detectedIndex,
  nodeLinks,
}) {
  const allPanelCollections = {
    gauge: "gauges",
    timeseries: "timeseries",
  };

  const explicitSrc =
    panelType === "table"
      ? nodeLinks.all.table
      : nodeLinks.all[allPanelCollections[panelType]]?.[sensor] || "";

  const detectedSrc = detectedAllUrls[detectedIndex] || "";
  const fallbackSensor = panelType === "table" ? "all" : sensor;
  const derivedSrc = getAllPanelFallbackSrc(baseSrc, panelType, fallbackSensor);

  return applyNodeContextToUrl(
    explicitSrc || detectedSrc || derivedSrc,
    activeNode,
  );
}

function showGrafanaLoader(message = "Loading dashboards...") {
  const loader = document.getElementById("grafanaMainLoader");
  const loaderText = document.getElementById("grafanaMainLoaderText");

  if (!loader) {
    return;
  }

  loader.classList.remove("is-hidden");
  loader.setAttribute("aria-busy", "true");

  if (loaderText) {
    loaderText.textContent = message;
  }
}

function hideGrafanaLoader() {
  const loader = document.getElementById("grafanaMainLoader");
  if (!loader) {
    return;
  }

  loader.classList.add("is-hidden");
  loader.setAttribute("aria-busy", "false");
}

function trackGrafanaIframeListLoading(iframes, message) {
  if (grafanaLoaderTimeoutId) {
    globalThis.clearTimeout(grafanaLoaderTimeoutId);
    grafanaLoaderTimeoutId = null;
  }

  if (!Array.isArray(iframes) || iframes.length === 0) {
    hideGrafanaLoader();
    return;
  }

  const total = iframes.length;
  let remaining = total;
  let settled = false;

  showGrafanaLoader(
    message ||
      `Loading ${total} dashboard${total === 1 ? "" : "s"} for ${NODE_LABELS[activeNode] || getNodeLabel(activeNode)}...`,
  );

  const handleLoaded = () => {
    remaining -= 1;
    if (remaining <= 0 && !settled) {
      settled = true;
      if (grafanaLoaderTimeoutId) {
        globalThis.clearTimeout(grafanaLoaderTimeoutId);
        grafanaLoaderTimeoutId = null;
      }
      hideGrafanaLoader();
    }
  };

  iframes.forEach((iframe) => {
    iframe.addEventListener("load", handleLoaded, { once: true });
  });

  grafanaLoaderTimeoutId = globalThis.setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    hideGrafanaLoader();
  }, GRAFANA_LOADER_TIMEOUT_MS);
}

function trackGrafanaIframeLoading(container) {
  if (!container) {
    hideGrafanaLoader();
    return;
  }

  const iframes = Array.from(container.querySelectorAll("iframe"));

  trackGrafanaIframeListLoading(iframes);
}

function showInlineTimeseriesLoader(container, message) {
  if (!container) {
    return;
  }

  const loader = container.querySelector(".grafana-inline-loader");
  if (!loader) {
    return;
  }

  const loaderText = loader.querySelector(".grafana-inline-loader-text");
  loader.classList.remove("is-hidden");
  loader.setAttribute("aria-busy", "true");

  if (loaderText) {
    loaderText.textContent = message;
  }
}

function hideInlineTimeseriesLoader(container) {
  if (!container) {
    return;
  }

  const loader = container.querySelector(".grafana-inline-loader");
  if (!loader) {
    return;
  }

  loader.classList.add("is-hidden");
  loader.setAttribute("aria-busy", "false");
}

function trackInlineTimeseriesLoading({ iframe, container, message }) {
  if (!iframe || !container) {
    return;
  }

  if (inlineGrafanaLoaderTimeoutId) {
    globalThis.clearTimeout(inlineGrafanaLoaderTimeoutId);
    inlineGrafanaLoaderTimeoutId = null;
  }

  showInlineTimeseriesLoader(container, message);

  let settled = false;

  const handleLoaded = () => {
    if (settled) {
      return;
    }

    settled = true;
    if (inlineGrafanaLoaderTimeoutId) {
      globalThis.clearTimeout(inlineGrafanaLoaderTimeoutId);
      inlineGrafanaLoaderTimeoutId = null;
    }
    hideInlineTimeseriesLoader(container);
  };

  iframe.addEventListener("load", handleLoaded, { once: true });

  inlineGrafanaLoaderTimeoutId = globalThis.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    hideInlineTimeseriesLoader(container);
  }, INLINE_GRAFANA_LOADER_TIMEOUT_MS);
}

function updateAllTabTimeseriesSection({
  container,
  sensor,
  nodeLinks,
  baseSrc,
  detectedAllUrls,
}) {
  if (!container) {
    return;
  }

  const normalizedSensor = normalizeSensor(sensor);
  const timeseriesIndex = 3 + SENSOR_TYPES.indexOf(normalizedSensor);
  const timeseriesSrc = getAllPanelSrc({
    panelType: "timeseries",
    sensor: normalizedSensor,
    baseSrc,
    detectedAllUrls,
    detectedIndex: timeseriesIndex,
    nodeLinks,
  });

  const timeseriesContainer = container.querySelector(
    ".grafana-all-timeseries .grafanaContainer-full",
  );
  const timeseriesFrame = timeseriesContainer?.querySelector("iframe");

  if (!timeseriesFrame) {
    return;
  }

  container.querySelectorAll(".all-timeseries-toggle").forEach((toggleBtn) => {
    toggleBtn.classList.toggle(
      "active",
      normalizeSensor(toggleBtn.dataset.sensor) === normalizedSensor,
    );
  });

  const sensorLabel =
    normalizedSensor.charAt(0).toUpperCase() + normalizedSensor.slice(1);
  trackInlineTimeseriesLoading({
    iframe: timeseriesFrame,
    container: timeseriesContainer,
    message: `Loading ${sensorLabel} time series for ${NODE_LABELS[activeNode] || getNodeLabel(activeNode)}...`,
  });

  timeseriesFrame.title = `${normalizedSensor} Time Series`;
  timeseriesFrame.src = timeseriesSrc;
}

/*
 * Dynamic renderer for grafana content.
 * - 'all' shows all configured boxes
 * - 'light' | 'moisture' | 'temperature' show four panels
 */
function renderSensor(sensor) {
  const container = document.querySelector(".grafana-flex");
  if (!container) {
    hideGrafanaLoader();
    return;
  }

  const nodeLinks = getGrafanaLinksForNode(activeNode);

  const detectedAllUrls = Array.from(
    container.querySelectorAll(".grafanaContainer iframe"),
  )
    .map((iframe) => applyNodeContextToUrl(iframe.src, activeNode))
    .filter(Boolean);

  const fallbackAllUrls = detectedAllUrls;
  const baseSrc = fallbackAllUrls[0] || "";

  if (sensor === "all" || !sensor) {
    allTabTimeseriesSensor = normalizeSensor(allTabTimeseriesSensor);

    const gaugePanels = SENSOR_TYPES.map((sensorType, index) => {
      const src = getAllPanelSrc({
        panelType: "gauge",
        sensor: sensorType,
        baseSrc,
        detectedAllUrls,
        detectedIndex: index,
        nodeLinks,
      });
      const label = `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Gauge`;

      return `
        <div class="grafanaContainer grafanaContainer-half">
          <iframe src="${src}" width="100%" height="320px" frameborder="0" title="${label}"></iframe>
        </div>
      `;
    }).join("");

    const timeseriesSensor = allTabTimeseriesSensor;
    const timeseriesIndex = 3 + SENSOR_TYPES.indexOf(timeseriesSensor);
    const timeseriesSrc = getAllPanelSrc({
      panelType: "timeseries",
      sensor: timeseriesSensor,
      baseSrc,
      detectedAllUrls,
      detectedIndex: timeseriesIndex,
      nodeLinks,
    });

    const tableSrc = getAllPanelSrc({
      panelType: "table",
      sensor: "all",
      baseSrc,
      detectedAllUrls,
      detectedIndex: 6,
      nodeLinks,
    });

    const timeseriesToggles = SENSOR_TYPES.map((sensorType) => {
      const isActive = sensorType === timeseriesSensor;
      const label = sensorType.charAt(0).toUpperCase() + sensorType.slice(1);
      return `<button class="all-timeseries-toggle side-btn${isActive ? " active" : ""}" data-sensor="${sensorType}" type="button">${label}</button>`;
    }).join("");

    container.innerHTML = `
      <div class="grafana-all-layout">
        <div class="grafana-all-row grafana-all-gauges">${gaugePanels}</div>
        <div class="grafana-all-row grafana-all-timeseries">
          <div class="grafana-all-timeseries-content">
            <div class="grafana-all-timeseries-controls">${timeseriesToggles}</div>
            <div class="grafanaContainer grafanaContainer-full grafana-timeseries-container">
              <output class="grafana-inline-loader is-hidden" aria-live="polite" aria-atomic="true" aria-busy="false">
                <div class="grafana-main-loader-inner grafana-inline-loader-inner">
                  <img src="./assets/FarmRA_Loading.gif" alt="Time series loading" class="grafana-main-loader-logo grafana-inline-loader-logo" />
                  <p class="grafana-main-loader-text grafana-inline-loader-text">Loading time series...</p>
                </div>
              </output>
              <iframe src="${timeseriesSrc}" width="100%" height="400px" frameborder="0" title="${timeseriesSensor} Time Series"></iframe>
            </div>
          </div>
        </div>
        <div class="grafana-all-row grafana-all-table">
          <div class="grafanaContainer grafanaContainer-full">
            <iframe src="${tableSrc}" width="100%" height="400px" frameborder="0" title="All Sensors Table"></iframe>
          </div>
        </div>
      </div>
    `;

    trackGrafanaIframeLoading(container);

    container
      .querySelectorAll(".all-timeseries-toggle")
      .forEach((toggleBtn) => {
        toggleBtn.addEventListener("click", () => {
          const nextSensor = normalizeSensor(toggleBtn.dataset.sensor);
          if (nextSensor === allTabTimeseriesSensor) {
            return;
          }

          allTabTimeseriesSensor = nextSensor;
          updateAllTabTimeseriesSection({
            container,
            sensor: nextSensor,
            nodeLinks,
            baseSrc,
            detectedAllUrls,
          });
        });
      });
  } else {
    const metricConfig = nodeLinks.metrics[sensor] || {};
    const metricBase = applyNodeContextToUrl(
      setOrAppendQueryParam(baseSrc, "var-sensor", sensor),
      activeNode,
    );

    const metricBoxes = METRIC_PANEL_TYPES.map((panelType) => {
      const fallback = setOrAppendQueryParam(
        metricBase,
        "var-panel",
        panelType,
      );
      const src = applyNodeContextToUrl(
        metricConfig[panelType] || fallback,
        activeNode,
      );
      const panelLabel = formatPanelLabel(panelType);

      return `
        <div class="grafanaContainer grafanaContainer-half">
          <iframe src="${src}" width="100%" height="400px" frameborder="0" title="${sensor} ${panelLabel}"></iframe>
        </div>
      `;
    }).join("");

    container.innerHTML = `<div class="grafana-half-row">${metricBoxes}</div>`;

    trackGrafanaIframeLoading(container);
  }
}
