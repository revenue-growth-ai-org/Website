"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SOURCE = fs.readFileSync(path.join(__dirname, "webmcp.js"), "utf8");
var PROOF = "AskNicely — lifted forecasted win rate 18% and doubled qualified pipeline in the same quarter.";
var OFFER_SUMMARY = "fractional AI GTM engineer, six-month AI GTM / RevOps embed: cleanup, then process, then agents (platform included when it fits)";
var BOOKING_URL = "https://www.revenue-growth.ai/#book-a-working-session";

function load(setup) {
  var logs = [];
  var sandbox = {
    URL: URL,
    Promise: Promise,
    console: {
      log: function () { logs.push("log"); },
      info: function () { logs.push("info"); },
      warn: function () { logs.push("warn"); },
      error: function () { logs.push("error"); },
      debug: function () { logs.push("debug"); }
    }
  };
  setup(sandbox);
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "webmcp.js" });
  sandbox.__logs = logs;
  return sandbox;
}

function toolsFrom(modelContext) {
  var registered = [];
  modelContext.registerTool = function (tool) {
    registered.push(tool);
  };
  return registered;
}

var registered = [];
var fetchCalls = 0;
load(function (sandbox) {
  sandbox.document = {};
  sandbox.navigator = {
    modelContext: {
      registerTool: function (tool) { registered.push(tool); }
    }
  };
  sandbox.fetch = function () {
    fetchCalls += 1;
    throw new Error("fetch on load");
  };
});

assert.strictEqual(fetchCalls, 0, "no network on load");
assert.strictEqual(registered.length, 3);
assert.deepStrictEqual(registered.map(function (tool) { return tool.name; }), [
  "get_offer",
  "list_insights",
  "book_working_session"
]);
assert.strictEqual(registered[0].annotations.readOnlyHint, true);
assert.strictEqual(registered[1].annotations.readOnlyHint, true);
assert.strictEqual(registered[2].annotations.readOnlyHint, false);
registered.forEach(function (tool) {
  assert.strictEqual(typeof tool.execute, "function");
  assert.strictEqual(tool.inputSchema.type, "object");
  assert.strictEqual(typeof tool.description, "string");
});

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

var offer = plain(registered[0].execute());
assert.deepStrictEqual(offer, {
  name: "Revenue-Growth.ai",
  summary: OFFER_SUMMARY,
  proof: PROOF,
  url: "https://www.revenue-growth.ai/insights/fractional-ai-gtm-embed/"
});

var silent = load(function (sandbox) {
  sandbox.document = {};
  sandbox.navigator = {};
  sandbox.fetch = function () { throw new Error("should not fetch"); };
});
assert.deepStrictEqual(silent.__logs, []);

load(function (sandbox) {
  sandbox.navigator = {};
});

var usedDocument = false;
load(function (sandbox) {
  sandbox.document = {
    modelContext: {
      registerTool: function () { usedDocument = true; }
    }
  };
  sandbox.navigator = {
    modelContext: {
      registerTool: function () { throw new Error("navigator should not be used"); }
    }
  };
});
assert.strictEqual(usedDocument, true);

var docWithoutRegister = [];
load(function (sandbox) {
  sandbox.document = { modelContext: {} };
  sandbox.navigator = {
    modelContext: {
      registerTool: function () { docWithoutRegister.push("nav"); }
    }
  };
});
assert.deepStrictEqual(docWithoutRegister, []);

var sitemap = [
  "<urlset>",
  "<url><loc>https://revenue-growth.ai/insights/fractional-ai-gtm-embed</loc></url>",
  "<url><loc>http://www.revenue-growth.ai/insights/grok-bot-for-business/</loc></url>",
  "<url><loc>https://www.revenue-growth.ai/platform</loc></url>",
  "<url><loc>https://example.com/insights/per-task-automation-billing/</loc></url>",
  "<url><loc>/insights/cuban-custom-revops-embed/</loc></url>",
  "<url><loc>https://www.revenue-growth.ai/insights/</loc></url>",
  "<url><loc>https://www.revenue-growth.ai/insights/brand-new-note</loc></url>",
  "<url><loc>https://www.revenue-growth.ai/insights/fractional-ai-gtm-embed/</loc></url>",
  "</urlset>"
].join("");

var listFetchCalls = [];
var listed = load(function (sandbox) {
  var bucket = [];
  sandbox.document = {};
  sandbox.navigator = { modelContext: { registerTool: function (tool) { bucket.push(tool); } } };
  sandbox.fetch = function (url) {
    listFetchCalls.push(url);
    return Promise.resolve({
      ok: true,
      text: function () { return Promise.resolve(sitemap); }
    });
  };
  sandbox.__tools = bucket;
});

listed.__tools[0].execute();
assert.deepStrictEqual(listFetchCalls, [], "get_offer does not fetch");

listed.__tools[1].execute().then(function (result) {
  result = plain(result);
  assert.strictEqual(listFetchCalls.length, 1);
  assert.strictEqual(listFetchCalls[0], "/sitemap.xml");
  assert.deepStrictEqual(result.insights.map(function (item) { return item.url; }), [
    "https://www.revenue-growth.ai/insights/fractional-ai-gtm-embed/",
    "https://www.revenue-growth.ai/insights/grok-bot-for-business/",
    "https://www.revenue-growth.ai/insights/per-task-automation-billing/",
    "https://www.revenue-growth.ai/insights/cuban-custom-revops-embed/",
    "https://www.revenue-growth.ai/insights/",
    "https://www.revenue-growth.ai/insights/brand-new-note/"
  ]);
  assert.strictEqual(result.insights[0].title, "Fractional AI GTM engineer: 6-month embed");
  assert.strictEqual(result.insights[0].summary, "Who a fractional AI GTM / RevOps embed is for, and what six months of data cleanup, process, then agents buys. Platform included when it fits.");
  assert.strictEqual(result.insights[5].title, "Brand New Note");
  assert.strictEqual(result.insights[5].summary, "Insights page.");
  return listed.__tools[1].execute({ query: "  Grok  " });
}).then(function (filtered) {
  filtered = plain(filtered);
  assert.strictEqual(filtered.insights.length, 1);
  assert.strictEqual(filtered.insights[0].url, "https://www.revenue-growth.ai/insights/grok-bot-for-business/");
  return listed.__tools[1].execute({ query: "NO-SUCH-PAGE" });
}).then(function (empty) {
  assert.deepStrictEqual(plain(empty), { insights: [] });
  var assigned = [];
  var booked = load(function (sandbox) {
    var bucket = [];
    sandbox.document = {};
    sandbox.navigator = { modelContext: { registerTool: function (tool) { bucket.push(tool); } } };
    sandbox.location = { assign: function (url) { assigned.push(url); } };
    sandbox.fetch = function () { throw new Error("book must not fetch"); };
    sandbox.__tools = bucket;
  });
  var booking = plain(booked.__tools[2].execute());
  assert.deepStrictEqual(assigned.map(String), [BOOKING_URL]);
  assert.deepStrictEqual(booking, { url: BOOKING_URL });
  console.log("webmcp.test.js: ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
