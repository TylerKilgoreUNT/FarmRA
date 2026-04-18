(function () {
  function prefersReducedMotion() {
    return globalThis.matchMedia
      ? globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  }

  function isIndexPage() {
    const path = globalThis.location.pathname || "";
    return (
      path === "/" ||
      path.endsWith("/index") ||
      path.endsWith("/index.html") ||
      path.endsWith("index") ||
      path.endsWith("index.html")
    );
  }

  function isMapPage() {
    const path = globalThis.location.pathname || "";
    return path.endsWith("/map") || path.endsWith("/map.html") || path.endsWith("map.html");
  }

  function animateElements(elements, config) {
    const gsapApi = globalThis.gsap;
    if (!gsapApi || !Array.isArray(elements) || elements.length === 0) {
      return;
    }

    gsapApi.fromTo(
      elements,
      {
        opacity: 0,
        y: config.fromY || 18,
        x: config.fromX || 0,
        scale: config.fromScale || 1,
      },
      {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration: config.duration || 0.6,
        ease: config.ease || "power2.out",
        delay: config.delay || 0,
        stagger: config.stagger || 0,
        clearProps: "opacity,transform",
      },
    );
  }

  function animateLoginPage() {
    const body = document.body;
    if (!body?.classList.contains("login-page")) {
      return;
    }

    const loginLogo = document.querySelector(".login-logo");
    const loginCard = document.querySelector(".login-card");
    const loginButton = document.querySelector(".oauth-btn-primary");

    animateElements([loginLogo, loginCard].filter(Boolean), {
      fromY: 26,
      duration: 0.8,
      stagger: 0.12,
      ease: "power3.out",
    });

    animateElements([loginButton].filter(Boolean), {
      fromY: 14,
      delay: 0.35,
      duration: 0.55,
    });
  }

  function animateDashboardButtons() {
    if (!isIndexPage()) {
      return;
    }

    const targetSelectors = [
      "#left-narrow .icon-btn.all",
      "#left-narrow .icon-btn.light",
      "#left-narrow .icon-btn.moisture",
      "#left-narrow .icon-btn.map",
    ];

    const targets = targetSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);

    animateElements(targets, {
      fromX: -18,
      duration: 0.55,
      stagger: 0.08,
      delay: 0.15,
    });
  }

  function animateGreetingWhenReady() {
    const greeting = document.getElementById("userGreeting");
    if (!greeting) {
      return;
    }

    let hasAnimated = false;

    function runGreetingAnimation() {
      if (hasAnimated || !greeting.textContent?.trim()) {
        return false;
      }

      hasAnimated = true;
      animateElements([greeting], {
        fromY: -10,
        duration: 0.55,
        delay: 0.1,
      });
      return true;
    }

    if (runGreetingAnimation()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (runGreetingAnimation()) {
        observer.disconnect();
      }
    });

    observer.observe(greeting, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    globalThis.setTimeout(() => observer.disconnect(), 10000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (prefersReducedMotion()) {
      return;
    }

    if (!globalThis.gsap) {
      console.warn("GSAP was not loaded; skipping HyperFrames-style page animations.");
      return;
    }

    animateLoginPage();

    if (isIndexPage() || isMapPage()) {
      animateGreetingWhenReady();
    }

    animateDashboardButtons();
  });
})();
