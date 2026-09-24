/**
 * CareerDesk — Production Structured Logger & Error Telemetry
 * =============================================================
 * Provides structured error tracking, in-memory ring buffer (last 50 events),
 * safe user-facing message translation, and crash context capture.
 */

(function () {
  class StructuredLogger {
    constructor() {
      this.maxEntries = 50;
      this.entries = [];
    }

    _format(level, message, context = {}) {
      const user = window.authManager?.getUserData?.();
      return {
        timestamp: new Date().toISOString(),
        level,
        operation: context.operation || context.op || "general",
        message: typeof message === "string" ? message : (message?.message || "Unknown error"),
        details: context.details || (message instanceof Error ? { name: message.name, code: message.code } : null),
        userId: user?.id ? `usr_${user.id.slice(0, 8)}` : "guest",
        path: window.location.pathname + window.location.search
      };
    }

    _push(entry) {
      this.entries.push(entry);
      if (this.entries.length > this.maxEntries) {
        this.entries.shift();
      }
    }

    info(message, context = {}) {
      const entry = this._format("INFO", message, context);
      this._push(entry);
    }

    warn(message, context = {}) {
      const entry = this._format("WARN", message, context);
      this._push(entry);
    }

    error(errorOrMessage, context = {}) {
      const entry = this._format("ERROR", errorOrMessage, context);
      this._push(entry);
      // Can integrate with external telemetry (e.g. Sentry / Datadog) here
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("app_telemetry_error", { detail: entry }));
      }
    }

    getRecentLogs() {
      return [...this.entries];
    }

    clearLogs() {
      this.entries = [];
    }

    /**
     * Translates technical or API errors into user-safe, friendly strings.
     * Prevents any raw internal stack traces or database errors from showing in UI.
     */
    sanitizeUserSafeMessage(err, fallback = "An unexpected error occurred. Please try again.") {
      if (!err) return fallback;
      const raw = typeof err === "string" ? err : (err.message || "");

      // Known safe messages from client-side validations
      if (raw.includes("at least 2 characters") ||
          raw.includes("valid title") ||
          raw.includes("valid link") ||
          raw.includes("reconnect")) {
        return raw;
      }

      // Offline / network failure
      if (raw.includes("Failed to fetch") || raw.includes("NetworkError") || raw.includes("offline") || !navigator.onLine) {
        return "Network connection lost. Please check your internet connection and try again.";
      }

      // Timeout
      if (raw.includes("timed out") || raw.includes("TIMEOUT") || err.name === "AbortError") {
        return "Request timed out. Please try again.";
      }

      // HTTP error codes
      if (raw.includes("400") || raw.includes("Invalid request")) {
        return "Invalid request. Please check your input and try again.";
      }
      if (raw.includes("401") || raw.includes("Unauthorized") || raw.includes("session")) {
        return "Your session has expired. Please sign in again.";
      }
      if (raw.includes("403") || raw.includes("Forbidden") || raw.includes("permission")) {
        return "You do not have permission to perform this action.";
      }
      if (raw.includes("404") || raw.includes("Not Found")) {
        return "The requested opportunity or resource was not found.";
      }
      if (raw.includes("429") || raw.includes("Too many")) {
        return "Too many requests. Please wait a moment and try again.";
      }
      if (raw.includes("500") || raw.includes("502") || raw.includes("503") || raw.includes("504") || raw.includes("Server error")) {
        return "Server error. Our engineers are looking into it. Please try again shortly.";
      }

      // If already a short clean sentence without stack trace, use it safely
      if (raw.length > 0 && raw.length < 90 && !raw.includes("Error:") && !raw.includes("at ") && !raw.includes("{")) {
        return raw;
      }

      return fallback;
    }
  }

  window.AppLogger = new StructuredLogger();
})();
