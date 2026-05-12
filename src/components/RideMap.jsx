export default function RideMap({ pickup, drop, style, className }) {
  // If no pickup or drop is provided, show a default map of New Delhi
  const mapSrc = (pickup && drop) 
    ? `https://www.google.com/maps?saddr=${pickup.lat},${pickup.lng}&daddr=${drop.lat},${drop.lng}&output=embed`
    : pickup 
      ? `https://maps.google.com/maps?q=${pickup.lat},${pickup.lng}&hl=en&z=14&output=embed`
      : drop
        ? `https://maps.google.com/maps?q=${drop.lat},${drop.lng}&hl=en&z=14&output=embed`
        : `https://maps.google.com/maps?q=New+Delhi&hl=en&z=11&output=embed`;

  return (
    <div className={`glass-panel ${className || ''}`} style={{ borderRadius: '16px', overflow: 'hidden', width: '100%', height: '100%', position: 'relative', ...style }}>
      <iframe 
        width="100%" 
        height="100%" 
        style={{ border: 0, filter: 'contrast(1.1) brightness(0.9)' }} 
        loading="lazy" 
        allowFullScreen 
        src={mapSrc}
      />
    </div>
  );
}
