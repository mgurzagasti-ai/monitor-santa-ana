"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
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

export default function FleetMap({
  vehicles,
  selectedDeviceId,
  lineRoutes
}: {
  vehicles: FleetVehicle[];
  selectedDeviceId: number | null;
  lineRoutes: LineRoute[];
}) {
  const mapRef = useRef<L.Map | null>(null);
  const animatedVehicles = useAnimatedVehicles(vehicles);
  const selected = animatedVehicles.find((vehicle) => vehicle.deviceId === selectedDeviceId) ?? animatedVehicles[0];
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
      <FollowPoint center={center} />
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
      {animatedVehicles.map((vehicle) => (
        <VehicleMarker key={vehicle.deviceId} vehicle={vehicle} />
      ))}
    </MapContainer>
  );
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

function FollowPoint({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}

function useVehicleIcon(vehicle: FleetVehicle) {
  return useMemo(() => {
    const label = vehicle.internalNumber?.trim() || vehicle.line;

    return L.divIcon({
      className: "",
      html: `<div style="
        width:62px;height:40px;
        position:relative;
      ">
        <div style="
          position:absolute;left:4px;top:7px;
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
          ">${label}</div>
        </div>
        <div style="position:absolute;left:12px;bottom:4px;width:10px;height:10px;border-radius:50%;background:#111827;border:2px solid #f8fafc;"></div>
        <div style="position:absolute;right:12px;bottom:4px;width:10px;height:10px;border-radius:50%;background:#111827;border:2px solid #f8fafc;"></div>
      </div>`,
      iconSize: [62, 40],
      iconAnchor: [31, 20]
    });
  }, [vehicle.internalNumber, vehicle.line]);
}

function VehicleMarker({ vehicle }: { vehicle: FleetVehicle }) {
  const icon = useVehicleIcon(vehicle);

  return (
    <Marker position={[vehicle.latitude, vehicle.longitude]} icon={icon}>
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
