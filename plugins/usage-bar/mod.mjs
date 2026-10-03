const tokens = (value) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}m`
    : value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : String(value);

function percentage(session) {
  return session.contextWindow > 0 && Number.isFinite(session.promptTokens)
    ? Math.max(0, (session.promptTokens / session.contextWindow) * 100)
    : null;
}

export function register(api) {
  const { React, Box, Text, Button } = api.ui;
  const h = React.createElement;

  function update(session) {
    const percent = percentage(session);
    const key = `warned:${session.id}`;
    if (!api.state.get('enabled', true)) return;
    if (percent !== null && percent >= 85 && !api.state.get(key, false)) {
      api.state.set(key, true);
      api.ui.notify(
        `Context ${Math.round(percent)}% full. Run /compress to make room.`,
        'warning',
      );
    } else if (percent !== null && percent < 75) {
      api.state.set(key, false);
    }
  }

  api.command(
    'usage-bar',
    'Toggle the context and session usage bar',
    (args) => {
      const action = args.trim().toLowerCase();
      if (action && !['on', 'off', 'toggle'].includes(action))
        return 'Usage: /usage-bar [on|off|toggle]';
      const enabled =
        action === 'on' ||
        (action !== 'off' && !api.state.get('enabled', true));
      api.state.set('enabled', enabled);
      update(api.session.get());
      api.ui.invalidate();
      return `Usage bar ${enabled ? 'on' : 'off'}.`;
    },
  );

  api.on('session.update', update);
  update(api.session.get());

  api.ui.slot('abovePrompt', function UsageBar({ session, width }) {
    if (!api.state.get('enabled', true)) return null;
    const percent = percentage(session);
    const size = width < 50 ? 6 : 12;
    const filled = Math.round((Math.min(100, percent ?? 0) / 100) * size);
    const color =
      percent === null
        ? 'gray'
        : percent >= 90
          ? 'red'
          : percent >= 70
            ? 'yellow'
            : 'green';
    const children = [
      h(
        Text,
        { key: 'bar', color },
        `ctx ${percent === null ? 'unavailable' : `${'█'.repeat(filled)}${'░'.repeat(size - filled)} ${Math.round(percent)}%`}`,
      ),
    ];
    if (width >= 50 && session.contextWindow > 0)
      children.push(
        h(
          Text,
          { key: 'tokens', dimColor: true },
          `${tokens(session.promptTokens)}/${tokens(session.contextWindow)}`,
        ),
      );
    if (width >= 70)
      children.push(
        h(
          Text,
          { key: 'io', dimColor: true },
          `in ${tokens(session.inputTokens)} · out ${tokens(session.outputTokens)}`,
        ),
      );
    if (session.cost !== null && Number.isFinite(session.cost))
      children.push(
        h(
          Text,
          { key: 'cost', dimColor: true },
          `${session.costIsPartial ? 'partial est.' : 'est.'} $${session.cost.toFixed(2)}`,
        ),
      );
    if (percent !== null && percent >= 85 && !session.busy) {
      children.push(
        h(Button, {
          key: 'compress',
          label: 'Compress',
          onPress: () => {
            if (!api.session.get().busy) api.runCommand('compress');
          },
        }),
      );
      children.push(h(Text, { key: 'hint', dimColor: true }, '/compress'));
    }
    return h(Box, { flexWrap: 'wrap', columnGap: 1 }, ...children);
  });
}
