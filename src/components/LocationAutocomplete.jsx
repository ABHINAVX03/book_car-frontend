import { useState, useEffect, useRef } from "react";

const searchCache = new Map();

export default function LocationAutocomplete({ label, placeholder, value, onSelect, isSkeleton }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  // Sync value prop to internal query if it changes externally
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!showDropdown) return;

    const cached = searchCache.get(query);
    if (cached) {
      setSuggestions(cached);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=6&addressdetails=1&countrycodes=in`,
          { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'BookCar-App/1.0',
              'Accept-Language': 'en'
            }
          }
        );
        const data = await res.json();
        const results = data || [];
        setSuggestions(results);
        searchCache.set(query, results);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [query, showDropdown]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const handleSelect = (item) => {
    setQuery(item.display_name);
    setShowDropdown(false);
    setActiveIndex(-1);
    onSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
    });
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label className="label">{label}</label>
      <input
        className={`input-field ${isSkeleton ? "skeleton-shimmer" : ""}`}
        placeholder={isSkeleton ? "" : placeholder}
        value={isSkeleton ? "" : query}
        disabled={isSkeleton}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
          onSelect(null);
        }}
        onFocus={() => {
          if (query.length >= 3) setShowDropdown(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (suggestions.length > 0 || loading) && (
        <div
          className="glass-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {loading && (
            <div style={{ padding: "12px", color: "var(--muted)", fontSize: "0.85rem", display: 'flex', alignItems: 'center', gap: 8 }}>
               <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
               Searching...
            </div>
          )}
          {!loading && suggestions.map((item, idx) => {
            const parts = item.display_name.split(',');
            const main = parts[0];
            const desc = parts.slice(1).join(',').trim();
            const isActive = idx === activeIndex;
            return (
              <div
                key={item.place_id || idx}
                className="autocomplete-item"
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: idx === suggestions.length - 1 ? "none" : "1px solid var(--surface-2)",
                  backgroundColor: isActive ? "var(--surface-2)" : "transparent",
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(item)}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)", display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>📍</span>
                  {main}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 22 }}>
                  {desc}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
