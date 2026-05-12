const DEFAULT_COUNTRY_CODE = "91";

export const sanitizePhoneNumber = (value = "") => String(value).replace(/[^\d+]/g, "");

export const getPhoneDigits = (value = "") => String(value).replace(/\D/g, "");

export const toDialablePhoneNumber = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${getPhoneDigits(trimmed)}`;
  }

  const digits = getPhoneDigits(trimmed);
  if (!digits) return "";
  return digits.length === 10 ? `+${DEFAULT_COUNTRY_CODE}${digits}` : `+${digits}`;
};

export const formatPhoneNumber = (value = "") => {
  const dialable = toDialablePhoneNumber(value);
  if (!dialable) return "";

  const digits = getPhoneDigits(dialable);
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${DEFAULT_COUNTRY_CODE} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return dialable;
};

export const isValidPhoneNumber = (value = "") => {
  const digits = getPhoneDigits(value);
  return digits.length === 10 || (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE));
};

export const hasRequiredPhoneNumber = (value = "") => isValidPhoneNumber(value);
