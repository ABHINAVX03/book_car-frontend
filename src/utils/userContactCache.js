const PHONE_CACHE_KEY = "bookcar-phone-cache";

const readCache = () => {
  try {
    const raw = localStorage.getItem(PHONE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeCache = (cache) => {
  localStorage.setItem(PHONE_CACHE_KEY, JSON.stringify(cache));
};

export const getCachedPhoneNumber = (email = "") => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return "";
  return readCache()[normalizedEmail] || "";
};

export const cachePhoneNumber = (email = "", phoneNumber = "") => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phoneNumber || "").trim();
  if (!normalizedEmail || !normalizedPhone) return;

  const cache = readCache();
  cache[normalizedEmail] = normalizedPhone;
  writeCache(cache);
};
