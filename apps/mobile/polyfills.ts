// Hermes exposes crypto via globalThis (JSI) but not as a bare global variable.
// Assign it to `global` so any library using `crypto.xxx` without prefix works.
if (
  typeof (global as Record<string, unknown>).crypto === "undefined" &&
  typeof globalThis.crypto !== "undefined"
) {
  (global as Record<string, unknown>).crypto = globalThis.crypto;
}
