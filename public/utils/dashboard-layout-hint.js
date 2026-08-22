/**
 * Modul: Layout-Hinweis der Uebersicht (Skelett-Vorhersage)
 * Zweck: Haelt die Kachelformen des zuletzt geladenen Dashboards, damit das
 *        Skelett das Raster zeichnet, das gleich kommt - und nicht das
 *        Standardraster, das dann umspringt (Critique R1, A10).
 *
 * WARUM DAS EIN EIGENES MODUL IST UND NICHT IN dashboard.js BLEIBT.
 * Der Hinweis liegt im localStorage und gilt damit dem GERAET, nicht dem Konto.
 * Solange die Anordnung haushaltweit war, war das richtig: alle sahen ohnehin
 * dasselbe Raster. Seit sie jeder Person gehoert (#585), ist derselbe Eintrag
 * am geteilten Familientablett eine Vorhersage ueber den vorigen Nutzer - genau
 * der „kurze falsche Bildschirm", den er verhindern soll. Er muss deshalb beim
 * Abmelden mit weg, und das passiert in `auth.logout()`, wo der API-Cache aus
 * demselben Grund schon verworfen wird. Ein Modul, das beide importieren
 * koennen, ist der Preis dafuer, dass der Schluessel nur an einer Stelle steht.
 *
 * Er bleibt eine VORHERSAGE, keine Quelle: die Wahrheit ist die Serverantwort,
 * und ein veralteter oder kaputter Eintrag faellt still auf den Standard zurueck.
 *
 * UND WARUM NICHT IN utils/dashboard-widgets.js, wo die uebrige Widget-Logik
 * liegt: jene Datei ist ausdruecklich die Teilmenge, die OHNE Browser-Umgebung
 * entscheidbar ist, und wird genau deshalb direkt aus node:test importiert.
 * `localStorage` gehoert nicht hinein. Die Standardformen kommen deshalb als
 * Parameter herein, statt dass dieses Modul die Default-Konfiguration kennt.
 */

const LAYOUT_HINT_KEY = 'yuvomi-dash-layout-hint';

/** Merkt sich die Kachelformen der sichtbaren Widgets (duenn: nur die Form). */
export function rememberLayoutHint(cfg) {
  try {
    localStorage.setItem(LAYOUT_HINT_KEY, JSON.stringify(
      cfg.filter((w) => w.visible).map((w) => w.size),
    ));
  } catch { /* z.B. voller oder gesperrter Speicher: der Hinweis ist entbehrlich */ }
}

/** Gemerkte Formen, sonst die uebergebenen Standardformen. */
export function layoutHintSizes(fallbackSizes) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_HINT_KEY) ?? 'null');
    if (Array.isArray(stored) && stored.length && stored.every((s) => typeof s === 'string')) return stored;
  } catch { /* unlesbar: Standard */ }
  return fallbackSizes;
}

/** Beim Abmelden: der naechste Nutzer an diesem Geraet hat sein eigenes Raster. */
export function forgetLayoutHint() {
  try {
    localStorage.removeItem(LAYOUT_HINT_KEY);
  } catch { /* gesperrter Speicher: dann bleibt hoechstens ein Skelett falsch */ }
}
