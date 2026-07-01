/** Bypass ngrok free-tier browser warning on API requests from remote testers. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("ngrok-skip-browser-warning", "true");
  return fetch(input, { ...init, headers });
}
