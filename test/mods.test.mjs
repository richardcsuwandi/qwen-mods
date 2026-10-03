import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeadline } from '../plugins/deadlines/date-utils.mjs';
import { register as deadlines } from '../plugins/deadlines/mod.mjs';
import { register as usageBar } from '../plugins/usage-bar/mod.mjs';
import { register as contextBar, contextSegments } from '../plugins/context-bar/mod.mjs';
import { register as hello } from '../examples/hello/mod.mjs';

function harness() {
  const commands = new Map();
  const listeners = new Map();
  const slots = new Map();
  const state = new Map();
  const store = new Map();
  const notices = [];
  const controller = new globalThis.AbortController();
  let session = {
    id: 'first',
    model: 'test-model',
    cwd: '.',
    busy: false,
    promptTokens: 10,
    contextWindow: 100,
    inputTokens: 10,
    outputTokens: 1,
    cost: null,
    costIsPartial: false,
    historyLength: 1,
  };
  const api = {
    signal: controller.signal,
    command: (name, description, callback) => commands.set(name, callback),
    on: (event, callback) => {
      const handlers = listeners.get(event) ?? [];
      handlers.push(callback);
      listeners.set(event, handlers);
    },
    session: {
      get: () => session,
      context: async () => ({
        used: 10,
        window: 100,
        estimated: false,
        reserve: 10,
        categories: [{ name: 'Messages', tokens: 10 }],
      }),
    },
    state: {
      get: (key, fallback) => (state.has(key) ? state.get(key) : fallback),
      set: (key, value) => state.set(key, value),
    },
    store: {
      get: async (key, fallback) =>
        store.has(key) ? store.get(key) : fallback,
      update: async (key, fallback, update) => {
        const value = update(store.has(key) ? store.get(key) : fallback);
        store.set(key, value);
        return value;
      },
    },
    ui: {
      React: {
        createElement: (type, props, ...children) => ({
          type,
          props,
          children,
        }),
      },
      Text: 'Text',
      Box: 'Box',
      Button: 'Button',
      slot: (slot, component) => slots.set(slot, component),
      notify: (message, level) => notices.push({ message, level }),
      invalidate: () => {},
    },
    timers: { every: () => () => {} },
  };
  return {
    api,
    commands,
    slots,
    state,
    store,
    notices,
    controller,
    emit: async (event) => {
      for (const callback of listeners.get(event) ?? [])
        await callback(session);
    },
    setSession: (patch) => {
      session = { ...session, ...patch };
    },
    render: (slot) => slots.get(slot)({ session, width: 70 }),
  };
}

test('deadline parser handles AoE, local time, offsets, and daylight saving', () => {
  for (const [input, expected] of [
    ['Paper 2027-01-28 aoe', '2027-01-29T11:59:00Z'],
    ['Meeting 2027-01-15 12:00 et', '2027-01-15T17:00:00Z'],
    ['Meeting 2027-07-15 12:00 et', '2027-07-15T16:00:00Z'],
    ['Meeting 2027-01-15 12:00 UTC+05:45', '2027-01-15T06:15:00Z'],
    ['Meeting 2027-01-15 12:00 -0330', '2027-01-15T15:30:00Z'],
  ])
    assert.equal(parseDeadline(input).at, Date.parse(expected));
  assert.equal(
    parseDeadline('Meeting 2027-01-28 09:00', 'Asia/Shanghai').at,
    Date.parse('2027-01-28T01:00:00Z'),
  );
  for (const input of [
    '2027-02-29 utc',
    '2027-01-28 24:00 utc',
    '2027-01-28 +14:01',
    '2027-01-28 Mars/Olympus',
    '2027-03-14 02:30 et',
    '2027-11-07 01:30 et',
  ]) {
    assert.throws(() => parseDeadline(`Meeting ${input}`));
  }
});

test('deadlines use the atomic store update and preserve malformed saved data', async () => {
  const h = harness();
  await deadlines(h.api);
  const ddl = h.commands.get('ddl');
  await Promise.all([
    ddl('add Paper 2027-01-28 aoe'),
    ddl('add Meeting 2027-02-28 utc'),
  ]);
  assert.equal(h.store.get('deadlines').length, 2);
  await ddl('add paper 2027-01-29 aoe');
  assert.equal(h.store.get('deadlines').length, 2);
  assert.match(await ddl(''), /paper/);
  await ddl('rm PAPER');
  assert.equal(h.store.get('deadlines').length, 1);
  const invalid = [{ name: 'Broken', at: 'tomorrow' }];
  h.store.set('deadlines', invalid);
  await ddl('add New 2027-01-28 utc');
  assert.equal(h.store.get('deadlines'), invalid);
  assert.match(h.notices.at(-1).message, /preserved/);
});

test('usage warning fires once, rearms below 75 percent, and resets for new sessions', async () => {
  const h = harness();
  usageBar(h.api);
  h.setSession({ promptTokens: 85 });
  await h.emit('session.update');
  await h.emit('session.update');
  assert.equal(h.notices.length, 1);
  h.setSession({ promptTokens: 75 });
  await h.emit('session.update');
  h.setSession({ promptTokens: 90 });
  await h.emit('session.update');
  assert.equal(h.notices.length, 1);
  h.setSession({ promptTokens: 74 });
  await h.emit('session.update');
  h.setSession({ promptTokens: 90 });
  await h.emit('session.update');
  assert.equal(h.notices.length, 2);
  h.setSession({ id: 'second' });
  await h.emit('session.update');
  assert.equal(h.notices.length, 3);
  h.commands.get('usage-bar')('off');
  assert.equal(h.render('abovePrompt'), null);
});

test('context segments preserve exact width at overflow and separate reserve', () => {
  for (const used of [0, 10, 90, 130]) {
    const result = contextSegments(
      {
        window: 100,
        reserve: 20,
        categories: [{ name: 'Messages', tokens: used }],
      },
      33,
    );
    assert.equal(
      result.segments.reduce((sum, item) => sum + item.cells, 0),
      33,
    );
    assert.ok(result.segments.every((item) => item.cells >= 0));
    assert.equal(
      result.segments.find((item) => item.name === 'Reserve').tokens,
      Math.min(20, Math.max(0, 100 - used)),
    );
  }
});

test('context ignores an asynchronous result from the previous session', async () => {
  const h = harness();
  const requests = [];
  h.api.session.context = () =>
    new Promise((resolve) => requests.push(resolve));
  contextBar(h.api);
  h.setSession({ id: 'second', busy: true });
  await h.emit('session.update');
  requests[0]({
    window: 100,
    reserve: 10,
    categories: [{ name: 'Old', tokens: 10 }],
    estimated: false,
  });
  await Promise.resolve();
  assert.equal(h.render('abovePrompt'), null);
  h.setSession({ busy: false });
  const pending = h.emit('session.update');
  requests[1]({
    window: 100,
    reserve: 10,
    categories: [{ name: 'New', tokens: 20 }],
    estimated: true,
  });
  await pending;
  assert.match(JSON.stringify(h.render('abovePrompt')), /New/);
  assert.doesNotMatch(JSON.stringify(h.render('abovePrompt')), /Old/);
});

test('hello demonstrates command, event, and retained state after entry reload', async () => {
  const h = harness();
  hello(h.api);
  h.commands.get('hello')('Good morning');
  await h.emit('turn.end');
  assert.match(
    JSON.stringify(h.render('footer')),
    /Good morning.*1 turns observed/,
  );
  hello(h.api);
  assert.match(
    JSON.stringify(h.render('footer')),
    /Good morning.*1 turns observed/,
  );
});
