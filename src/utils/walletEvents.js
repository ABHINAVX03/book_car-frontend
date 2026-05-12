const RIDER_WALLET_UPDATED_EVENT = "bookcar:rider-wallet-updated";

export const riderWalletUpdatedEventName = RIDER_WALLET_UPDATED_EVENT;

export const notifyRiderWalletUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RIDER_WALLET_UPDATED_EVENT));
  }
};
