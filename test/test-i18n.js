// Locale-Guard für die App-Locales (public/locales/).
//
// Die Gegenstücke existierten längst für den Installer (test-installer-i18n.js)
// und für die Pluralregeln (test-i18n-plural.js) - für den eigentlichen
// Schlüsselabgleich der App gab es nur den manuellen i18n-auditor-Agent. Ein
// Agent läuft, wenn jemand daran denkt; ein fehlender Schlüssel fällt sonst
// erst dem Nutzer auf, weil t() den Schlüssel selbst zurückgibt und damit
// „tasks.newTask" auf dem Button steht.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

const LOCALES_DIR = new URL('../public/locales/', import.meta.url);
const I18N_PATH = new URL('../public/i18n.js', import.meta.url);
const REFERENCE = 'de';

/** SUPPORTED_LOCALES aus i18n.js lesen, statt die Liste hier zu doppeln. */
function supportedLocales() {
  const src = readFileSync(I18N_PATH, 'utf8');
  const match = src.match(/const SUPPORTED_LOCALES = \[([^\]]+)\]/);
  assert.ok(match, 'SUPPORTED_LOCALES nicht in public/i18n.js gefunden');
  return match[1].match(/'([a-z-]+)'/g).map(s => s.slice(1, -1));
}

function readLocale(locale) {
  return readFileSync(new URL(`${locale}.json`, LOCALES_DIR), 'utf8');
}

/** Verschachteltes Objekt zu Dot-Notation abflachen - so löst t() auf. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

/** Platzhalternamen einer Übersetzung: t() ersetzt ausschließlich {{name}}. */
function placeholders(value) {
  if (typeof value !== 'string') return new Set();
  return new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1]));
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many)$/;

const LOCALES = supportedLocales();
const reference = flatten(JSON.parse(readLocale(REFERENCE)));
const referenceKeys = [...reference.keys()];

test('für jede unterstützte Locale existiert genau eine Locale-Datei', () => {
  const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(files, [...LOCALES].sort().map(l => `${l}.json`));
});

test('die Referenz-Locale trägt Schlüssel', () => {
  assert.ok(referenceKeys.length > 1000, `de.json hat nur ${referenceKeys.length} Schlüssel`);
});

// Jede Locale trägt denselben Schlüsselsatz wie de.json - auch Pluralvarianten
// für CLDR-Kategorien, die die Sprache gar nicht kennt (`_few` im Englischen,
// `_one` im Japanischen). Das ist Absicht und kein toter Ballast, den man
// aufräumen sollte: t() wählt die Kategorie über Intl.PluralRules und fällt
// sonst auf den Basisschlüssel zurück, sodass eine ungenutzte Variante folgenlos
// ist - während ein Schlüsselsatz, der sich je Sprache unterscheidet, jedes
// Übersetzungs-Diff zur Einzelfallprüfung machen würde.
for (const locale of LOCALES) {
  if (locale === REFERENCE) continue;

  test(`${locale}.json ist schlüsselidentisch zur Referenz ${REFERENCE}.json`, () => {
    const keys = flatten(JSON.parse(readLocale(locale)));
    const missing = referenceKeys.filter(k => !keys.has(k));
    const extra = [...keys.keys()].filter(k => !reference.has(k));
    assert.deepEqual(missing, [], `${locale}.json fehlen Schlüssel: ${missing.slice(0, 20).join(', ')}`);
    assert.deepEqual(extra, [], `${locale}.json hat überzählige Schlüssel: ${extra.slice(0, 20).join(', ')}`);
  });

  // Ein Platzhalter, den t() nicht befüllt, bleibt als rohes „{{color}}" im
  // Text stehen; einer, der fehlt, macht den Satz unvollständig, ohne dass er
  // beschädigt aussieht. Beides fällt beim Übersetzen nicht auf, weil die
  // Zeile für sich gelesen plausibel ist.
  //
  // Pluralvarianten werden gegen den Basisschlüssel geprüft, nicht gegen die
  // gleichnamige Referenzvariante: eine `_one`-Form darf {{count}} weglassen,
  // weil die Eins schon im Wort steckt („Stündlich" statt „Alle 1 Stunden"),
  // und darf ihn ebenso führen. Nur ein Platzhalter, den der Basisschlüssel
  // gar nicht kennt, ist immer ein Tippfehler.
  test(`${locale}.json nutzt dieselben Platzhalter wie die Referenz`, () => {
    const keys = flatten(JSON.parse(readLocale(locale)));
    const mismatches = [];
    for (const [key, refValue] of reference) {
      if (!keys.has(key)) continue;
      const actual = placeholders(keys.get(key));
      const variant = PLURAL_SUFFIX.test(key);
      const allowed = variant
        ? placeholders(reference.get(key.replace(PLURAL_SUFFIX, '')) ?? refValue)
        : placeholders(refValue);
      const missing = variant ? [] : [...allowed].filter(p => !actual.has(p));
      const extra = [...actual].filter(p => !allowed.has(p));
      if (missing.length || extra.length) {
        mismatches.push(`${key}: fehlt {${missing.join(',')}} überzählig {${extra.join(',')}}`);
      }
    }
    assert.deepEqual(mismatches, [], `${locale}.json:\n  ${mismatches.join('\n  ')}`);
  });
}

// Die Dateien werden von Hand und von Skripten gepflegt. JSON.stringify(o, null, 2)
// reserialisiert sie auf 2 Leerzeichen und erzeugt ein Diff über alle 3400 Zeilen,
// in dem die eine echte Änderung nicht mehr zu finden ist.
//
// GEPRÜFT WIRD DIE GANZE DATEI, NICHT IHRE ZWEITE ZEILE. Die frühere Fassung las
// genau eine Zeile je Locale und hieß trotzdem „alle Locale-Dateien sind mit 4
// Leerzeichen eingerückt". Sie hätte die 2-Leerzeichen-Reserialisierung gefunden,
// gegen die sie gebaut war - und übersah dabei acht Zeilen im inventory-Block, die
// in ALLEN 24 Dateien ganz ohne Einrückung standen (Rückstand einer früheren
// Einfügung, ab 2026-08-20 repariert). Folge war nicht bloß Unordnung: der
// JSON-Round-Trip war damit nicht mehr verlustfrei, und wer die Locales einmal
// über JSON.stringify schrieb, richtete die acht Zeilen ungewollt mit - 24 Dateien
// mit fremdem Rauschen in einem Commit, der davon nichts wissen wollte.
//
// Die Zusicherung ist deshalb die schärfstmögliche und zugleich die einfachste:
// die Datei IST, was `JSON.stringify(daten, null, 4) + '\n'` liefert. Das deckt
// Einrückung, Zeilenumbrüche, den Schluss-Umbruch und die Zeichen-Escapes in einem
// Satz - und macht das Ergänzen von Keys per Round-Trip wieder gefahrlos.
test('jede Locale-Datei ist Zeile für Zeile 4-Leerzeichen-formatiert', () => {
  const wrong = [];
  for (const locale of LOCALES) {
    const raw = readLocale(locale);
    const canonical = `${JSON.stringify(JSON.parse(raw), null, 4)}\n`;
    if (raw === canonical) continue;
    // Den ORT nennen, nicht nur die Tatsache: ohne Zeilennummer steht man vor
    // 4600 Zeilen und dem Satz „unterscheidet sich".
    const a = raw.split('\n');
    const b = canonical.split('\n');
    const i = a.findIndex((line, n) => line !== b[n]);
    wrong.push(`${locale}.json Zeile ${i + 1}: ${JSON.stringify(a[i])} statt ${JSON.stringify(b[i])}`);
  }
  assert.deepEqual(wrong, [], `nicht kanonisch 4-Leerzeichen-formatiert:\n  ${wrong.join('\n  ')}`);
});

test('alle Locale-Dateien enden mit einem Zeilenumbruch', () => {
  const wrong = LOCALES.filter(l => !readLocale(l).endsWith('\n'));
  assert.deepEqual(wrong, [], `ohne abschließenden Zeilenumbruch: ${wrong.join(', ')}`);
});

// EIN MODUL, EIN NAME - in jeder Sprache.
//
// Modulnamen leben an zwei Stellen: in `nav.*` (Sidebar, Tray, Kommandopalette,
// Dokumenttitel, Dashboard-Widget-Kopf) und in
// `settings.apiTokenScopeModules.*` (die Auswahlliste im Token-Dialog). Beide
// Listen wurden getrennt gepflegt und waren getrennt gedriftet: der Token-
// Dialog nannte die Startseite in 17 von 24 Sprachen „Dashboard", waehrend die
// Navigation sie „Uebersicht" nennt, und die Haushaltshilfe hiess dort
// „Haushalt". Kein Test konnte das sehen - beide Schluessel existierten, beide
// waren uebersetzt, sie sagten nur Verschiedenes.
//
// Geprueft wird die SCHNITTMENGE, nicht eine Liste: `weather` und `family` sind
// API-Scopes ohne eigene Route und haben deshalb keinen `nav`-Eintrag. Sie
// fallen von selbst heraus, statt als benannte Ausnahme gepflegt zu werden -
// und ein kuenftiger Scope, der eine Route bekommt, faellt automatisch unter
// die Regel.
test('Modulnamen sind in nav und in den API-Token-Scopes wortgleich', () => {
  const drift = [];
  let compared = 0;
  for (const locale of LOCALES) {
    const keys = flatten(JSON.parse(readLocale(locale)));
    for (const [key, value] of keys) {
      const match = key.match(/^settings\.apiTokenScopeModules\.(\w+)$/);
      if (!match) continue;
      const navKey = `nav.${match[1]}`;
      if (!keys.has(navKey)) continue;
      compared++;
      if (keys.get(navKey) !== value) {
        drift.push(`${locale}: ${key} = ${JSON.stringify(value)}, ${navKey} = ${JSON.stringify(keys.get(navKey))}`);
      }
    }
  }
  // Reichweiten-Nachweis: ohne ihn meldet ein Guard, dessen Selektor ins Leere
  // greift, fehlerfrei „keine Drift" ueber null verglichene Paare.
  assert.ok(compared >= 12 * LOCALES.length,
    `zu wenige Paare verglichen (${compared}) - greift der Selektor noch?`);
  assert.deepEqual(drift, [], `Modulname driftet:\n  ${drift.join('\n  ')}`);
});

// Dritte Stelle desselben Namens: der Ordner, in dem die Belege der
// Gemeinsamen Ausgaben landen. Er hiess in ELF von vierundzwanzig Sprachen
// anders als das Modul - "Geteilte Ausgaben" gegen "Gemeinsame Ausgaben",
// "Sdílené výdaje" gegen "Společné výdaje" - und keine der beiden Listen oben
// sah ihn, weil er unter `documents.*` liegt statt unter `nav.*`.
//
// Er steht hier und nicht bei der Migration, die ihn einmalig umbenannt hat
// (v146): die Migration ist ein historischer Fakt und laeuft genau einmal, die
// REGEL gilt fuer jede kuenftige Uebersetzung. Ein Uebersetzer, der den Ordner
// beim naechsten Sprachdurchgang anders nennt, laesst `ensureFolder`
// (server/routes/documents.js) sonst still einen zweiten Ordner anlegen.
test('der Beleg-Ordner der Gemeinsamen Ausgaben heisst wie das Modul', () => {
  const drift = [];
  for (const locale of LOCALES) {
    const keys = flatten(JSON.parse(readLocale(locale)));
    const title = keys.get('splitExpenses.title');
    const folder = keys.get('documents.splitExpensesFolder');
    assert.ok(title, `${locale}: splitExpenses.title fehlt`);
    assert.ok(folder, `${locale}: documents.splitExpensesFolder fehlt`);
    if (title !== folder) drift.push(`${locale}: Modul ${JSON.stringify(title)}, Ordner ${JSON.stringify(folder)}`);
  }
  assert.deepEqual(drift, [],
    `Der Beleg-Ordner traegt einen anderen Namen als das Modul:\n  ${drift.join('\n  ')}`);
});
