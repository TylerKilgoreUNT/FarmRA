const GRAFANA_LOADER_TIMEOUT_MS = 20000;
let grafanaLoaderTimeoutId = null;

document.addEventListener("DOMContentLoaded", function () {
  // User menu functionality
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

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
            console.log("Show account info");
            // Account info view is not implemented on this page.
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

  // Active state for secondary panel buttons
  const sideButtons = Array.from(document.querySelectorAll(".side-btn"));
  const sidebarSection = document.querySelector("#left-panel .sidebar-section");
  const isPortraitMobile = () =>
    globalThis.matchMedia("(orientation: portrait) and (max-width: 767px)")
      .matches;

  const setActiveSideButton = (btn) => {
    sideButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const action = btn.dataset.action;
    console.log("left-panel action:", action);
  };

  if (sideButtons.length > 0) {
    if (!sideButtons.some((b) => b.classList.contains("active"))) {
      setActiveSideButton(sideButtons[0]);
    }

    sideButtons.forEach((btn) => {
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

        setActiveSideButton(btn);
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
    table: "",
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

function getAllPanelSrc({ panelType, sensor, baseSrc, detectedAllUrls, detectedIndex }) {
  const allPanelCollections = {
    gauge: "gauges",
    timeseries: "timeseries",
  };

  const explicitSrc =
    panelType === "table"
      ? GRAFANA_LINKS.all.table
      : GRAFANA_LINKS.all[allPanelCollections[panelType]]?.[sensor] || "";

  const detectedSrc = detectedAllUrls[detectedIndex] || "";
  const fallbackSensor = panelType === "table" ? "all" : sensor;
  const derivedSrc = getAllPanelFallbackSrc(baseSrc, panelType, fallbackSensor);

  return explicitSrc || detectedSrc || derivedSrc;
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

function trackGrafanaIframeLoading(container) {
  if (!container) {
    hideGrafanaLoader();
    return;
  }

  const iframes = Array.from(container.querySelectorAll("iframe"));

  if (grafanaLoaderTimeoutId) {
    globalThis.clearTimeout(grafanaLoaderTimeoutId);
    grafanaLoaderTimeoutId = null;
  }

  if (iframes.length === 0) {
    hideGrafanaLoader();
    return;
  }

  const total = iframes.length;
  let remaining = total;
  let settled = false;

  showGrafanaLoader(
    `Loading ${total} dashboard${total === 1 ? "" : "s"}...`,
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

  const detectedAllUrls = Array.from(
    container.querySelectorAll(".grafanaContainer iframe"),
  )
    .map((iframe) => iframe.src)
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
    });

    const tableSrc = getAllPanelSrc({
      panelType: "table",
      sensor: "all",
      baseSrc,
      detectedAllUrls,
      detectedIndex: 6,
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
            <div class="grafanaContainer grafanaContainer-full">
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

    container.querySelectorAll(".all-timeseries-toggle").forEach((toggleBtn) => {
      toggleBtn.addEventListener("click", () => {
        allTabTimeseriesSensor = normalizeSensor(toggleBtn.dataset.sensor);
        renderSensor("all");
      });
    });
  } else {
    const metricConfig = GRAFANA_LINKS.metrics[sensor] || {};
    const metricBase = setOrAppendQueryParam(baseSrc, "var-sensor", sensor);

    const metricBoxes = METRIC_PANEL_TYPES.map((panelType) => {
      const fallback = setOrAppendQueryParam(metricBase, "var-panel", panelType);
      const src = metricConfig[panelType] || fallback;
      const panelLabel = formatPanelLabel(panelType);

      return `
        <div class="grafanaContainer grafanaContainer-half">
          <iframe src="${src}" width="100%" height="400px" frameborder="0" title="${sensor} ${panelLabel}"></iframe>
        </div>
      `;
    }).join("");

    container.innerHTML = `<div class="grafana-half-row">${metricBoxes}</div>`;
  }

  trackGrafanaIframeLoading(container);

}
