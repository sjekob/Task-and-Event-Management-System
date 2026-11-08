import { router } from 'expo-router';

/**
 * Opens a location expressed as a web path (what the shared controllers
 * return, e.g. "/my-tasks/12" or "/events?open=3") on the matching mobile route.
 */
export function go(webPath: string) {
  const [path, query = ''] = webPath.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const task = /^\/(my-tasks|my-special-tasks|tasks|special-tasks|advisory)\/(\d+)$/.exec(path);
  if (task) {
    router.push({ pathname: '/task/[id]', params: { id: task[2], own: task[1].startsWith('my-') ? '1' : '0', base: `/${task[1]}` } });
    return;
  }
  if (path === '/events' && params.open) {
    router.push({ pathname: '/event/[id]', params: { id: params.open } });
    return;
  }
  router.navigate(webPath as never);
}

export function openTask(id: number, base: string) {
  go(`${base}/${id}`);
}
