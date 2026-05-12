const looksLikeEmailIssue = (message) =>
  /email|username|user not found|no user/i.test(message);

const looksLikePasswordIssue = (message) =>
  /password|bad credentials|invalid credentials|incorrect/i.test(message);

export function getFriendlyAuthError(error, fallbackTitle = "We couldn't complete that request") {
  const rawMessage = error?.message || "";
  const normalized = rawMessage.toLowerCase();

  if (!navigator.onLine) {
    return {
      title: "You're offline",
      description: "Reconnect to the internet and try again.",
      type: "error",
    };
  }

  if (error?.status === 401 || looksLikeEmailIssue(normalized) || looksLikePasswordIssue(normalized)) {
    return {
      title: "Incorrect email or password",
      description: "Double-check your details and try signing in again.",
      type: "error",
    };
  }

  if (normalized.includes("jwt") || normalized.includes("token") || normalized.includes("session")) {
    return {
      title: "Your session has expired",
      description: "Please sign in again to keep going.",
      type: "error",
    };
  }

  if (error?.status >= 500 || normalized.includes("internal server") || normalized.includes("http 500")) {
    return {
      title: "Our server is having a moment",
      description: "Please try again in a few seconds.",
      type: "error",
    };
  }

  if (error?.status === 409 || normalized.includes("already exists") || normalized.includes("duplicate")) {
    return {
      title: "That account already exists",
      description: "Try signing in instead, or use a different email address.",
      type: "error",
    };
  }

  if (error?.status === 403 || normalized.includes("access denied") || normalized.includes("forbidden")) {
    return {
      title: "You don't have access to that action",
      description: "Sign in with the right account or try again later.",
      type: "error",
    };
  }

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("network request failed")) {
    return {
      title: "We couldn't reach the server",
      description: "Check that the backend is running and try again.",
      type: "error",
    };
  }

  return {
    title: fallbackTitle,
    description: rawMessage || "Please try again.",
    type: "error",
  };
}
