(function () {
  try {
    var docMc = null;
    var docPresent = typeof document !== "undefined" && document;
    if (docPresent) docMc = document.modelContext;
    var mc = docMc != null
      ? docMc
      : (typeof navigator !== "undefined" && navigator ? navigator.modelContext : null);
    if (!mc || typeof mc.registerTool !== "function") return;

    var BOOKING_URL = "https://www.revenue-growth.ai/#book-a-working-session";
    var SITE = "https://www.revenue-growth.ai";
    var OFFER_URL = "https://www.revenue-growth.ai/insights/fractional-ai-gtm-embed/";
    var PROOF = "AskNicely — lifted forecasted win rate 18% and doubled qualified pipeline in the same quarter.";

    var INSIGHT_COPY = {
      "/insights/": {
        title: "Insights",
        summary: "Notes on the six-month AI GTM / RevOps embed — cleanup, process, then agents. Platform included when it fits."
      },
      "/insights/gtm-engineer-vs-agency-vs-full-time/": {
        title: "GTM engineer vs agency vs full-time hire: who ships what",
        summary: "What ships first, who owns it after, where agents run, and who sends — full-time hire, agency, DIY build, or an embed."
      },
      "/insights/cuban-custom-revops-embed/": {
        title: "Cuban Is Right About Custom. Wrong About Who Does It for RevOps.",
        summary: "Mark Cuban is right that utilization wins; for RevOps the fix isn’t another GTM wrapper. It’s an embed that cleans data, fixes process, then puts agents in your stack."
      },
      "/insights/fractional-ai-gtm-embed/": {
        title: "Fractional AI GTM engineer: 6-month embed",
        summary: "Who a fractional AI GTM / RevOps embed is for, and what six months of data cleanup, process, then agents buys. Platform included when it fits."
      },
      "/insights/per-task-automation-billing/": {
        title: "Per-task automation billing doesn’t scale",
        summary: "Why Make, Zapier, and n8n Cloud bills track CRM event volume — and why the path out is a six-month embed (data → processes → agents), with capacity-based runtime included when it fits."
      },
      "/insights/grok-bot-for-business/": {
        title: "Grok Bot for business, OpenClaw for enterprise, and Hermes for business",
        summary: "Personal teammate agents vs coverage of the book via a six-month embed — data → processes → agents."
      }
    };

    function register(tool) {
      try {
        var pending = mc.registerTool(tool);
        if (pending && typeof pending.then === "function") {
          pending.then(function () {}, function () {});
        }
      } catch (e) {}
    }

    function copyForPath(path) {
      if (INSIGHT_COPY[path]) return INSIGHT_COPY[path];
      var slug = path.replace(/^\/insights\/?/, "").replace(/\/+$/, "");
      if (!slug) return { title: "Insights", summary: "Insights page." };
      var title = slug.split("-").filter(Boolean).map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(" ");
      return { title: title || "Insights", summary: "Insights page." };
    }

    function normalizeInsightUrl(loc) {
      try {
        var u = new URL(String(loc).trim(), SITE);
        var path = u.pathname || "/";
        if (path.charAt(0) !== "/") path = "/" + path;
        var insight = path === "/insights" || path.indexOf("/insights/") === 0;
        if (!insight) return "";
        if (path.charAt(path.length - 1) !== "/") path += "/";
        return SITE + path;
      } catch (e) {
        return "";
      }
    }

    function insightsFromSitemap(xml, input) {
      var query = "";
      if (input && typeof input.query === "string") query = input.query.trim().toLowerCase();
      var seen = {};
      var insights = [];
      var re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      var match;
      while ((match = re.exec(String(xml || "")))) {
        var url = normalizeInsightUrl(match[1]);
        if (!url || seen[url]) continue;
        var path = url.slice(SITE.length);
        var copy = copyForPath(path);
        var item = { title: copy.title, url: url, summary: copy.summary };
        if (query) {
          var hay = (item.title + "\n" + item.summary + "\n" + item.url).toLowerCase();
          if (hay.indexOf(query) === -1) continue;
        }
        seen[url] = true;
        insights.push(item);
      }
      return { insights: insights };
    }

    function listInsights(input) {
      try {
        if (typeof fetch !== "function") return Promise.resolve({ insights: [] });
        return fetch("/sitemap.xml").then(function (res) {
          if (!res || !res.ok || typeof res.text !== "function") return { insights: [] };
          return res.text().then(function (xml) {
            return insightsFromSitemap(xml, input);
          });
        }).catch(function () {
          return { insights: [] };
        });
      } catch (e) {
        return Promise.resolve({ insights: [] });
      }
    }

    register({
      name: "get_offer",
      description: "Read the Revenue-Growth.ai offer: the entity name, the six-month AI GTM / RevOps embed summary, the AskNicely proof line, and the embed article URL.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        try {
          return {
            name: "Revenue-Growth.ai",
            summary: "fractional AI GTM engineer, six-month AI GTM / RevOps embed: cleanup, then process, then agents (platform included when it fits)",
            proof: PROOF,
            url: OFFER_URL
          };
        } catch (e) {
          return {
            name: "Revenue-Growth.ai",
            summary: "fractional AI GTM engineer, six-month AI GTM / RevOps embed: cleanup, then process, then agents (platform included when it fits)",
            proof: PROOF,
            url: OFFER_URL
          };
        }
      }
    });

    register({
      name: "list_insights",
      description: "List Insights pages from the same-origin sitemap. Returns a title, absolute URL, and one-line summary for each. An optional query filters the list.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional case-insensitive text matched against the title, summary, and URL."
          }
        }
      },
      annotations: { readOnlyHint: true },
      execute: function (input) {
        return listInsights(input);
      }
    });

    register({
      name: "book_working_session",
      description: "Open the existing working-session section so a person can continue there. Does not submit or complete a booking.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: false },
      execute: function () {
        try {
          var loc = null;
          if (typeof location !== "undefined" && location) loc = location;
          else if (typeof window !== "undefined" && window && window.location) loc = window.location;
          if (loc && typeof loc.assign === "function") loc.assign(BOOKING_URL);
          else if (loc) loc.href = BOOKING_URL;
        } catch (e) {}
        return { url: BOOKING_URL };
      }
    });
  } catch (e) {}
})();
