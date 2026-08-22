/**
 * Test: Die Übersicht gehört der Person, nicht dem Haushalt (#585)
 *
 * Geprüft wird die Regel, die den Umbau trägt: Anordnung und Kopfband werden
 * AUSSCHLIESSLICH pro Nutzer geschrieben und mit Haushalts-Fallback gelesen.
 * Beide Hälften brauchen einen Zeugen - ein Test, der nur "Nutzer 2 sieht etwas
 * anderes" prüft, wäre auch dann grün, wenn der Bestand beim Update verschwände.
 *
 * Der dritte Fall ist der, der beim Bauen wirklich falsch war: die PUT-Antwort
 * las den Haushaltswert weiter und meldete nach dem Speichern den Stand zurück,
 * den man gerade ersetzt hatte.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';

const { get } = await import('../server/db.js');
const { default: preferencesRouter } = await import('../server/routes/preferences.js');

let currentUserId = 1;

const WIDGETS_A = [
  { id: 'tasks', visible: true, order: 0, size: '2x2' },
  { id: 'weather', visible: false, order: 1, size: '1x1' },
];
const WIDGETS_HOUSEHOLD = [{ id: 'calendar', visible: true, order: 0, size: '4x2' }];

function clearDashboardPreferences() {
  get().prepare(`
    DELETE FROM sync_config
    WHERE key IN ('dashboard_widgets', 'dashboard_today_glance')
       OR key LIKE 'dashboard_widgets:user:%'
       OR key LIKE 'dashboard_today_glance:user:%'
  `).run();
}

/** Den Zustand eines Bestandshaushalts herstellen: haushaltweit gesetzt, niemand persönlich. */
function seedHouseholdValue(key, value) {
  get().prepare('INSERT INTO sync_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

function householdValue(key) {
  return get().prepare('SELECT value FROM sync_config WHERE key = ?').get(key)?.value ?? null;
}

function startApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authUserId = currentUserId;
    req.authRole = 'admin';
    next();
  });
  app.use('/', preferencesRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((done) => server.close(done)),
    }));
  });
}

const read = async (baseUrl) => (await (await fetch(`${baseUrl}/`)).json()).data;

const write = async (baseUrl, body) => {
  const response = await fetch(`${baseUrl}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()).data };
};

test.beforeEach(() => {
  clearDashboardPreferences();
  currentUserId = 1;
});

test('ohne jede Einstellung bleibt es beim Standard', async () => {
  const { baseUrl, close } = await startApp();
  try {
    const data = await read(baseUrl);
    assert.deepEqual(data.dashboard_widgets, []);
    assert.equal(data.dashboard_today_glance, true);
  } finally {
    await close();
  }
});

test('ein Bestandshaushalt erbt seine Anordnung, solange niemand sie für sich ändert', async () => {
  const { baseUrl, close } = await startApp();
  try {
    seedHouseholdValue('dashboard_widgets', JSON.stringify(WIDGETS_HOUSEHOLD));
    seedHouseholdValue('dashboard_today_glance', '0');

    for (const userId of [1, 2, 3]) {
      currentUserId = userId;
      const data = await read(baseUrl);
      assert.deepEqual(data.dashboard_widgets, WIDGETS_HOUSEHOLD, `Nutzer ${userId} erbt die Anordnung nicht`);
      assert.equal(data.dashboard_today_glance, false, `Nutzer ${userId} erbt das Kopfband nicht`);
    }
  } finally {
    await close();
  }
});

test('wer sein Dashboard umbaut, ändert nur sein eigenes', async () => {
  const { baseUrl, close } = await startApp();
  try {
    seedHouseholdValue('dashboard_widgets', JSON.stringify(WIDGETS_HOUSEHOLD));

    const saved = await write(baseUrl, { dashboard_widgets: WIDGETS_A, dashboard_today_glance: false });
    assert.equal(saved.status, 200);

    // Die Antwort auf das Schreiben muss den gerade gespeicherten Stand tragen,
    // nicht den Haushaltswert, den sie ersetzt hat.
    assert.deepEqual(saved.data.dashboard_widgets, WIDGETS_A);
    assert.equal(saved.data.dashboard_today_glance, false);

    currentUserId = 2;
    const other = await read(baseUrl);
    assert.deepEqual(other.dashboard_widgets, WIDGETS_HOUSEHOLD,
      'Nutzer 2 hat die Anordnung von Nutzer 1 bekommen - der Wert wirkt weiter haushaltweit');
    assert.equal(other.dashboard_today_glance, true);

    currentUserId = 1;
    const mine = await read(baseUrl);
    assert.deepEqual(mine.dashboard_widgets, WIDGETS_A);
    assert.equal(mine.dashboard_today_glance, false);
  } finally {
    await close();
  }
});

test('der Haushaltswert bleibt beim Speichern unangetastet', async () => {
  const { baseUrl, close } = await startApp();
  try {
    seedHouseholdValue('dashboard_widgets', JSON.stringify(WIDGETS_HOUSEHOLD));
    seedHouseholdValue('dashboard_today_glance', '1');

    await write(baseUrl, { dashboard_widgets: WIDGETS_A, dashboard_today_glance: false });

    // Der Bestand ist der Fallback für jeden, der noch nichts eigenes hat -
    // ihn zu überschreiben hiesse, den Umbau eines Einzelnen allen zu geben.
    assert.deepEqual(JSON.parse(householdValue('dashboard_widgets')), WIDGETS_HOUSEHOLD);
    assert.equal(householdValue('dashboard_today_glance'), '1');
    assert.ok(householdValue('dashboard_widgets:user:1'), 'der persönliche Wert wurde nicht abgelegt');
  } finally {
    await close();
  }
});

test('die Prüfung der Anordnung gilt weiterhin, auch pro Nutzer', async () => {
  const { baseUrl, close } = await startApp();
  try {
    assert.equal((await write(baseUrl, { dashboard_widgets: {} })).status, 400);
    assert.equal((await write(baseUrl, { dashboard_widgets: [{ id: '../weather', size: '1x1' }] })).status, 400);
    assert.equal((await write(baseUrl, { dashboard_today_glance: '0' })).status, 400);
    assert.equal(householdValue('dashboard_widgets:user:1'), null,
      'eine abgewiesene Anordnung darf nichts hinterlassen');
  } finally {
    await close();
  }
});
