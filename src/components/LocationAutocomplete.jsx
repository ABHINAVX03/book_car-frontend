import { useState, useEffect, useRef } from "react";

export default function LocationAutocomplete({ label, placeholder, value, onSelect, isSkeleton }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  }, [value]);

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

    // Only search if the dropdown is open (implies the user is typing, not just selected)
    if (!showDropdown) return;

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=6&addressdetails=1&countrycodes=in`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(data || []);
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

  const handleSelect = (item) => {
    setQuery(item.display_name);
    setShowDropdown(false);
    onSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
    });
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
          // If the user modifies the text, they unselect the previous location
          onSelect(null);
        }}
        onFocus={() => {
          if (query.length >= 3) setShowDropdown(true);
        }}
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
            return (
              <div
                key={item.place_id || idx}
                className="autocomplete-item"
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: idx === suggestions.length - 1 ? "none" : "1px solid var(--surface-2)",
                }}
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
