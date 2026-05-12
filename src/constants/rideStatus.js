export const RIDE_STATUS = {
  CANCELLED: "CANCELLED",
  CONFIRMED: "CONFIRMED",
  ENDED: "ENDED",
  ONGOING: "ONGOING",
};

export const RIDE_REQUEST_STATUS = {
  CANCELLED: "CANCELLED",
  CONFIRMED: "CONFIRMED",
  PENDING: "PENDING",
};

export const normalizeRideStatus = (status) => String(status || "").toUpperCase();

export const getRideStatusBadgeClass = (status) => {
  const value = normalizeRideStatus(status);

  if (value === RIDE_STATUS.ENDED) return "badge-green";
  if (value === RIDE_STATUS.CANCELLED) return "badge-red";
  if (value === RIDE_STATUS.ONGOING) return "badge-blue";
  return "badge-yellow";
};

export const getRideRequestStatusBadgeClass = (status) => {
  const value = normalizeRideStatus(status);

  if (value === RIDE_REQUEST_STATUS.CONFIRMED) return "badge-green";
  if (value === RIDE_REQUEST_STATUS.CANCELLED) return "badge-red";
  return "badge-yellow";
};

export const isRideCancelable = (status) =>
  normalizeRideStatus(status) === RIDE_STATUS.CONFIRMED;

export const isRideRateable = (status) =>
  normalizeRideStatus(status) === RIDE_STATUS.ENDED;

export const isRideOngoing = (status) =>
  normalizeRideStatus(status) === RIDE_STATUS.ONGOING;
