import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const createIcon = (color, emoji) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="
    background-color: ${color};
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    border: 2px solid white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(-45deg);
    margin-top: -32px;
    margin-left: -16px;
  ">
    <span style="transform: rotate(45deg); font-size: 16px;">${emoji}</span>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const pickupIcon = createIcon('#6366f1', '📍');
const dropIcon = createIcon('#ef4444', '🏁');
const driverIcon = createIcon('#e8ff47', '🚗');

// Component to handle map view updates
function ChangeView({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [bounds, map]);
  return null;
}

export default function RideMap({ pickup, drop, driver, style, className }) {
  const pickupPos = useMemo(() => pickup?.lat && pickup?.lng ? [pickup.lat, pickup.lng] : null, [pickup]);
  const dropPos = useMemo(() => drop?.lat && drop?.lng ? [drop.lat, drop.lng] : null, [drop]);
  const driverPos = useMemo(() => driver?.lat && driver?.lng ? [driver.lat, driver.lng] : null, [driver]);

  const bounds = useMemo(() => {
    const points = [pickupPos, dropPos, driverPos].filter(Boolean);
    if (points.length === 0) return null;
    return points;
  }, [pickupPos, dropPos, driverPos]);

  const center = pickupPos || dropPos || driverPos || [28.6139, 77.2090]; // Delhi default

  return (
    <div className={`glass-panel ${className || ''}`} style={{ 
      borderRadius: '20px', 
      overflow: 'hidden', 
      width: '100%', 
      height: '100%', 
      position: 'relative',
      border: '1px solid var(--premium-border)',
      boxShadow: 'var(--shadow-lg)',
      ...style 
    }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {pickupPos && (
          <Marker position={pickupPos} icon={pickupIcon}>
            <Popup>Pickup: {pickup.address || 'Point A'}</Popup>
          </Marker>
        )}
        
        {dropPos && (
          <Marker position={dropPos} icon={dropIcon}>
            <Popup>Drop-off: {drop.address || 'Point B'}</Popup>
          </Marker>
        )}

        {driverPos && (
          <Marker position={driverPos} icon={driverIcon}>
            <Popup>Driver is here</Popup>
          </Marker>
        )}

        {pickupPos && dropPos && (
          <Polyline 
            positions={[pickupPos, dropPos]} 
            color="var(--brand)" 
            weight={4} 
            opacity={0.6}
            dashArray="10, 10"
          />
        )}

        {bounds && <ChangeView bounds={bounds} />}
      </MapContainer>
    </div>
  );
}
