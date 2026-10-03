import {
  DAY,
  DEADLINE_USAGE,
  formatDeadline,
  parseDeadline,
  timeLeft,
} from './date-utils.mjs';

function validate(value) {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        item &&
        typeof item.name === 'string' &&
        item.name.length > 0 &&
        item.name.length <= 120 &&
        !/\p{Cc}/u.test(item.name) &&
        Number.isFinite(item.at) &&
        Math.abs(item.at) <= 8.64e15,
    )
  ) {
    throw new Error(
      'Invalid saved deadlines. Existing data has been preserved.',
    );
  }
  return value;
}

export async function register(api) {
  const { React, Text } = api.ui;
  let list = [];
  let error;
  let generation = 0;
  const refresh = async () => {
    const request = ++generation;
    try {
      const next = validate(await api.store.get('deadlines', []));
      if (api.signal.aborted || request !== generation) return;
      list = next;
      error = undefined;
    } catch (cause) {
      if (api.signal.aborted || request !== generation) return;
      error = cause instanceof Error ? cause.message : String(cause);
    }
    api.ui.invalidate();
  };
  await refresh();
  if (api.signal.aborted) return;

  api.command('ddl', 'List, add, or remove deadlines', async (args) => {
    const input = args.trim();
    try {
      let result;
      if (/^add\s+/i.test(input)) {
        const deadline = parseDeadline(input.replace(/^add\s+/i, ''));
        await api.store.update('deadlines', [], (current) => [
          ...validate(current).filter(
            (item) => item.name.toLowerCase() !== deadline.name.toLowerCase(),
          ),
          deadline,
        ]);
        result = `Added ${deadline.name}: ${formatDeadline(deadline.at)} (${new Date(deadline.at).toISOString()})`;
      } else if (/^rm\s+/i.test(input)) {
        const name = input.replace(/^rm\s+/i, '').trim();
        let removed = false;
        await api.store.update('deadlines', [], (current) =>
          validate(current).filter((item) => {
            if (item.name.toLowerCase() !== name.toLowerCase()) return true;
            removed = true;
            return false;
          }),
        );
        result = removed ? `Removed ${name}` : `No deadline named ${name}`;
      } else if (input && input !== 'list') {
        return `Usage: ${DEADLINE_USAGE}`;
      }
      await refresh();
      if (error) throw new Error(error);
      if (result) return result;
      if (!list.length) return `No deadlines. ${DEADLINE_USAGE}`;
      const now = Date.now();
      return [
        'Deadlines',
        ...[...list]
          .sort((a, b) => a.at - b.at)
          .map(
            (item) =>
              `${item.name} · ${item.at > now ? timeLeft(item.at - now) : 'passed'} · ${formatDeadline(item.at)}`,
          ),
      ].join('\n');
    } catch (cause) {
      api.ui.notify(
        `Deadlines: ${cause instanceof Error ? cause.message : String(cause)}`,
        'error',
      );
    }
  });

  api.ui.slot('footer', function Deadlines() {
    if (error)
      return React.createElement(
        Text,
        { color: 'yellow' },
        'Deadlines unavailable. Run /ddl for details.',
      );
    const now = Date.now();
    const upcoming = list
      .filter((item) => item.at > now)
      .sort((a, b) => a.at - b.at);
    if (!upcoming.length) return null;
    const first = upcoming[0];
    const remaining = first.at - now;
    return React.createElement(
      Text,
      {
        color:
          remaining < DAY ? 'red' : remaining < 7 * DAY ? 'yellow' : 'green',
        wrap: 'truncate-end',
      },
      `◷ ${first.name} ${timeLeft(remaining)}${upcoming.length > 1 ? `  +${upcoming.length - 1}` : ''}`,
    );
  });
  api.timers.every(15_000, refresh);
}
