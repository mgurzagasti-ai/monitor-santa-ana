"use client";

import dynamic from "next/dynamic";
import { Activity, Battery, Clock, Eye, EyeOff, Gauge, Map, MapPin, PanelLeftClose, PanelLeftOpen, Plus, Power, RefreshCcw, Save, Satellite, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

const FleetMap = dynamic(() => import("./ui/FleetMap"), { ssr: false });
const selectedDeviceStorageKey = "santaAnaSelectedDeviceId";

type FleetVehicle = {
  deviceId: number;
  label: string;
  line: string;
  color: string;
  internalNumber?: string;
  assignedLineId?: string;
  assignedLineName?: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course?: number | null;
  fixTime: string;
  gps?: {
    status: string;
    valid: boolean;
    fresh: boolean;
    moving: boolean;
    motion: boolean | null;
    ignition: boolean | null;
    power: number | null;
    battery: number | null;
    satellites: number | null;
    distance: number | null;
    ageSeconds: number | null;
  };
};

type FleetResponse = {
  vehicles: FleetVehicle[];
  updatedAt: string;
  error?: string;
};

type LineRoute = {
  id: string;
  number: string;
  name: string;
  color: string;
  mapUrl: string;
  paths: [number, number][][];
  error?: string;
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

type VehicleAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
};

type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status?: string;
};

type DeviceDraft = {
  deviceId: string;
  internalNumber: string;
  assignedLineId: string;
};

type StopDraft = {
  name: string;
  lineId: string;
  direction: LineStop["direction"];
  order: string;
  latitude: number | null;
  longitude: number | null;
};

export default function Home() {
  const [fleet, setFleet] = useState<FleetResponse>({ vehicles: [], updatedAt: "" });
  const [lineRoutes, setLineRoutes] = useState<LineRoute[]>([]);
  const [lineStops, setLineStops] = useState<LineStop[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [traccarDevices, setTraccarDevices] = useState<TraccarDevice[]>([]);
  const [deviceManagerOpen, setDeviceManagerOpen] = useState(false);
  const [deviceDraft, setDeviceDraft] = useState<DeviceDraft>({ deviceId: "", internalNumber: "", assignedLineId: "" });
  const syncedMonitorDevicesRef = useRef("");
  const [deviceMessage, setDeviceMessage] = useState("");
  const [showLineRoutes, setShowLineRoutes] = useState(true);
  const [showLineStops, setShowLineStops] = useState(true);
  const [stopEditorOpen, setStopEditorOpen] = useState(false);
  const [savingStop, setSavingStop] = useState(false);
  const [stopMessage, setStopMessage] = useState("");
  const [selectedLineRouteIds, setSelectedLineRouteIds] = useState<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [internalDraft, setInternalDraft] = useState("");
  const [stopDraft, setStopDraft] = useState<StopDraft>({
    name: "",
    lineId: "",
    direction: "ambos",
    order: "",
    latitude: null,
    longitude: null
  });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingDevice, setSavingDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedVehicle = useMemo(() => {
    return fleet.vehicles.find((vehicle) => vehicle.deviceId === selectedDeviceId) ?? fleet.vehicles[0] ?? null;
  }, [fleet.vehicles, selectedDeviceId]);

  const lineRoutesWithPaths = useMemo(() => {
    return lineRoutes.filter((line) => line.paths.length > 0);
  }, [lineRoutes]);

  const visibleLineRoutes = useMemo(() => {
    if (!showLineRoutes) return [];
    if (selectedLineRouteIds.length === 0) return lineRoutesWithPaths;
    return lineRoutesWithPaths.filter((line) => selectedLineRouteIds.includes(line.id));
  }, [lineRoutesWithPaths, selectedLineRouteIds, showLineRoutes]);

  const visibleLineStops = useMemo(() => {
    if (!showLineStops) return [];
    if (selectedLineRouteIds.length === 0) return lineStops;
    return lineStops.filter((stop) => selectedLineRouteIds.includes(stop.lineId));
  }, [lineStops, selectedLineRouteIds, showLineStops]);

  const selectedVehicleStops = useMemo(() => {
    if (!selectedVehicle?.assignedLineId) return [];
    return lineStops
      .filter((stop) => stop.lineId === selectedVehicle.assignedLineId)
      .map((stop) => ({
        ...stop,
        distanceMeters: distanceMeters(selectedVehicle.latitude, selectedVehicle.longitude, stop.latitude, stop.longitude)
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 4);
  }, [lineStops, selectedVehicle]);

  const selectedAssignment = useMemo(() => {
    if (!selectedVehicle) return null;
    return assignments.find((assignment) => assignment.deviceId === selectedVehicle.deviceId) ?? null;
  }, [assignments, selectedVehicle]);

  const selectedStopLine = useMemo(() => {
    return lineRoutes.find((line) => line.id === stopDraft.lineId) ?? lineRoutesWithPaths[0] ?? null;
  }, [lineRoutes, lineRoutesWithPaths, stopDraft.lineId]);

  const editableLineStops = useMemo(() => {
    if (!selectedStopLine) return [];
    return lineStops
      .filter((stop) => stop.lineId === selectedStopLine.id)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
  }, [lineStops, selectedStopLine]);

  const draftStopMarker = useMemo(() => {
    if (!stopEditorOpen || !selectedStopLine || stopDraft.latitude == null || stopDraft.longitude == null) return null;
    return {
      latitude: stopDraft.latitude,
      longitude: stopDraft.longitude,
      lineName: selectedStopLine.name,
      color: selectedStopLine.color
    };
  }, [selectedStopLine, stopDraft.latitude, stopDraft.longitude, stopEditorOpen]);

  function selectVehicle(deviceId: number | null) {
    setSelectedDeviceId(deviceId);
    saveSelectedDeviceId(deviceId);
  }

  function toggleLineRoute(lineId: string) {
    setSelectedLineRouteIds((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]
    );
  }

  function editLineRoute(lineId: string) {
    setStopEditorOpen(true);
    setStopMessage("Hace clic en el mapa para ubicar la parada.");
    updateStopLine(lineId);
  }

  function updateStopLine(lineId: string) {
    setStopDraft((current) => ({ ...current, lineId }));
    setShowLineRoutes(true);
    setShowLineStops(true);
    setSelectedLineRouteIds([lineId]);
  }

  function openStopEditor() {
    const lineId = stopDraft.lineId || selectedVehicle?.assignedLineId || selectedLineRouteIds[0] || lineRoutesWithPaths[0]?.id || "";
    setStopEditorOpen(true);
    setShowLineStops(true);
    setStopMessage(lineId ? "Hace clic en el mapa para ubicar la parada." : "Primero tiene que cargar un recorrido de linea.");
    if (lineId) {
      updateStopLine(lineId);
    }
  }

  function closeStopEditor() {
    setStopEditorOpen(false);
    setStopMessage("");
  }

  function handleStopMapClick(point: { latitude: number; longitude: number }) {
    if (!stopEditorOpen) return;
    setStopDraft((current) => ({
      ...current,
      latitude: point.latitude,
      longitude: point.longitude
    }));
    setStopMessage("Punto marcado. Completa el nombre y guarda la parada.");
  }

  async function saveStop() {
    if (!stopDraft.lineId || stopDraft.latitude == null || stopDraft.longitude == null || !stopDraft.name.trim()) {
      setStopMessage("Falta linea, nombre o ubicacion en el mapa.");
      return;
    }

    setSavingStop(true);
    try {
      const response = await fetch("/api/line-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId: stopDraft.lineId,
          name: stopDraft.name,
          latitude: stopDraft.latitude,
          longitude: stopDraft.longitude,
          direction: stopDraft.direction,
          order: stopDraft.order ? Number(stopDraft.order) : undefined
        })
      });
      const data = (await response.json()) as { stops?: LineStop[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la parada");
      setLineStops(data.stops ?? []);
      setStopDraft((current) => ({
        ...current,
        name: "",
        order: "",
        latitude: null,
        longitude: null
      }));
      setStopMessage("Parada guardada.");
    } catch (error) {
      setStopMessage(error instanceof Error ? error.message : "No se pudo guardar la parada");
    } finally {
      setSavingStop(false);
    }
  }

  async function deleteStop(stopId: string) {
    setSavingStop(true);
    try {
      const response = await fetch(`/api/line-stops?id=${encodeURIComponent(stopId)}`, { method: "DELETE" });
      const data = (await response.json()) as { stops?: LineStop[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo borrar la parada");
      setLineStops(data.stops ?? []);
      setStopMessage("Parada borrada.");
    } catch (error) {
      setStopMessage(error instanceof Error ? error.message : "No se pudo borrar la parada");
    } finally {
      setSavingStop(false);
    }
  }

  async function saveAssignment(nextLineId: string, nextInternalNumber = internalDraft) {
    if (!selectedVehicle) return;

    const internalNumber = nextInternalNumber.trim() || selectedVehicle.internalNumber || selectedAssignment?.internalNumber || "";
    if (!internalNumber) return;

    setSavingAssignment(true);
    try {
      const monitorDevices = readMonitorDevices();
      const monitorDevice = monitorDevices.find((device) => device.deviceId === selectedVehicle.deviceId);

      if (monitorDevice) {
        const nextMonitorDevice = {
          ...monitorDevice,
          internalNumber,
          assignedLineId: nextLineId
        };
        const response = await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextMonitorDevice)
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el GPS");

        const nextDevices = upsertMonitorDevice(nextMonitorDevice);
        setAssignments(nextDevices.map((device) => ({
          deviceId: device.deviceId,
          internalNumber: device.internalNumber,
          label: `Colectivo ${device.internalNumber}`,
          assignedLineId: device.assignedLineId
        })));
      } else {
        const response = await fetch("/api/assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: selectedVehicle.deviceId,
            internalNumber,
            label: `Colectivo ${internalNumber}`,
            assignedLineId: nextLineId
          })
        });

        const data = (await response.json()) as { assignments?: VehicleAssignment[] };
        if (data.assignments) {
          setAssignments(data.assignments);
        }
      }

      await loadFleet();
    } finally {
      setSavingAssignment(false);
    }
  }

  async function syncMonitorDevices(monitorDevices: ReturnType<typeof readMonitorDevices>) {
    if (monitorDevices.length === 0) return;

    const syncKey = JSON.stringify(monitorDevices.map((device) => ({
      deviceId: device.deviceId,
      internalNumber: device.internalNumber,
      assignedLineId: device.assignedLineId
    })));
    if (syncedMonitorDevicesRef.current === syncKey) return;

    await Promise.all(monitorDevices.map((device) => fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(device)
    })));
    syncedMonitorDevicesRef.current = syncKey;
  }

  async function loadFleet() {
    setLoading(true);
    try {
      const monitorDevices = readMonitorDevices();
      await syncMonitorDevices(monitorDevices).catch(() => null);
      const url = monitorDevices.length > 0
        ? `/api/monitor-fleet?devices=${encodeURIComponent(JSON.stringify(monitorDevices))}`
        : "/api/fleet";
      const response = await fetch(url, { cache: "no-store" });
      const data = (await response.json()) as FleetResponse;
      setFleet(data);
      setSelectedDeviceId((currentDeviceId) => {
        const storedDeviceId = readSelectedDeviceId();
        const preferredDeviceId = currentDeviceId ?? storedDeviceId;
        if (preferredDeviceId && data.vehicles.some((vehicle) => vehicle.deviceId === preferredDeviceId)) {
          saveSelectedDeviceId(preferredDeviceId);
          return preferredDeviceId;
        }

        const fallbackDeviceId = data.vehicles[0]?.deviceId ?? null;
        saveSelectedDeviceId(fallbackDeviceId);
        return fallbackDeviceId;
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadLineRoutes() {
    const response = await fetch("/api/line-routes", { cache: "no-store" });
    const data = (await response.json()) as { routes: LineRoute[] };
    setLineRoutes(data.routes ?? []);
  }

  async function loadLineStops() {
    const response = await fetch("/api/line-stops", { cache: "no-store" });
    const data = (await response.json()) as { stops: LineStop[] };
    setLineStops(data.stops ?? []);
  }

  async function loadAssignments() {
    const localAssignments = readMonitorDevices().map((device) => ({
      deviceId: device.deviceId,
      internalNumber: device.internalNumber,
      label: `Colectivo ${device.internalNumber}`,
      assignedLineId: device.assignedLineId
    }));
    if (localAssignments.length > 0) {
      setAssignments(localAssignments);
      return;
    }

    const response = await fetch("/api/assignments", { cache: "no-store" });
    const data = (await response.json()) as { assignments: VehicleAssignment[] };
    setAssignments(data.assignments ?? []);
  }

  async function loadTraccarDevices() {
    const response = await fetch("/api/devices", { cache: "no-store" });
    const data = (await response.json()) as { devices?: TraccarDevice[]; error?: string };
    setTraccarDevices(data.devices ?? []);
    if (data.error) setDeviceMessage(data.error);
  }

  function openDeviceManager() {
    const assignedLineId = selectedVehicle?.assignedLineId || selectedLineRouteIds[0] || lineRoutesWithPaths[0]?.id || "";
    setDeviceDraft((current) => ({ ...current, assignedLineId: current.assignedLineId || assignedLineId }));
    setDeviceManagerOpen(true);
    setDeviceMessage("Selecciona un GPS de Traccar, carga el interno y asigna la linea.");
    loadTraccarDevices();
  }

  function closeDeviceManager() {
    setDeviceManagerOpen(false);
    setDeviceMessage("");
  }

  async function saveMonitorDevice() {
    const traccarDevice = traccarDevices.find((device) => String(device.id) === deviceDraft.deviceId);
    const internalNumber = deviceDraft.internalNumber.trim();
    const assignedLineId = deviceDraft.assignedLineId;

    if (!traccarDevice || !internalNumber || !assignedLineId) {
      setDeviceMessage("Falta GPS, interno o linea.");
      return;
    }

    setSavingDevice(true);
    try {
      const nextDevice = {
        deviceId: traccarDevice.id,
        uniqueId: traccarDevice.uniqueId,
        name: traccarDevice.name,
        internalNumber,
        assignedLineId
      };
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextDevice)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el GPS");

      const nextDevices = upsertMonitorDevice(nextDevice);
      setAssignments(nextDevices.map((device) => ({
        deviceId: device.deviceId,
        internalNumber: device.internalNumber,
        label: `Colectivo ${device.internalNumber}`,
        assignedLineId: device.assignedLineId
      })));
      selectVehicle(traccarDevice.id);
      setDeviceMessage("GPS cargado para el monitor y la APK.");
      await loadFleet();
    } finally {
      setSavingDevice(false);
    }
  }

  useEffect(() => {
    const storedDeviceId = readSelectedDeviceId();
    if (storedDeviceId) {
      setSelectedDeviceId(storedDeviceId);
    }
    loadFleet();
    loadLineRoutes();
    loadLineStops();
    loadAssignments();
    loadTraccarDevices();
    const timer = window.setInterval(loadFleet, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stopDraft.lineId || lineRoutesWithPaths.length === 0) return;
    const initialLineId = selectedVehicle?.assignedLineId || selectedLineRouteIds[0] || lineRoutesWithPaths[0].id;
    setStopDraft((current) => ({ ...current, lineId: initialLineId }));
  }, [lineRoutesWithPaths, selectedLineRouteIds, selectedVehicle?.assignedLineId, stopDraft.lineId]);

  useEffect(() => {
    setInternalDraft(selectedVehicle?.internalNumber ?? selectedAssignment?.internalNumber ?? "");
  }, [selectedVehicle?.internalNumber, selectedVehicle?.deviceId, selectedAssignment?.internalNumber]);

  useEffect(() => {
    const assignedLineId = selectedVehicle?.assignedLineId ?? selectedAssignment?.assignedLineId;
    if (!assignedLineId) return;

    setShowLineRoutes(true);
    setSelectedLineRouteIds([assignedLineId]);
  }, [selectedVehicle?.assignedLineId, selectedAssignment?.assignedLineId, selectedVehicle?.deviceId]);

  return (
    <main className={styles.shell}>
      <button
        className={`${styles.sidebarToggle} ${sidebarOpen ? styles.sidebarToggleHidden : ""}`}
        onClick={() => setSidebarOpen(true)}
        title="Abrir monitor"
        aria-label="Abrir monitor"
      >
        <PanelLeftOpen size={18} />
        <span>Monitor</span>
      </button>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Santa Ana</span>
            <h1>Monitor de flota</h1>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} onClick={loadFleet} title="Actualizar">
              <RefreshCcw size={18} className={loading ? styles.spin : undefined} />
            </button>
            <button className={styles.iconButton} onClick={deviceManagerOpen ? closeDeviceManager : openDeviceManager} title="Cargar GPS">
              {deviceManagerOpen ? <X size={18} /> : <Plus size={18} />}
            </button>
            <button className={styles.iconButton} onClick={() => setSidebarOpen(false)} title="Cerrar monitor">
              <PanelLeftClose size={18} />
            </button>
          </div>
        </header>

        <section className={styles.statusGrid}>
          <Metric icon={<Activity size={18} />} label="Unidades" value={fleet.vehicles.length.toString()} />
          <Metric icon={<Map size={18} />} label="Lineas" value={lineRoutesWithPaths.length.toString()} />
          <button className={styles.metricButton} onClick={() => setShowLineRoutes((value) => !value)}>
            {showLineRoutes ? <Eye size={18} /> : <EyeOff size={18} />}
            <span>
              <small>Recorridos</small>
              <strong>{showLineRoutes ? routeSelectionLabel(selectedLineRouteIds.length) : "Ocultos"}</strong>
            </span>
          </button>
          <button className={styles.metricButton} onClick={() => setShowLineStops((value) => !value)}>
            {showLineStops ? <MapPin size={18} /> : <EyeOff size={18} />}
            <span>
              <small>Paradas</small>
              <strong>{showLineStops ? lineStops.length.toString() : "Ocultas"}</strong>
            </span>
          </button>
        </section>

        {fleet.error ? <div className={styles.error}>{fleet.error}</div> : null}

        <section className={styles.list}>
          {fleet.vehicles.map((vehicle) => (
            <button
              key={vehicle.deviceId}
              className={`${styles.vehicle} ${selectedVehicle?.deviceId === vehicle.deviceId ? styles.selected : ""}`}
              onClick={() => selectVehicle(vehicle.deviceId)}
            >
              <span className={styles.badge} style={{ background: vehicle.color }}>
                {vehicle.line}
              </span>
              <span className={styles.vehicleText}>
                <strong>{vehicle.label}</strong>
                <small>{formatDate(vehicle.fixTime)}</small>
              </span>
              <span className={styles.speed}>{Math.round(vehicle.speedKmh)} km/h</span>
            </button>
          ))}
        </section>

        {deviceManagerOpen ? (
          <section className={styles.assignmentPanel}>
            <div className={styles.sectionHeader}>
              <span>Cargar GPS</span>
              <small>{savingDevice ? "Guardando" : "Traccar"}</small>
            </div>
            <label className={styles.field}>
              <span>GPS</span>
              <select
                value={deviceDraft.deviceId}
                onChange={(event) => setDeviceDraft((current) => ({ ...current, deviceId: event.target.value }))}
              >
                <option value="">Seleccionar GPS</option>
                {traccarDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} - {device.uniqueId}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Interno</span>
              <input
                value={deviceDraft.internalNumber}
                onChange={(event) => setDeviceDraft((current) => ({ ...current, internalNumber: event.target.value }))}
                placeholder="705"
              />
            </label>
            <label className={styles.field}>
              <span>Linea</span>
              <select
                value={deviceDraft.assignedLineId}
                onChange={(event) => setDeviceDraft((current) => ({ ...current, assignedLineId: event.target.value }))}
              >
                <option value="">Seleccionar linea</option>
                {lineRoutesWithPaths.map((line) => (
                  <option key={line.id} value={line.id}>
                    {formatLineLabel(line)}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.primaryButton} onClick={saveMonitorDevice} disabled={savingDevice}>
              <Save size={17} />
              <span>Guardar GPS</span>
            </button>
            {deviceMessage ? <p className={styles.editorHint}>{deviceMessage}</p> : null}
          </section>
        ) : null}

        {selectedVehicle ? (
          <section className={styles.assignmentPanel}>
            <div className={styles.sectionHeader}>
              <span>Asignacion</span>
              <small>{savingAssignment ? "Guardando" : "Actual"}</small>
            </div>
            <label className={styles.field}>
              <span>Interno</span>
              <input
                value={internalDraft}
                onChange={(event) => setInternalDraft(event.target.value)}
                onBlur={() => saveAssignment(selectedVehicle.assignedLineId ?? selectedAssignment?.assignedLineId ?? "49bis")}
                placeholder="230"
              />
            </label>
            <label className={styles.field}>
              <span>Linea</span>
              <select
                value={selectedVehicle.assignedLineId ?? selectedAssignment?.assignedLineId ?? ""}
                onChange={(event) => saveAssignment(event.target.value)}
              >
                {lineRoutesWithPaths.map((line) => (
                  <option key={line.id} value={line.id}>
                    {formatLineLabel(line)}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {selectedVehicle?.gps ? (
          <section className={styles.gpsPanel}>
            <div className={styles.sectionHeader}>
              <span>Estado GPS</span>
              <small>{selectedVehicle.gps.fresh ? "Reciente" : "Viejo"}</small>
            </div>
            <div className={`${styles.gpsStatus} ${selectedVehicle.gps.moving ? styles.gpsOk : styles.gpsWarn}`}>
              {selectedVehicle.gps.status}
            </div>
            <div className={styles.gpsGrid}>
              <Metric icon={<Satellite size={16} />} label="Satelites" value={formatNullable(selectedVehicle.gps.satellites)} />
              <Metric icon={<Power size={16} />} label="Ignicion" value={selectedVehicle.gps.ignition ? "Si" : "No"} />
              <Metric icon={<Battery size={16} />} label="Bateria" value={formatBattery(selectedVehicle.gps.battery)} />
              <Metric icon={<Clock size={16} />} label="Reporte" value={formatAge(selectedVehicle.gps.ageSeconds)} />
            </div>
          </section>
        ) : null}

        {selectedVehicle ? (
          <section className={styles.stopsPanel}>
            <div className={styles.sectionHeader}>
              <span>Paradas cercanas</span>
              <button onClick={openStopEditor}>Editar</button>
            </div>
            {selectedVehicleStops.length > 0 ? (
              <div className={styles.stopList}>
                {selectedVehicleStops.map((stop) => (
                  <div key={stop.id} className={styles.stopRow}>
                    <span>
                      <strong>{stop.name}</strong>
                      <small>{formatDirection(stop.direction)}</small>
                    </span>
                    <b>{formatDistance(stop.distanceMeters)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>Sin paradas cargadas para esta linea.</p>
            )}
          </section>
        ) : null}

        {stopEditorOpen ? (
          <section className={styles.stopEditorPanel}>
            <div className={styles.sectionHeader}>
              <span>Editor de paradas</span>
              <div className={styles.editorHeaderActions}>
                <small>{savingStop ? "Guardando" : selectedStopLine?.number ?? "Linea"}</small>
                <button type="button" onClick={closeStopEditor} title="Cerrar editor">
                  <X size={14} />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
            <label className={styles.field}>
              <span>Linea</span>
              <select value={stopDraft.lineId} onChange={(event) => updateStopLine(event.target.value)}>
                {lineRoutesWithPaths.map((line) => (
                  <option key={line.id} value={line.id}>
                    {formatLineLabel(line)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Nombre</span>
              <input
                value={stopDraft.name}
                onChange={(event) => setStopDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Av. Almirante Brown y 1 de Marzo"
              />
            </label>
            <div className={styles.editorGrid}>
              <label className={styles.field}>
                <span>Sentido</span>
                <select
                  value={stopDraft.direction}
                  onChange={(event) => setStopDraft((current) => ({ ...current, direction: event.target.value as LineStop["direction"] }))}
                >
                  <option value="ambos">Ida y vuelta</option>
                  <option value="ida">Ida</option>
                  <option value="vuelta">Vuelta</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Orden</span>
                <input
                  type="number"
                  min="1"
                  value={stopDraft.order}
                  onChange={(event) => setStopDraft((current) => ({ ...current, order: event.target.value }))}
                  placeholder="1"
                />
              </label>
            </div>
            <div className={styles.coordsBox}>
              <MapPin size={16} />
              <span>{formatDraftCoordinates(stopDraft.latitude, stopDraft.longitude)}</span>
            </div>
            <button className={styles.primaryButton} onClick={saveStop} disabled={savingStop}>
              <Save size={17} />
              <span>Guardar parada</span>
            </button>
            {stopMessage ? <p className={styles.editorHint}>{stopMessage}</p> : null}
            <div className={styles.stopList}>
              {editableLineStops.map((stop) => (
                <div key={stop.id} className={styles.stopRow}>
                  <span>
                    <strong>{stop.order ? `${stop.order}. ${stop.name}` : stop.name}</strong>
                    <small>{formatDirection(stop.direction)}</small>
                  </span>
                  <button className={styles.dangerIconButton} onClick={() => deleteStop(stop.id)} title="Borrar parada">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.linePicker}>
          <div className={styles.sectionHeader}>
            <span>Lineas</span>
            <button onClick={() => setSelectedLineRouteIds([])}>Todas</button>
          </div>
          <div className={styles.lineGrid}>
            {lineRoutesWithPaths.map((line) => {
              const isSelected = selectedLineRouteIds.includes(line.id);
              const isMuted = selectedLineRouteIds.length > 0 && !isSelected;

              return (
                <button
                  key={line.id}
                  className={`${styles.lineChip} ${isSelected ? styles.lineChipSelected : ""} ${isMuted ? styles.lineChipMuted : ""}`}
                  onClick={() => editLineRoute(line.id)}
                  title={`Editar ${formatLineLabel(line)}`}
                >
                  <span style={{ background: line.color }} />
                  <strong>{line.number}</strong>
                  <small>{formatLineDescription(line)}</small>
                </button>
              );
            })}
          </div>
        </section>

        <footer className={styles.footer}>
          <Metric icon={<Gauge size={18} />} label="Velocidad" value={`${Math.round(selectedVehicle?.speedKmh ?? 0)} km/h`} />
          <Metric icon={<Clock size={18} />} label="Actualizado" value={fleet.updatedAt ? formatDate(fleet.updatedAt) : "-"} />
        </footer>
      </aside>

      <section className={styles.mapWrap}>
        <FleetMap
          vehicles={fleet.vehicles}
          selectedDeviceId={selectedVehicle?.deviceId ?? null}
          lineRoutes={visibleLineRoutes}
          lineStops={visibleLineStops}
          stopEditorEnabled={stopEditorOpen}
          draftStop={draftStopMarker}
          onMapClick={handleStopMapClick}
          onVehicleSelect={selectVehicle}
        />
      </section>
    </main>
  );
}

function readSelectedDeviceId() {
  if (typeof window === "undefined") return null;

  const value = Number(window.localStorage.getItem(selectedDeviceStorageKey));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function saveSelectedDeviceId(deviceId: number | null) {
  if (typeof window === "undefined") return;

  if (deviceId) {
    window.localStorage.setItem(selectedDeviceStorageKey, String(deviceId));
  } else {
    window.localStorage.removeItem(selectedDeviceStorageKey);
  }
}

function readMonitorDevices(): Array<{ deviceId: number; uniqueId?: string; name?: string; internalNumber: string; assignedLineId: string }> {
  if (typeof window === "undefined") return [];

  try {
    const rows = JSON.parse(window.localStorage.getItem("santaAnaMonitorDevices") ?? "[]") as Array<{
      deviceId: number;
      uniqueId?: string;
      name?: string;
      internalNumber: string;
      assignedLineId: string;
    }>;
    return Array.isArray(rows) ? rows.filter((row) => Number.isFinite(Number(row.deviceId)) && row.internalNumber && row.assignedLineId) : [];
  } catch {
    return [];
  }
}

function upsertMonitorDevice(next: { deviceId: number; uniqueId?: string; name?: string; internalNumber: string; assignedLineId: string }) {
  const devices = readMonitorDevices();
  const index = devices.findIndex((device) => device.deviceId === next.deviceId);
  if (index >= 0) {
    devices[index] = next;
  } else {
    devices.push(next);
  }
  window.localStorage.setItem("santaAnaMonitorDevices", JSON.stringify(devices));
  return devices;
}

function routeSelectionLabel(selectedCount: number) {
  if (selectedCount === 0) return "Todas";
  if (selectedCount === 1) return "1 selec.";
  return `${selectedCount} selec.`;
}

function formatLineDescription(line: Pick<LineRoute, "name" | "number">) {
  const description = line.name.replace(/^Linea\s+/i, "").trim();
  return description && description !== line.number ? description : line.number;
}

function formatLineLabel(line: Pick<LineRoute, "name" | "number">) {
  const description = formatLineDescription(line);
  return description === line.number ? line.number : `${line.number} - ${description}`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.metric}>
      {icon}
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function formatNullable(value: number | null | undefined) {
  return value == null ? "-" : String(value);
}

function formatBattery(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(1)} V`;
}

function formatAge(value: number | null | undefined) {
  if (value == null) return "-";
  if (value < 60) return `${value}s`;
  return `${Math.round(value / 60)}m`;
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

function formatDistance(value: number) {
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(1)} km`;
}

function formatDirection(direction: LineStop["direction"]) {
  if (direction === "ambos") return "ida y vuelta";
  return direction;
}

function formatDraftCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return "Hace clic en el mapa para elegir ubicacion";
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
