// Apply the saved theme and accent before the first paint (external file: the page CSP allows no inline scripts).
try { var t = localStorage.getItem('mdl-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t } catch (e) {}
try { if (localStorage.getItem('mdl-colour') === 'off') document.documentElement.dataset.colour = 'off' } catch (e) {}
try {
  var f = localStorage.getItem('mdl-read-font'), s = Number(localStorage.getItem('mdl-read-size'))
  if (/^(times|sans|easy|dyslexia|mono)$/.test(f || '')) document.documentElement.dataset.readFont = f
  if (s >= 14 && s <= 28) { document.documentElement.style.setProperty('--read-size', Math.round(s) + 'px'); document.documentElement.style.setProperty('--read-scale', String(Math.round(s) / 18)) }
} catch (e) {}
try {
  var v = JSON.parse(localStorage.getItem('mdl-accent-vars') || '{}')
  for (var k in v) if (/^--[a-z-]+-[ld]$/.test(k) && typeof v[k] === 'string') document.documentElement.style.setProperty(k, v[k])
} catch (e) {}
