export function register(api) {
  const { React, Text } = api.ui;

  api.command('hello', 'Set the hello mod greeting', (args) => {
    api.state.set('greeting', args.trim() || 'Hello from a Qwen mod');
    api.ui.invalidate();
    return 'Greeting updated. Edit this module and run /mods reload hello.';
  });

  api.on('turn.end', () => {
    api.state.set('turns', api.state.get('turns', 0) + 1);
    api.ui.invalidate();
  });

  api.ui.slot('footer', function Hello({ session }) {
    return React.createElement(
      Text,
      { color: 'cyan', wrap: 'truncate-end' },
      `${api.state.get('greeting', 'Hello from a Qwen mod')} · ${session.model} · ${api.state.get('turns', 0)} turns observed`,
    );
  });
}
