export const formatId = (prefix, id) => {
  if (!id) return `${prefix}-XXXX`;
  const numId = Number(id);
  if (isNaN(numId)) return `${prefix}-${id}`;
  
  // Deterministic obfuscation to create a linear sequence string
  const obfuscated = ((numId * 31337) + 104729).toString(36).toUpperCase();
  // Pad if too short, or just return subset
  const result = (obfuscated + "XXXXXX").slice(0, 6);
  return `${prefix}-${result}`;
};

export const formatRideId = (id) => formatId('TRP', id);
export const formatDriverId = (id) => formatId('DRV', id);
export const formatRiderId = (id) => formatId('RDR', id);
