import { useState, useEffect } from "react";

// Global cache and queue for reverse geocoding to avoid rate limits
const cache = new Map();
const requestQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const { lat, lon, resolve } = requestQueue.shift();
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    if (cache.has(key)) {
      resolve(cache.get(key));
      continue;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await res.json();
      const address = data.display_name
        ? data.display_name.split(",").slice(0, 3).join(",") // keep it short and descriptive
        : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      cache.set(key, address);
      resolve(address);
    } catch (e) {
      resolve(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }

    // Nominatim allows 1 request per second max
    await new Promise((r) => setTimeout(r, 1100));
  }

  isProcessingQueue = false;
};

const getReverseGeocode = (lat, lon) => {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  return new Promise((resolve) => {
    requestQueue.push({ lat, lon, resolve });
    processQueue();
  });
};

export default function LocationName({ coords, fallbackText }) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If we have a fallback text provided (like from the active form state), just show it instantly
    if (fallbackText) {
      setAddress(fallbackText);
      setLoading(false);
      return;
    }

    if (!coords || coords.length < 2) {
      setAddress("—");
      setLoading(false);
      return;
    }

    const lon = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);

    if (isNaN(lat) || isNaN(lon)) {
      setAddress("—");
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getReverseGeocode(lat, lon).then((res) => {
      if (isMounted) {
        setAddress(res);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [coords, fallbackText]);

  if (loading) {
    return <span className="skeleton-shimmer" style={{ display: 'inline-block', width: 140, height: 14, borderRadius: 4, verticalAlign: 'middle', marginTop: 2 }} />;
  }

  return <span className="location-name">{address}</span>;
}
