import { getPhoneDigits } from "../utils/phone";

const rawPhoneNumber = "1800-909090";

export const SUPPORT_CONTACT = {
  phoneDisplay: rawPhoneNumber,
  phoneDial: getPhoneDigits(rawPhoneNumber),
  email: "support@bookcar.com",
  hours: "24/7 ride support",
  sla: "Average callback in under 5 minutes for active-trip issues",
};

export const getSupportCallHref = () => `tel:${SUPPORT_CONTACT.phoneDial}`;

export const getSupportMailHref = (contextLabel = "Support request") =>
  `mailto:${SUPPORT_CONTACT.email}?subject=${encodeURIComponent(`BookCar: ${contextLabel}`)}`;
