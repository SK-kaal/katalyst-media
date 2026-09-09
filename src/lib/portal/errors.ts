/** User-facing error messages — never expose raw stack/API dumps. */

export function toUserError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;

  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  const message = raw.trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("abort")
  ) {
    return "Connection lost. Please check your internet connection and try again.";
  }

  if (lower.includes("unauthor") || lower.includes("jwt") || lower.includes("session")) {
    return "Your session expired. Please sign in again.";
  }

  if (lower.includes("duplicate") || lower.includes("already in the campaign") || lower.includes("23505")) {
    return "This TikTok post is already in the campaign.";
  }

  if (lower.includes("valid tiktok") || lower.includes("doesn't appear")) {
    return message;
  }

  if (lower.includes("couldn't retrieve") || lower.includes("could not retrieve")) {
    return "We couldn't retrieve this TikTok post. Retry or enter details manually.";
  }

  if (lower.includes("upload") || lower.includes("storage")) {
    return "File could not be uploaded. Please try again.";
  }

  if (lower.includes("profile picture") || lower.includes("name is required") || lower.includes("budget")) {
    return message;
  }

  // Hide Postgres / Supabase internals
  if (
    lower.includes("violates") ||
    lower.includes("permission denied") ||
    lower.includes("row-level") ||
    lower.includes("pgrst") ||
    lower.includes("json") ||
    /column .* does not exist/i.test(message)
  ) {
    return "Something went wrong while saving. Please try again.";
  }

  // Keep short known messages
  if (message.length <= 140 && !message.includes("{") && !message.includes("\n")) {
    return message;
  }

  return fallback;
}
