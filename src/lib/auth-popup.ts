/** postMessage type the OAuth popup sends to the window that opened it. */
export const AUTH_MESSAGE = "debutyard:auth";

export type AuthMessage = { type: typeof AUTH_MESSAGE; ok: boolean; error?: string };
