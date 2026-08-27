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
      {vehicles.map((vehicle) => (
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
    const markerColor = "#facc15";
    const course = Number(vehicle.course);
    const rotation = Number.isFinite(course) ? course : 0;

    return L.divIcon({
      className: "",
      html: `<div style="
        width:58px;height:58px;
        position:relative;
      ">
        <div style="
          position:absolute;left:50%;top:50%;
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-bottom:18px solid #111827;
          transform:translate(-50%, -50%) rotate(${rotation}deg) translateY(-27px);
          transform-origin:center 27px;
          filter:drop-shadow(0 2px 3px rgba(0,0,0,.28));
        "></div>
        <div style="
          position:absolute;inset:5px;
          display:grid;place-items:center;
          border-radius:999px;
          background:${markerColor};
          border:4px solid #ffffff;
          color:#111827;
          font:900 13px Arial,sans-serif;
          box-shadow:0 4px 12px rgba(0,0,0,.32);
          text-align:center;
          line-height:1;
        ">${label}</div>
      </div>`,
      iconSize: [58, 58],
      iconAnchor: [29, 29]
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
