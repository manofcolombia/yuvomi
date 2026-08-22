/**
 * Tests: Modal Utilities (wireBlurValidation, btnSuccess, btnError)
 * Modul: /public/components/modal.js
 * Läuft im Node-Kontext - die Utility-Funktionen greifen ausschließlich
 * über ihre Parameter auf DOM-Objekte zu, daher kein DOM-Polyfill nötig.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eachRule } from './css-rules.js';

// /i18n.js wird durch test-browser-loader.mjs gemockt (--loader Flag)
const { wireBlurValidation, btnSuccess, btnError } = await import('../public/components/modal.js');

// matchMedia und document.createElementNS werden von btnSuccess/btnError benötigt
global.matchMedia = () => ({ matches: false });

const _makeSvgEl = (tag) => {
  const attrs = {};
  const children = [];
  return {
    tag,
    setAttribute(k, v) { attrs[k] = v; },
    appendChild(child) { children.push(child); },
    get outerHTML() {
      const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
      const inner = children.map(c => c.outerHTML ?? '').join('');
      return `<${tag}${attrStr}>${inner}</${tag}>`;
    },
    _attrs: attrs,
    _children: children,
  };
};
global.document = {
  createElementNS: (_ns, tag) => _makeSvgEl(tag),
  // _ensureFieldError legt die Fehlermeldung als <p> an.
  createElement: (tag) => ({ tagName: tag.toUpperCase(), className: '', id: '', textContent: '' }),
};

const _origSetTimeout = setTimeout;

// --------------------------------------------------------
// DOM-Mocks
// --------------------------------------------------------

/**
 * Feldgruppe. `withDom: false` liefert bewusst einen schlanken Container ohne
 * querySelector/appendChild - die Klassen-Umschaltung muss auch damit laufen.
 */
function makeField({ withDom = true } = {}) {
  const classes = new Set();
  const listeners = {};
  const dataset = {};
  const children = [];
  const field = {
    dataset,
    offsetWidth: 0,
    classList: {
      toggle(cls, force) { force ? classes.add(cls) : classes.delete(cls); },
      add(cls) { classes.add(cls); },
      remove(cls) { classes.delete(cls); },
      contains(cls) { return classes.has(cls); },
    },
    addEventListener(event, fn) { listeners[event] = fn; },
    _classes: classes,
    _listeners: listeners,
    _children: children,
  };
  if (withDom) {
    field.querySelector = (sel) => children.find((c) => `.${c.className}` === sel) ?? null;
    field.appendChild = (node) => { children.push(node); return node; };
  }
  return field;
}

function makeInput({ value = '', required = true } = {}) {
  const listeners = {};
  const attrs = {};
  const field = makeField();
  return {
    value,
    required,
    _field: field,
    _listeners: listeners,
    _attrs: attrs,
    addEventListener(event, fn) { listeners[event] = fn; },
    closest() { return field; },
    parentElement: field,
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k] ?? null; },
    removeAttribute(k) { delete attrs[k]; },
  };
}

function makeContainer(inputs = []) {
  return {
    querySelectorAll(selector) {
      if (selector.includes('required')) return inputs;
      return [];
    },
  };
}

function makeBtn({ textContent = 'Speichern' } = {}) {
  const classes = new Set();
  const listeners = {};
  let _children = [];
  return {
    textContent,
    get innerHTML() {
      return _children.map(c => c?.outerHTML ?? '').join('');
    },
    offsetWidth: 0,
    classList: {
      add(cls) { classes.add(cls); },
      remove(cls) { classes.delete(cls); },
      contains(cls) { return classes.has(cls); },
    },
    replaceChildren(...nodes) { _children = nodes; },
    addEventListener(event, fn) { listeners[event] = fn; },
    _classes: classes,
    _listeners: listeners,
  };
}

// --------------------------------------------------------
// wireBlurValidation
// --------------------------------------------------------

test('wireBlurValidation: registriert blur-Listener auf required inputs', () => {
  const input = makeInput();
  wireBlurValidation(makeContainer([input]));
  assert.equal(typeof input._listeners['blur'], 'function');
});

test('wireBlurValidation: blur mit leerem Wert setzt form-field--error', () => {
  const input = makeInput({ value: '' });
  wireBlurValidation(makeContainer([input]));
  input._listeners['blur']();
  assert.ok(input._field._classes.has('form-field--error'));
  assert.ok(!input._field._classes.has('form-field--valid'));
  assert.equal(input._attrs['aria-invalid'], 'true');
});

test('wireBlurValidation: blur mit gültigem Wert setzt form-field--valid', () => {
  const input = makeInput({ value: 'Hallo' });
  wireBlurValidation(makeContainer([input]));
  input._listeners['blur']();
  assert.ok(input._field._classes.has('form-field--valid'));
  assert.ok(!input._field._classes.has('form-field--error'));
  assert.equal(input._attrs['aria-invalid'], 'false');
});

test('wireBlurValidation: Whitespace-only gilt als leer → form-field--error', () => {
  const input = makeInput({ value: '   ' });
  wireBlurValidation(makeContainer([input]));
  input._listeners['blur']();
  assert.ok(input._field._classes.has('form-field--error'));
  assert.equal(input._attrs['aria-invalid'], 'true');
});

test('wireBlurValidation: kein Fehler wenn closest() null zurückgibt', () => {
  const input = makeInput({ value: '' });
  input.closest = () => null;
  input.parentElement = null;
  wireBlurValidation(makeContainer([input]));
  assert.doesNotThrow(() => input._listeners['blur']());
});

// Feldbezogene Fehlermeldung + aria-describedby (Critique-Nachlauf #534):
// ein Sammelbanner am Formularende erfüllt WCAG 3.3.1 nicht, weil die Meldung
// nie mit dem Feld verknüpft ist.
test('wireBlurValidation: legt Fehlermeldung an und verknüpft sie per aria-describedby', () => {
  const input = makeInput({ value: '' });
  input.id = 'cardav-name';
  wireBlurValidation(makeContainer([input]));
  input._listeners['blur']();

  const errorEl = input._field._children.find((c) => c.className === 'form-field__error');
  assert.ok(errorEl, 'Fehlermeldung wurde angelegt');
  assert.equal(errorEl.id, 'cardav-name-error');
  assert.ok(errorEl.textContent.length > 0, 'Meldung hat Text');
  assert.equal(input._attrs['aria-describedby'], 'cardav-name-error');
});

test('wireBlurValidation: legt die Meldung nur einmal an', () => {
  const input = makeInput({ value: '' });
  input.id = 'cardav-url';
  wireBlurValidation(makeContainer([input]));
  input._listeners['blur']();
  input._listeners['blur']();
  const errors = input._field._children.filter((c) => c.className === 'form-field__error');
  assert.equal(errors.length, 1);
  assert.equal(input._attrs['aria-describedby'], 'cardav-url-error');
});

test('wireBlurValidation: schlanker Container ohne DOM-API bleibt fehlerfrei', () => {
  const input = makeInput({ value: '' });
  input._field = makeField({ withDom: false });
  input.closest = () => input._field;
  input.parentElement = input._field;
  wireBlurValidation(makeContainer([input]));
  assert.doesNotThrow(() => input._listeners['blur']());
  assert.ok(input._field._classes.has('form-field--error'));
});

// --------------------------------------------------------
// btnSuccess
// --------------------------------------------------------

test('btnSuccess: fügt btn--success-Klasse hinzu', () => {
  global.setTimeout = () => {};
  const btn = makeBtn();
  btnSuccess(btn, 'Test');
  assert.ok(btn._classes.has('btn--success'));
  global.setTimeout = _origSetTimeout;
});

test('btnSuccess: setzt SVG-Checkmark als innerHTML', () => {
  global.setTimeout = () => {};
  const btn = makeBtn();
  btnSuccess(btn, 'Test');
  assert.ok(btn.innerHTML.includes('<svg'));
  assert.ok(btn.innerHTML.includes('polyline'));
  global.setTimeout = _origSetTimeout;
});

test('btnSuccess: stellt Label nach 700ms wieder her', () => {
  let capturedFn, capturedMs;
  global.setTimeout = (fn, ms) => { capturedFn = fn; capturedMs = ms; };
  const btn = makeBtn({ textContent: 'Speichern' });
  btnSuccess(btn, 'Speichern');
  assert.equal(capturedMs, 700);
  capturedFn();
  assert.ok(!btn._classes.has('btn--success'));
  assert.equal(btn.textContent, 'Speichern');
  global.setTimeout = _origSetTimeout;
});

test('btnSuccess: nutzt btn.textContent als Fallback wenn kein Label übergeben', () => {
  let capturedFn;
  global.setTimeout = (fn) => { capturedFn = fn; };
  const btn = makeBtn({ textContent: 'Automatisch' });
  btnSuccess(btn);
  capturedFn();
  assert.equal(btn.textContent, 'Automatisch');
  global.setTimeout = _origSetTimeout;
});

// --------------------------------------------------------
// btnError
// --------------------------------------------------------

test('btnError: fügt btn--shaking-Klasse hinzu', () => {
  const btn = makeBtn();
  btnError(btn);
  assert.ok(btn._classes.has('btn--shaking'));
});

test('btnError: entfernt btn--shaking nach animationend', () => {
  const btn = makeBtn();
  btnError(btn);
  btn._listeners['animationend']();
  assert.ok(!btn._classes.has('btn--shaking'));
});

test('btnError: entfernt btn--shaking zuerst um Animation-Restart zu erzwingen', () => {
  const order = [];
  const btn = makeBtn();
  const origAdd = btn.classList.add.bind(btn);
  const origRemove = btn.classList.remove.bind(btn);
  btn.classList.remove = (cls) => { order.push(`remove:${cls}`); origRemove(cls); };
  btn.classList.add    = (cls) => { order.push(`add:${cls}`);    origAdd(cls); };
  btnError(btn);
  assert.equal(order[0], 'remove:btn--shaking');
  assert.equal(order[1], 'add:btn--shaking');
});

// --------------------------------------------------------
// Panel-Overflow (#805)
// --------------------------------------------------------

/* Das .modal-panel darf keine Scroll-Box haben.
 *
 * `overflow: hidden` erzeugt eine - unsichtbar fuer den Nutzer (keine
 * Scrollbar), aber programmatisch scrollbar. Chrome ruft beim Fokussieren
 * eines <select> scrollIntoView auf ALLEN Vorfahren auf und schob das Panel
 * dabei um 507px hoch: Kopfzeile und Schliessen-X verliessen das Sichtfeld,
 * ohne Weg zurueck. Ausloeser war ein .sr-only-Input (position:absolute im
 * Fluss), das dem overflow:auto des Bodys entkommt.
 *
 * `overflow: clip` ist visuell deckungsgleich, erzeugt aber gar keine
 * Scroll-Box. Gescrollt wird strukturell nur im Body.
 *
 * Der Guard prueft beide Enden der Zusage - sonst faellt nicht auf, wenn
 * jemand die Regel spaeter im selben Stylesheet auf hidden zuruecksetzt. */
const layoutCss = readFileSync(new URL('../public/styles/layout.css', import.meta.url), 'utf8');

function overflowValuesOf(css, selector) {
  const out = [];
  for (const rule of eachRule(css)) {
    if (!rule.selector.split(',').map((s) => s.trim()).includes(selector)) continue;
    const m = rule.body.match(/(?:^|;)\s*overflow\s*:\s*([^;]+)/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

test('#805: .modal-panel bekommt overflow:clip, nie hidden', () => {
  const werte = overflowValuesOf(layoutCss, '.modal-panel');
  assert.ok(werte.length > 0, '.modal-panel setzt gar kein overflow - die Zusage steht nirgends');
  assert.ok(
    werte.every((v) => v === 'clip'),
    `.modal-panel muss overflow:clip tragen, gefunden: ${werte.join(', ')}. `
    + 'hidden macht das Panel programmatisch scrollbar und schiebt das Schliessen-X aus dem Bild (#805).',
  );
});

test('#805: der Modal-Body bleibt der scrollende Container', () => {
  const rule = [...eachRule(layoutCss)].find((r) => r.selector.trim() === '.modal-panel__body');
  assert.ok(rule, '.modal-panel__body fehlt');
  assert.match(
    rule.body, /overflow-y\s*:\s*auto/,
    '.modal-panel__body muss overflow-y:auto behalten - nimmt man ihm das Scrollen, '
    + 'ist langer Modal-Inhalt hinter dem clip des Panels unerreichbar.',
  );
});

/* Zweite Runde zu #805: der erste Fix sass nur am Panel und hat den Fehler
 * damit bloss eine Ebene hoeher geschoben.
 *
 * Ab 768px trug .modal-panel kein position:relative - das stand allein in der
 * Mobile-Media-Query. In der Rolle des Containing Blocks hielt es sich dort nur
 * durch den transform-Endwert seiner Einfahr-Animation, und den nimmt
 * `prefers-reduced-motion: reduce` weg. Dann faengt das .sr-only-Input am
 * fixed .modal-overlay an, dessen `overflow: hidden` dieselbe unsichtbare
 * Scroll-Box ist: gemessen 1259px Scroll-Hoehe bei 700px Sichtfeld, das Panel
 * liess sich um 507px hochschieben, Kopfzeile und Schliessen-X weg.
 *
 * Beide Enden gehoeren gehalten: dem Overlay die Scroll-Box nehmen UND das
 * Panel breakpoint-unabhaengig zum Containing Block machen. Eine Zusage, die an
 * einer Animation haengt, ist keine. */

test('#805: .modal-overlay bekommt overflow:clip, nie hidden', () => {
  const werte = overflowValuesOf(layoutCss, '.modal-overlay');
  assert.ok(werte.length > 0, '.modal-overlay setzt gar kein overflow - die Zusage steht nirgends');
  assert.ok(
    werte.every((v) => v === 'clip'),
    `.modal-overlay muss overflow:clip tragen, gefunden: ${werte.join(', ')}. `
    + 'hidden macht das Overlay programmatisch scrollbar und schiebt das ganze Panel '
    + 'samt Schliessen-X aus dem Bild (#805).',
  );
});

test('#805: .modal-panel ist auf jeder Breite der Containing Block', () => {
  const regeln = [...eachRule(layoutCss)]
    .filter((r) => r.selector.split(',').map((s) => s.trim()).includes('.modal-panel'))
    .filter((r) => /(?:^|;)\s*position\s*:\s*relative/.test(r.body));
  assert.ok(
    regeln.some((r) => r.at.length === 0),
    '.modal-panel braucht position:relative in der BASISREGEL, nicht nur in einer '
    + `Media-Query (gefunden in: ${regeln.map((r) => r.at.join(' ') || 'Basis').join(' | ') || 'keiner Regel'}). `
    + 'Sonst haengen absolut positionierte Nachfahren am .modal-overlay statt am Panel (#805).',
  );
});
