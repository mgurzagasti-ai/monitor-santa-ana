"use client";

import dynamic from "next/dynamic";
import { Activity, Battery, Clock, Eye, EyeOff, Gauge, Map, PanelLeftClose, PanelLeftOpen, Power, RefreshCcw, Satellite } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const FleetMap = dynamic(() => import("./ui/FleetMap"), { ssr: false });

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

type VehicleAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
};

export default function Home() {
  const [fleet, setFleet] = useState<FleetResponse>({ vehicles: [], updatedAt: "" });
  const [lineRoutes, setLineRoutes] = useState<LineRoute[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [showLineRoutes, setShowLineRoutes] = useState(true);
  const [selectedLineRouteIds, setSelectedLineRouteIds] = useState<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [internalDraft, setInternalDraft] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
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

  const selectedAssignment = useMemo(() => {
    if (!selectedVehicle) return null;
    return assignments.find((assignment) => assignment.deviceId === selectedVehicle.deviceId) ?? null;
  }, [assignments, selectedVehicle]);

  function toggleLineRoute(lineId: string) {
    setSelectedLineRouteIds((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]
    );
  }

  async function saveAssignment(nextLineId: string, nextInternalNumber = internalDraft) {
    if (!selectedVehicle) return;

    const internalNumber = nextInternalNumber.trim() || selectedVehicle.internalNumber || selectedAssignment?.internalNumber || "";
    if (!internalNumber) return;

    setSavingAssignment(true);
    try {
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
      await loadFleet();
    } finally {
      setSavingAssignment(false);
    }
  }

  async function loadFleet() {
    setLoading(true);
    try {
      const response = await fetch("/api/fleet", { cache: "no-store" });
      const data = (await response.json()) as FleetResponse;
      setFleet(data);
      if (!selectedDeviceId && data.vehicles[0]) {
        setSelectedDeviceId(data.vehicles[0].deviceId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadLineRoutes() {
    const response = await fetch("/api/line-routes", { cache: "no-store" });
    const data = (await response.json()) as { routes: LineRoute[] };
    setLineRoutes(data.routes ?? []);
  }

  async function loadAssignments() {
    const response = await fetch("/api/assignments", { cache: "no-store" });
    const data = (await response.json()) as { assignments: VehicleAssignment[] };
    setAssignments(data.assignments ?? []);
  }

  useEffect(() => {
    loadFleet();
    loadLineRoutes();
    loadAssignments();
    const timer = window.setInterval(loadFleet, 15000);
    return () => window.clearInterval(timer);
  }, []);

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
        </section>

        {fleet.error ? <div className={styles.error}>{fleet.error}</div> : null}

        <section className={styles.list}>
          {fleet.vehicles.map((vehicle) => (
            <button
              key={vehicle.deviceId}
              className={`${styles.vehicle} ${selectedVehicle?.deviceId === vehicle.deviceId ? styles.selected : ""}`}
              onClick={() => setSelectedDeviceId(vehicle.deviceId)}
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
                    {line.number} - {line.name.replace(/^Linea\s+/i, "")}
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
                  onClick={() => toggleLineRoute(line.id)}
                  title={line.name}
                >
                  <span style={{ background: line.color }} />
                  <strong>{line.number}</strong>
                  <small>{line.name.replace(/^Linea\s+/i, "")}</small>
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
        />
      </section>
    </main>
  );
}

function routeSelectionLabel(selectedCount: number) {
  if (selectedCount === 0) return "Todas";
  if (selectedCount === 1) return "1 selec.";
  return `${selectedCount} selec.`;
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
