"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Season, TripStatus } from "@prisma/client";
import * as maplibregl from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

// ─── Season colors (must match CSS vars, but we need raw hex for GL) ─────────

const SEASON_HEX: Record<Season, string> = {
  SNOW: "#7FA6C9",
  SURF: "#2C8FA3",
  EASTER: "#A9C46C",
  CHRISTMAS: "#9C3B3B",
  NYE: "#4B3F8C",
  SUMMER: "#E8A93B",
  CITY: "#8A7F72",
  OTHER: "#8A7F72",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MapTrip {
  id: string;
  title: string;
  season: Season;
  status: TripStatus;
  lat: number;
  lng: number;
  coverUrl: string | null;
  startDate: string;
  endDate: string;
  captainName: string;
  goingCount: number;
}

interface TripMapProps {
  trips: MapTrip[];
  onPinClick?: (tripId: string) => void;
}

// ─── Muted map style (paper-colored land) ────────────────────────────────────

function buildStyle(key: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    name: "Family Trips",
    sources: {
      openmaptiles: {
        type: "vector",
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
      },
    },
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#E8DFD0" },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": "#C5D5D8", "fill-opacity": 0.6 },
      },
      {
        id: "landcover",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        paint: { "fill-color": "#E2DAC8", "fill-opacity": 0.3 },
      },
      {
        id: "landuse",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        paint: { "fill-color": "#DDD5C3", "fill-opacity": 0.25 },
      },
      {
        id: "boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["==", "admin_level", 2],
        paint: {
          "line-color": "#C4B99B",
          "line-width": 0.8,
          "line-dasharray": [4, 2],
        },
      },
      {
        id: "road-motorway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        paint: {
          "line-color": "#D4CBBA",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 12, 1.5],
        },
      },
      {
        id: "road-main",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "secondary", "trunk"],
        paint: {
          "line-color": "#D9CFBA",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.3, 14, 1],
        },
        minzoom: 7,
      },
      {
        id: "place-country",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", "class", "country"],
        layout: {
          "text-field": "{name:latin}",
          "text-font": ["Open Sans Bold"],
          "text-size": 11,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.15,
        },
        paint: {
          "text-color": "#8A7F72",
          "text-halo-color": "#F6F1E7",
          "text-halo-width": 1.5,
        },
        minzoom: 2,
        maxzoom: 7,
      },
      {
        id: "place-city",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", "class", "city"],
        layout: {
          "text-field": "{name:latin}",
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 12, 14],
        },
        paint: {
          "text-color": "#6B6155",
          "text-halo-color": "#F6F1E7",
          "text-halo-width": 1.2,
        },
        minzoom: 5,
      },
    ],
  } as maplibregl.StyleSpecification;
}

// ─── Date formatter ──────────────────────────────────────────────────────────

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-GB", opts);
  const endStr = e.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TripMap({ trips, onPinClick }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  const tripsJson = JSON.stringify(trips);

  const initMap = useCallback(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(key),
      center: [10, 45],
      zoom: 3,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const parsed: MapTrip[] = JSON.parse(tripsJson);

      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: parsed.map((t) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
          properties: {
            id: t.id,
            title: t.title,
            season: t.season,
            status: t.status,
            coverUrl: t.coverUrl ?? "",
            startDate: t.startDate,
            endDate: t.endDate,
            captainName: t.captainName,
            goingCount: t.goingCount,
            color: SEASON_HEX[t.season] ?? SEASON_HEX.OTHER,
          },
        })),
      };

      map.addSource("trips", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Cluster circles
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "trips",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#8A7F72",
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#F6F1E7",
        },
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "trips",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#F6F1E7" },
      });

      // Individual trip pins
      map.addLayer({
        id: "trip-pins",
        type: "circle",
        source: "trips",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 7,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#F6F1E7",
        },
      });

      // Shadow under pins
      map.addLayer(
        {
          id: "trip-pin-shadow",
          type: "circle",
          source: "trips",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "rgba(0,0,0,0.12)",
            "circle-radius": 9,
            "circle-blur": 1,
            "circle-translate": [0, 2],
          },
        },
        "trip-pins",
      );

      // Click cluster to zoom in
      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0]?.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        const source = map.getSource("trips") as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coords = (features[0]?.geometry as Point).coordinates;
        map.easeTo({ center: [coords[0]!, coords[1]!], zoom });
      });

      // Click trip pin — popup
      map.on("click", "trip-pins", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties;
        const coords = (feature.geometry as Point).coordinates.slice() as [number, number];

        if (popupRef.current) popupRef.current.remove();

        const coverHtml = props.coverUrl
          ? `<img src="${props.coverUrl}" alt="" style="width:100%;height:100px;object-fit:cover;border-radius:2px;margin-bottom:8px;" />`
          : `<div style="width:100%;height:60px;background:var(--paper-2);border-radius:2px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:var(--text-soft);font-style:italic;font-size:12px;">No photo</div>`;

        const html = `
          <div style="font-family:var(--font-hanken),system-ui,sans-serif;min-width:180px;max-width:220px;">
            ${coverHtml}
            <div style="font-family:var(--font-instrument),Georgia,serif;font-size:16px;line-height:1.2;margin-bottom:4px;color:var(--ink);">${props.title}</div>
            <div style="font-family:var(--font-dm-mono),monospace;font-size:11px;color:var(--text-soft);letter-spacing:0.04em;margin-bottom:4px;">${formatRange(props.startDate as string, props.endDate as string)}</div>
            <div style="font-size:12px;color:var(--text-soft);">${props.captainName as string} &middot; ${props.goingCount as number} going</div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: "240px" })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);

        popupRef.current = popup;

        onPinClickRef.current?.(props.id as string);
      });

      // Cursor style
      map.on("mouseenter", "trip-pins", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "trip-pins", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      // Fit bounds if there are trips
      if (parsed.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        parsed.forEach((t) => bounds.extend([t.lng, t.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 10 });
      }
    });

    mapRef.current = map;
  }, [tripsJson]);

  // Update data when trips change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("trips") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const parsed: MapTrip[] = JSON.parse(tripsJson);
    const geojson: FeatureCollection = {
      type: "FeatureCollection",
      features: parsed.map((t) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
        properties: {
          id: t.id,
          title: t.title,
          season: t.season,
          status: t.status,
          coverUrl: t.coverUrl ?? "",
          startDate: t.startDate,
          endDate: t.endDate,
          captainName: t.captainName,
          goingCount: t.goingCount,
          color: SEASON_HEX[t.season] ?? SEASON_HEX.OTHER,
        },
      })),
    };
    source.setData(geojson);
  }, [tripsJson]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        borderRadius: "2px",
        border: "1px solid var(--border)",
      }}
    />
  );
}
