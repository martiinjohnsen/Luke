/** A required refresh must fetch after any older snapshot still in flight. */
export function workspaceRefresher(load: (strict: boolean) => Promise<void>) {
  let running: Promise<void> | null = null;
  return async function refresh(strict = false): Promise<void> {
    while (running) {
      // Each original caller handles its own error. A later required fetch can
      // still succeed, and background observers must not inherit its rejection.
      await running.catch(() => {});
      if (!strict) return;
    }
    const task = load(strict).finally(() => {
      if (running === task) running = null;
    });
    running = task;
    return task;
  };
}
