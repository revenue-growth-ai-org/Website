/* RB2B (free key) loads only after consent.
   If the CookieYes script is on the page, CookieYes is the consent source:
   the pixel is injected only after analytics or advertisement consent.
   Until that script is installed, this file shows the approved banner and
   treats "continuing" (a click or keypress outside the banner) or Allow as consent.
*/
(function () {
  var STORAGE_KEY = "rg-rb2b-consent";
  var OPT_OUT_URL = "https://app.retention.com/optout";
  var RB2B_SNIPPET = '!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://b2bjsstore.s3.us-west-2.amazonaws.com/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("VN080HXDEM6J");';

  var loaded = false;
  var decided = false;
  var pollTimer = 0;
  var root = null;

  function injectRb2b() {
    if (loaded || window.reb2b) return;
    loaded = true;
    stopWatching();
    var script = document.createElement("script");
    script.text = RB2B_SNIPPET;
    document.head.appendChild(script);
  }

  function cookieyesPresent() {
    return !!(
      document.getElementById("cookieyes") ||
      document.querySelector('script[src*="cdn-cookieyes.com"], script[src*="cookieyes.com/client_data"]')
    );
  }

  function readCookie(name) {
    var cookie = "";
    try { cookie = document.cookie; } catch (e) { return ""; }
    var parts = ("; " + cookie).split("; " + name + "=");
    if (parts.length < 2) return "";
    var raw = parts.pop().split(";").shift() || "";
    try { return decodeURIComponent(raw); } catch (e) { return raw; }
  }

  function parseConsent(raw) {
    if (!raw) return null;
    try {
      if (raw.charAt(0) === "{") return JSON.parse(raw);
    } catch (e) {}
    var map = {};
    raw.split(",").forEach(function (pair) {
      var i = pair.indexOf(":");
      if (i === -1) return;
      map[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1).trim().toLowerCase();
    });
    return map;
  }

  function categoryYes(map, name) {
    if (!map) return false;
    var value = map[name];
    return value === "yes" || value === true || value === "true";
  }

  function cookieyesAllows(map) {
    return categoryYes(map, "analytics") || categoryYes(map, "advertisement");
  }

  function detailAllows(detail) {
    if (!detail) return false;
    if (detail.categories && (detail.categories.analytics || detail.categories.advertisement)) return true;
    var accepted = detail.accepted;
    if (!accepted) return false;
    for (var i = 0; i < accepted.length; i++) {
      if (accepted[i] === "analytics" || accepted[i] === "advertisement") return true;
    }
    return false;
  }

  function cookieyesDenied(map) {
    if (!map) return false;
    var action = map.action || map.consent;
    if (action !== "yes" && action !== "no") return false;
    return !cookieyesAllows(map);
  }

  function stopWatching() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function watchCookieyes() {
    function tick() {
      var map = parseConsent(readCookie("cookieyes-consent"));
      if (cookieyesAllows(map)) {
        injectRb2b();
        return;
      }
      if (cookieyesDenied(map)) stopWatching();
    }
    document.addEventListener("cookieyes_banner_load", function (event) {
      if (detailAllows(event.detail)) injectRb2b();
    });
    document.addEventListener("cookieyes_consent_update", function (event) {
      if (detailAllows(event.detail)) injectRb2b();
    });
    tick();
    pollTimer = setInterval(tick, 600);
  }

  function storageGet() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storageSet(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function removeBanner() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  function closestLink(target) {
    if (!target || !target.closest) return null;
    return target.closest("a");
  }

  function linkHref(target) {
    var link = closestLink(target);
    return link ? (link.getAttribute("href") || "") : "";
  }

  function onContinue(event) {
    if (root && root.contains(event.target)) return;
    var href = linkHref(event.target);
    if (href.indexOf("/privacy-policy") !== -1) return;
    if (href.indexOf("app.retention.com/optout") !== -1) {
      deny();
      return;
    }
    grant();
  }

  function unbindContinue() {
    document.removeEventListener("pointerdown", onContinue, true);
    document.removeEventListener("keydown", onContinueKey, true);
  }

  function onContinueKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    onContinue(event);
  }

  function grant() {
    if (decided) return;
    decided = true;
    unbindContinue();
    storageSet("granted");
    removeBanner();
    injectRb2b();
  }

  function deny() {
    if (decided) return;
    decided = true;
    unbindContinue();
    storageSet("denied");
    removeBanner();
  }

  function showBanner() {
    var style = document.createElement("style");
    style.textContent = [
      "#rg-consent{position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#0B1F2E;color:#F7F9FB;font-family:Inter,sans-serif;font-size:14.5px;line-height:1.55;padding:16px 24px;box-shadow:0 -8px 24px rgba(11,31,46,.18);}",
      "#rg-consent p{margin:0;max-width:1100px;}",
      "#rg-consent button.link,#rg-consent a{color:#7FB4EE;background:none;border:0;padding:0;font:inherit;cursor:pointer;text-decoration:underline;}",
      "#rg-consent button.link:focus-visible,#rg-consent a:focus-visible{outline:2px solid #2F7FD1;outline-offset:2px;}",
      "#rg-consent-panel{margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;}",
      "#rg-consent-panel[hidden]{display:none !important;}",
      "#rg-consent-panel .choice{font:inherit;font-weight:600;font-size:14px;border-radius:6px;padding:8px 14px;cursor:pointer;}",
      "#rg-consent-allow{background:#E3A344;color:#0B1F2E;border:1px solid #E3A344;}",
      "#rg-consent-deny{background:transparent;color:#F7F9FB;border:1px solid rgba(247,249,251,.35);}",
      "#rg-consent-panel a{font-size:14px;}"
    ].join("");
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "rg-consent";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Cookie notice");

    var notice = document.createElement("p");
    notice.appendChild(document.createTextNode("We use a visitor identification pixel (RB2B) that may share your IP, browser details, and pages you visit so we can understand company-level website traffic. By continuing, you agree. "));

    var prefs = document.createElement("button");
    prefs.type = "button";
    prefs.className = "link";
    prefs.id = "rg-consent-prefs";
    prefs.setAttribute("aria-expanded", "false");
    prefs.setAttribute("aria-controls", "rg-consent-panel");
    prefs.textContent = "Manage preferences";

    var optout = document.createElement("a");
    optout.id = "rg-consent-optout";
    optout.href = OPT_OUT_URL;
    optout.textContent = "Opt out";

    notice.appendChild(prefs);
    notice.appendChild(document.createTextNode(" · "));
    notice.appendChild(optout);
    root.appendChild(notice);

    var panel = document.createElement("div");
    panel.id = "rg-consent-panel";
    panel.hidden = true;

    var allow = document.createElement("button");
    allow.type = "button";
    allow.className = "choice";
    allow.id = "rg-consent-allow";
    allow.textContent = "Allow";

    var reject = document.createElement("button");
    reject.type = "button";
    reject.className = "choice";
    reject.id = "rg-consent-deny";
    reject.textContent = "Don't allow";

    var policy = document.createElement("a");
    policy.href = "/privacy-policy";
    policy.textContent = "Privacy policy";

    panel.appendChild(allow);
    panel.appendChild(reject);
    panel.appendChild(policy);
    root.appendChild(panel);
    document.body.appendChild(root);

    prefs.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      prefs.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    });
    allow.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      grant();
    });
    reject.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deny();
    });
    optout.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deny();
      window.location.href = OPT_OUT_URL;
    });

    document.addEventListener("pointerdown", onContinue, true);
    document.addEventListener("keydown", onContinueKey, true);
  }

  function start() {
    if (cookieyesPresent()) {
      watchCookieyes();
      return;
    }
    var stored = storageGet();
    if (stored === "granted") {
      injectRb2b();
      return;
    }
    if (stored === "denied") return;
    showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
