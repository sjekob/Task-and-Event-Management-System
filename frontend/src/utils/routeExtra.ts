import { Json } from '../models/models';

// Route extra: an object handed to the next route without putting it
// in the URL (the event being edited). It is gone after a full page reload,
// by design.
let extra: Json | null = null;

export function setRouteExtra(value: Json | null): void {
  extra = value;
}

export function takeRouteExtra(): Json | null {
  const value = extra;
  extra = null;
  return value;
}
