// MDlearn landing page: download button, version, quiz card, videos. No tracking, no cookies, no storage.
(function () {
  "use strict";

  var REPO = "MD-Learn/MD-Learn";
  var data = document.body.dataset;

  // ---- 1. Which system is this? ----------------------------------------------------------
  var ua = navigator.userAgent || "";
  var uad = navigator.userAgentData;
  var iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  var mobile = (uad && uad.mobile) || iPadOS || /Android|iPhone|iPad|iPod|Mobile|CrOS/i.test(ua);
  var platform = (uad && uad.platform) || "";
  var os = "other";
  if (!mobile) {
    // The UA string still names the OS in every browser; userAgentData.platform is the fallback.
    if (/Windows NT/i.test(ua)) os = "win";
    else if (/Macintosh|Mac OS X/i.test(ua)) os = "mac";
    else if (/X11|Linux/i.test(ua)) os = "linux";
    else if (/Windows/i.test(platform)) os = "win";
    else if (/mac/i.test(platform)) os = "mac";
    else if (/Linux/i.test(platform)) os = "linux";
  }

  // Assets of the release, matched on the exact ending (skips .blockmap and latest*.yml).
  var PATTERNS = {
    win: /-win-x64\.exe$/,
    macArm: /-mac-arm64\.dmg$/,
    macIntel: /-mac-x64\.dmg$/,
    linux: /\.AppImage$/,
    deb: /\.deb$/,
    sums: /^SHA256SUMS\.txt$/
  };

  var buttons = document.querySelectorAll(".js-dl");

  function setButtons(label, href, state) {
    buttons.forEach(function (b) {
      if (label) b.querySelector("span").textContent = label;
      if (href) b.href = href;
      if (state) b.dataset.state = state;
    });
  }

  if (mobile) {
    // A phone can't run the app: say where it runs, never start a download.
    setButtons(data.labelMobile, "#download", "mobile");
    document.querySelectorAll(".js-note").forEach(function (n) { n.textContent = data.noteMobile; });
  } else if (os === "win" || os === "mac" || os === "linux") {
    var key = os.charAt(0).toUpperCase() + os.slice(1);
    setButtons(data["label" + key]);
    document.querySelectorAll(".js-also").forEach(function (a) { a.textContent = data["also" + key]; });
  }

  // ---- 2. Version and direct links from the latest release (fallback: the releases page) -
  function macArch() {
    if (uad && uad.getHighEntropyValues) {
      return uad.getHighEntropyValues(["architecture"]).then(function (v) {
        return v.architecture === "x86" ? "macIntel" : "macArm";
      }, function () { return "macArm"; });
    }
    return Promise.resolve("macArm"); // Safari doesn't say; Apple silicon is the common case, Intel is in #download
  }

  if (window.fetch) {
    fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rel) {
        if (rel.tag_name) {
          document.querySelectorAll(".js-ver").forEach(function (v) { v.textContent = rel.tag_name + " · "; });
        }
        var found = {};
        (rel.assets || []).forEach(function (a) {
          Object.keys(PATTERNS).forEach(function (k) {
            if (PATTERNS[k].test(a.name)) found[k] = a.browser_download_url;
          });
        });
        document.querySelectorAll("[data-asset]").forEach(function (a) {
          if (found[a.dataset.asset]) a.href = found[a.dataset.asset];
        });
        if (mobile) return;
        if (os === "mac") {
          return macArch().then(function (k) { if (found[k]) setButtons(null, found[k]); });
        }
        if ((os === "win" || os === "linux") && found[os]) setButtons(null, found[os]);
      })
      .catch(function () { /* keep the releases/latest links */ });
  }

  // ---- 3. The quiz card -------------------------------------------------------------------
  var card = document.querySelector(".card");
  if (card) {
    var fb = card.querySelector(".fb");
    card.querySelectorAll(".opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        card.querySelectorAll(".opt").forEach(function (o) {
          o.setAttribute("aria-pressed", "false");
          o.classList.remove("right", "wrong");
        });
        var right = btn.dataset.right === "true";
        btn.setAttribute("aria-pressed", "true");
        btn.classList.add(right ? "right" : "wrong");
        fb.textContent = "";
        fb.classList.remove("hint");
        var s = document.createElement("strong");
        s.className = right ? "right" : "wrong";
        s.textContent = (right ? data.quizRight : data.quizWrong) + " ";
        fb.appendChild(s);
        fb.appendChild(document.createTextNode(btn.dataset.why));
      });
    });
  }

  // ---- 4. Copy buttons for the terminal command --------------------------------------------
  document.querySelectorAll(".copy").forEach(function (btn) {
    var timer;
    function done() {
      btn.textContent = btn.dataset.done;
      clearTimeout(timer);
      timer = setTimeout(function () { btn.textContent = btn.dataset.label; }, 2000);
    }
    function fallback() {
      // Older browsers or no clipboard permission: select the command so it can be copied by hand.
      var code = btn.parentNode.querySelector("code");
      var range = document.createRange();
      range.selectNodeContents(code);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try { if (document.execCommand("copy")) done(); } catch (e) { /* the text stays selected */ }
    }
    btn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(btn.dataset.copy).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  // ---- 5. Videos: play only when visible, never with reduced motion -----------------------
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var videos = document.querySelectorAll("video");
  if (still) {
    videos.forEach(function (v) { v.pause(); v.removeAttribute("autoplay"); v.controls = true; });
  } else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
        else e.target.pause();
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { io.observe(v); });
  } else {
    videos.forEach(function (v) { v.controls = true; });
  }
})();
