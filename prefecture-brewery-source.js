// Prefecture and brewery pages must read brewery data through this boundary.
// Ver.1 currently uses the audited static snapshot. When the brewery DB schema
// is finalized, replace this source implementation without changing page UI.
(function () {
  function registry() {
    return window.WASHULOG_PREFECTURE_BREWERIES || {};
  }

  function getPrefecture(name) {
    return registry()[String(name || "").trim()] || null;
  }

  window.WASHULOG_BREWERY_SOURCE = Object.freeze({
    mode: "audited-static-snapshot",
    all: registry,
    getPrefecture,
  });
})();
