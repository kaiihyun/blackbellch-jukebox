/* UI layer: text size, keyboard shortcuts, help dialog. Drives the controls app.js already owns,
   so nothing here touches audio or analysis. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;

  /* Text size, saved in the browser */
  var sel = $("size"), key = "spot-size";
  function applySize(v) { document.documentElement.style.fontSize = v + "%"; }
  var saved = null; try { saved = localStorage.getItem(key); } catch (e) {}
  if (saved) { sel.value = saved; applySize(saved); }
  sel.addEventListener("change", function () { applySize(sel.value); try { localStorage.setItem(key, sel.value); } catch (e) {} });

  /* Player title mirrors the menu title */
  var t1 = $("pTitle"), t2 = $("pTitle2");
  function mirror() { t2.textContent = t1.textContent; }
  new MutationObserver(mirror).observe(t1, { childList: true, characterData: true, subtree: true });
  mirror();

  /* Help dialog */
  var help = $("help");
  function toggleHelp() { if (help.open) help.close(); else if (help.showModal) help.showModal(); }
  $("helpBtn").addEventListener("click", toggleHelp);
  $("helpClose").addEventListener("click", function () { help.close(); });

  function say(t) { $("live").textContent = t; }
  function step(id, d) {
    var s = $(id), i = Math.max(0, Math.min(s.options.length - 1, s.selectedIndex + d));
    if (i === s.selectedIndex) return false;
    s.selectedIndex = i; s.dispatchEvent(new Event("change")); return true;
  }

  document.addEventListener("keydown", function (e) {
    if (help.open) {                       /* dialog owns the keyboard while open */
      if (e.key === "?") { e.preventDefault(); help.close(); }
      e.stopPropagation(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    var k = e.key, playing = body.classList.contains("playing");
    if (k === "?") { e.preventDefault(); toggleHelp(); return; }

    if (!playing) {                        /* menu: number keys pick a dataset */
      var n = parseInt(k, 10), cards = document.querySelectorAll(".cf");
      if (n >= 1 && n <= cards.length && !cards[n - 1].classList.contains("on")) cards[n - 1].click();
      return;
    }
    var lk = k.toLowerCase();
    if (lk === "k") $("key").click();
    else if (lk === "d") $("describe").click();
    else if (lk === "m") { $("map").focus(); say("Map focused. Arrow keys move the listening spot."); }
    else if (lk === "v") { step("target", $("target").selectedIndex === 0 ? 1 : -1); }
    else if (lk === "n") { if ($("target").value === "spot") { var p = $("place"); p.selectedIndex = (p.selectedIndex + (e.shiftKey ? -1 : 1) + p.options.length - 1) % (p.options.length - 1); p.dispatchEvent(new Event("change")); } }
    else if (lk === "i") $("invert").click();
    else if (lk === "r") { $("seek").value = 0; $("seek").dispatchEvent(new Event("input")); say("Back at the start."); }
    else if (k === "[") { if (step("rate", -1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (k === "]") { if (step("rate", 1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (k === "-" || k === "=" || k === "+") {
      var v = $("volume"); v.value = Math.max(0, Math.min(1, +v.value + (k === "-" ? -0.1 : 0.1)));
      v.dispatchEvent(new Event("input")); say("Volume " + Math.round(v.value * 100) + " percent.");
    }
  }, true);
})();
