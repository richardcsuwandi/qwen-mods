const colors = [
  'magenta',
  'green',
  'yellow',
  'cyan',
  'magentaBright',
  'blueBright',
  'gray',
];
const count = (value) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

export function contextSegments(data, width) {
  const categories = data.categories
    .map((item, index) => ({
      ...item,
      tokens: Math.max(0, item.tokens),
      color: colors[index % colors.length],
      glyph: '█',
    }))
    .filter((item) => item.tokens > 0);
  const used = categories.reduce((total, item) => total + item.tokens, 0);
  const window = Math.max(1, data.window);
  const remaining = Math.max(0, window - used);
  const reserve = Math.min(remaining, Math.max(0, data.reserve));
  const all = [
    ...categories,
    { name: 'Free', tokens: remaining - reserve, color: 'gray', glyph: '░' },
    { name: 'Reserve', tokens: reserve, color: 'gray', glyph: '▒' },
  ];
  const denominator = Math.max(window, used);
  let accumulated = 0;
  return {
    used,
    window,
    segments: all.map((item) => {
      const start = Math.round((accumulated / denominator) * width);
      accumulated += item.tokens;
      return {
        ...item,
        cells: Math.max(
          0,
          Math.round((accumulated / denominator) * width) - start,
        ),
      };
    }),
  };
}

export function register(api) {
  const { React, Box, Text } = api.ui;
  const h = React.createElement;
  let snapshot;
  let lastKey;
  let generation = 0;
  const sessionKey = (session) => `${session.id}:${session.model}`;

  async function refresh(session, force = false) {
    if (!api.state.get('enabled', true)) return;
    const owner = sessionKey(session);
    const key = `${owner}:${session.promptTokens}:${session.contextWindow}:${session.historyLength}:${session.busy}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const request = ++generation;
    if (session.busy) return;
    try {
      const data = await api.session.context();
      if (
        api.signal.aborted ||
        request !== generation ||
        sessionKey(api.session.get()) !== owner
      )
        return;
      snapshot = { owner, data };
    } catch {
      if (
        api.signal.aborted ||
        request !== generation ||
        sessionKey(api.session.get()) !== owner
      )
        return;
      snapshot = {
        owner,
        error: 'Context breakdown unavailable. Run /context for details.',
      };
    }
    api.ui.invalidate();
  }

  api.command(
    'context-bar',
    'Toggle the stacked context breakdown',
    async (args) => {
      const action = args.trim().toLowerCase();
      if (action && !['on', 'off', 'toggle', 'refresh'].includes(action))
        return 'Usage: /context-bar [on|off|toggle|refresh]';
      const enabled =
        action === 'on' ||
        action === 'refresh' ||
        (action !== 'off' && !api.state.get('enabled', true));
      api.state.set('enabled', enabled);
      if (!enabled) ++generation;
      else await refresh(api.session.get(), true);
      api.ui.invalidate();
      return `Context bar ${enabled ? 'on' : 'off'}.`;
    },
  );
  api.on('session.update', (session) => refresh(session));
  api.on('turn.end', (session) => refresh(session, true));
  void refresh(api.session.get());

  api.ui.slot('abovePrompt', function ContextBar({ session, width }) {
    if (
      !api.state.get('enabled', true) ||
      snapshot?.owner !== sessionKey(session)
    )
      return null;
    if (snapshot.error) return h(Text, { dimColor: true }, snapshot.error);
    const size = Math.max(1, Math.floor(width));
    const { segments, used, window } = contextSegments(snapshot.data, size);
    return h(
      Box,
      { flexDirection: 'column', width: size },
      h(
        Text,
        null,
        ...segments.map((item, index) =>
          h(
            Text,
            { key: index, color: item.color },
            item.glyph.repeat(item.cells),
          ),
        ),
      ),
      h(
        Box,
        { flexWrap: 'wrap', columnGap: 2 },
        h(
          Text,
          { dimColor: true },
          `${snapshot.data.estimated ? '~' : ''}${count(used)}/${count(window)} (${Math.round((used / window) * 100)}%)`,
        ),
        ...segments
          .filter((item) => item.tokens > 0)
          .map((item, index) =>
            h(
              Text,
              { key: index, color: item.color },
              `${item.glyph} ${item.name} ${count(item.tokens)}`,
            ),
          ),
      ),
    );
  });
}
