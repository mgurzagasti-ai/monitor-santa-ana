"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

type FleetVehicle = {
  deviceId: number;
  label: string;
  line: string;
  color: string;
  internalNumber?: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course?: number | null;
  fixTime: string;
};

type LineRoute = {
  id: string;
  number: string;
  name: string;
  color: string;
  mapUrl: string;
  paths: [number, number][][];
};

type LineStop = {
  id: string;
  lineId: string;
  lineNumber: string;
  lineName: string;
  name: string;
  latitude: number;
  longitude: number;
  direction: "ida" | "vuelta" | "ambos";
  order?: number;
  color: string;
};

type DraftStop = {
  latitude: number;
  longitude: number;
  lineName: string;
  color: string;
};

export default function FleetMap({
  vehicles,
  selectedDeviceId,
  lineRoutes,
  lineStops,
  stopEditorEnabled,
  draftStop,
  onMapClick,
  onVehicleSelect
}: {
  vehicles: FleetVehicle[];
  selectedDeviceId: number | null;
  lineRoutes: LineRoute[];
  lineStops: LineStop[];
  stopEditorEnabled: boolean;
  draftStop: DraftStop | null;
  onMapClick: (point: { latitude: number; longitude: number }) => void;
  onVehicleSelect: (deviceId: number) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const animatedVehicles = useAnimatedVehicles(vehicles);
  const selected = vehicles.find((vehicle) => vehicle.deviceId === selectedDeviceId) ?? vehicles[0];
  const selectedFollowKey = selected?.deviceId ?? null;
  const center: [number, number] = selected ? [selected.latitude, selected.longitude] : [-24.1858, -65.2995];

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={14}
      scrollWheelZoom
      className="leaflet-container"
    >
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapSizeWatcher />
      <FollowPoint center={center} followKey={selectedFollowKey} />
      <StopClickHandler enabled={stopEditorEnabled} onMapClick={onMapClick} />
      {lineRoutes.flatMap((line) =>
        line.paths.map((path, index) => (
          <Polyline
            key={`${line.id}-${index}`}
            positions={path}
            pathOptions={{ color: line.color, weight: 4, opacity: 0.48 }}
          >
            <Tooltip sticky>
              {line.number} - {line.name}
            </Tooltip>
          </Polyline>
        ))
      )}
      {lineStops.map((stop) => (
        <StopMarker key={stop.id} stop={stop} />
      ))}
      {draftStop ? <DraftStopMarker stop={draftStop} /> : null}
      {animatedVehicles.map((vehicle) => (
        <VehicleMarker key={vehicle.deviceId} vehicle={vehicle} onSelect={onVehicleSelect} />
      ))}
    </MapContainer>
  );
}

function StopClickHandler({
  enabled,
  onMapClick
}: {
  enabled: boolean;
  onMapClick: (point: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onMapClick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    }
  });

  return null;
}

function useAnimatedVehicles(vehicles: FleetVehicle[]) {
  const [displayedVehicles, setDisplayedVehicles] = useState(vehicles);
  const displayedRef = useRef(vehicles);
  const targetRef = useRef(vehicles);

  useEffect(() => {
    targetRef.current = vehicles;

    if (displayedRef.current.length === 0) {
      displayedRef.current = vehicles;
      setDisplayedVehicles(vehicles);
      return;
    }

    const starts = displayedRef.current;
    const startedAt = performance.now();
    const duration = animationDuration(starts, vehicles);
    let frame = 0;

    if (duration === 0) {
      displayedRef.current = vehicles;
      setDisplayedVehicles(vehicles);
      return;
    }

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVehicles = targetRef.current.map((target) => {
        const start = starts.find((vehicle) => vehicle.deviceId === target.deviceId);
        if (!start) return target;

        return {
          ...target,
          latitude: start.latitude + (target.latitude - start.latitude) * eased,
          longitude: start.longitude + (target.longitude - start.longitude) * eased
        };
      });

      displayedRef.current = nextVehicles;
      setDisplayedVehicles(nextVehicles);

      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [vehicles]);

  return displayedVehicles;
}

function animationDuration(starts: FleetVehicle[], targets: FleetVehicle[]) {
  const movingTargets = targets.filter((target) => target.speedKmh >= 3);
  if (movingTargets.length === 0) return 0;

  const durations = movingTargets.map((target) => {
    const start = starts.find((vehicle) => vehicle.deviceId === target.deviceId);
    if (!start) return 0;

    const reportDeltaMs = new Date(target.fixTime).getTime() - new Date(start.fixTime).getTime();
    const distance = distanceMeters(start.latitude, start.longitude, target.latitude, target.longitude);
    if (!Number.isFinite(distance) || distance < 3 || distance > 1500) return 0;
    if (!Number.isFinite(reportDeltaMs) || reportDeltaMs <= 0) return 15000;
    return Math.min(30000, Math.max(8000, reportDeltaMs));
  });

  return Math.max(...durations, 0);
}

function distanceMeters(startLat: number, startLon: number, endLat: number, endLon: number) {
  const earthRadius = 6371000;
  const lat1 = (startLat * Math.PI) / 180;
  const lat2 = (endLat * Math.PI) / 180;
  const deltaLat = ((endLat - startLat) * Math.PI) / 180;
  const deltaLon = ((endLon - startLon) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapSizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const refreshSize = () => map.invalidateSize({ animate: false });
    const timers = [0, 120, 260, 520].map((delay) => window.setTimeout(refreshSize, delay));
    window.addEventListener("resize", refreshSize);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", refreshSize);
    };
  }, [map]);

  return null;
}

function FollowPoint({ center, followKey }: { center: [number, number]; followKey: number | null }) {
  const map = useMap();
  const isUserInteractingRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const pauseFollow = () => {
      isUserInteractingRef.current = true;
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
    const resumeFollowSoon = () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      resumeTimerRef.current = window.setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 2500);
    };

    map.on("dragstart", pauseFollow);
    map.on("zoomstart", pauseFollow);
    map.on("dragend", resumeFollowSoon);
    map.on("zoomend", resumeFollowSoon);

    return () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      map.off("dragstart", pauseFollow);
      map.off("zoomstart", pauseFollow);
      map.off("dragend", resumeFollowSoon);
      map.off("zoomend", resumeFollowSoon);
    };
  }, [map]);

  useEffect(() => {
    if (isUserInteractingRef.current) return;
    map.invalidateSize({ animate: false });
    map.setView(center, map.getZoom(), { animate: false });
  }, [center[0], center[1], followKey, map]);

  return null;
}

function StopMarker({ stop }: { stop: LineStop }) {
  return (
    <CircleMarker
      center={[stop.latitude, stop.longitude]}
      radius={7}
      pathOptions={{
        color: "#ffffff",
        fillColor: stop.color,
        fillOpacity: 0.95,
        opacity: 1,
        weight: 2
      }}
    >
      <Tooltip sticky>
        Parada {stop.lineNumber} - {stop.name}
      </Tooltip>
      <Popup>
        <strong>{stop.name}</strong>
        <br />
        {stop.lineName || `Linea ${stop.lineNumber}`}
        <br />
        Sentido: {formatDirection(stop.direction)}
      </Popup>
    </CircleMarker>
  );
}

function DraftStopMarker({ stop }: { stop: DraftStop }) {
  return (
    <CircleMarker
      center={[stop.latitude, stop.longitude]}
      radius={9}
      pathOptions={{
        color: "#111827",
        dashArray: "4 4",
        fillColor: stop.color,
        fillOpacity: 0.8,
        opacity: 1,
        weight: 2
      }}
    >
      <Tooltip sticky>Nueva parada - {stop.lineName}</Tooltip>
      <Popup>
        <strong>Nueva parada</strong>
        <br />
        {stop.lineName}
      </Popup>
    </CircleMarker>
  );
}

function useVehicleIcon(vehicle: FleetVehicle) {
  return useMemo(() => {
    const label = escapeHtml(vehicle.internalNumber?.trim() || vehicle.line);
    const course = Number(vehicle.course);
    const hasCourse = Number.isFinite(course);
    const rotation = hasCourse ? course - 90 : 0;

    return L.divIcon({
      className: "",
      html: `<div style="
        width:74px;height:54px;
        position:relative;
      ">
        <div style="
          position:absolute;left:4px;top:7px;
          width:66px;height:40px;
          transform:rotate(${rotation}deg);
          transform-origin:center;
          transition:transform .25s ease;
        ">
          <div style="
            position:absolute;right:-6px;top:11px;
            width:0;height:0;
            border-top:9px solid transparent;
            border-bottom:9px solid transparent;
            border-left:14px solid #111827;
            filter:drop-shadow(0 2px 4px rgba(0,0,0,.28));
          "></div>
          <div style="
            position:absolute;left:4px;top:8px;
            width:54px;height:24px;border-radius:7px 9px 6px 6px;
            background:#facc15;
            border:2px solid #ffffff;
            box-shadow:0 4px 12px rgba(0,0,0,.3);
          ">
            <div style="
              position:absolute;inset:0;
              display:grid;place-items:center;
              color:#111827;
              font:900 13px Arial,sans-serif;
              transform:rotate(${-rotation}deg);
              transform-origin:center;
            ">${label}</div>
          </div>
          <div style="position:absolute;left:12px;bottom:7px;width:10px;height:10px;border-radius:50%;background:#111827;border:2px solid #f8fafc;"></div>
          <div style="position:absolute;right:12px;bottom:7px;width:10px;height:10px;border-radius:50%;background:#111827;border:2px solid #f8fafc;"></div>
          <div style="
            position:absolute;right:1px;top:16px;
            width:8px;height:8px;border-radius:999px;
            background:#ffffff;border:2px solid #111827;
          "></div>
        </div>
      </div>`,
      iconSize: [74, 54],
      iconAnchor: [37, 27]
    });
  }, [vehicle.course, vehicle.internalNumber, vehicle.line]);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDirection(direction: LineStop["direction"]) {
  if (direction === "ambos") return "ida y vuelta";
  return direction;
}

function VehicleMarker({ vehicle, onSelect }: { vehicle: FleetVehicle; onSelect: (deviceId: number) => void }) {
  const icon = useVehicleIcon(vehicle);

  return (
    <Marker
      position={[vehicle.latitude, vehicle.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(vehicle.deviceId)
      }}
    >
      <Popup>
        <strong>{vehicle.label}</strong>
        <br />
        Linea {vehicle.line}
        <br />
        {Math.round(vehicle.speedKmh)} km/h
      </Popup>
    </Marker>
  );
}
