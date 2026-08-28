"use client";

import { Calendar, ExternalLink, Image as ImageIcon, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./ads.module.css";

type DestinationType = "whatsapp" | "website" | "instagram" | "facebook" | "none";
type PlacementCode = "MAIN_BOTTOM" | "LINES_BOTTOM" | "MAP_BOTTOM" | "FAVORITES_BOTTOM" | "PROFILE_BOTTOM";

type AdPublication = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  destinationType: DestinationType;
  destinationUrl: string;
  placements: PlacementCode[];
  active: boolean;
  startDate: string;
  endDate: string;
  priority: number;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

type PlacementOption = {
  code: PlacementCode;
  name: string;
};

type Draft = Omit<AdPublication, "createdAt" | "updatedAt">;

const emptyDraft: Draft = {
  id: "",
  title: "",
  subtitle: "",
  imageUrl: "",
  buttonText: "Consultar",
  destinationType: "whatsapp",
  destinationUrl: "",
  placements: ["MAIN_BOTTOM"],
  active: false,
  startDate: toDateInputValue(new Date().toISOString()),
  endDate: toDateInputValue(nextMonthIso()),
  priority: 0,
  durationSeconds: 8
};

export default function AdsAdminPage() {
  const [publications, setPublications] = useState<AdPublication[]>([]);
  const [placements, setPlacements] = useState<PlacementOption[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPublication = useMemo(() => {
    return publications.find((publication) => publication.id === draft.id) ?? null;
  }, [draft.id, publications]);

  async function loadPublications() {
    const response = await fetch("/api/admin/ads/publications", { cache: "no-store" });
    const data = (await response.json()) as { publications?: AdPublication[]; placements?: PlacementOption[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las publicaciones");
    setPublications(data.publications ?? []);
    setPlacements(data.placements ?? []);
  }

  async function savePublication() {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...draft,
        startDate: fromDateInputValue(draft.startDate, "start"),
        endDate: fromDateInputValue(draft.endDate, "end")
      };
      const response = await fetch("/api/admin/ads/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { publications?: AdPublication[]; publication?: AdPublication; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar");
      setPublications(data.publications ?? []);
      if (data.publication) setDraft(toDraft(data.publication));
      setMessage("Publicacion guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deletePublication(id: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/ads/publications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await response.json()) as { publications?: AdPublication[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo borrar");
      setPublications(data.publications ?? []);
      setDraft(emptyDraft);
      setMessage("Publicacion borrada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo borrar");
    } finally {
      setSaving(false);
    }
  }

  function togglePlacement(code: PlacementCode) {
    setDraft((current) => {
      const placements = current.placements.includes(code)
        ? current.placements.filter((placement) => placement !== code)
        : [...current.placements, code];
      return { ...current, placements: placements.length > 0 ? placements : ["MAIN_BOTTOM"] };
    });
  }

  useEffect(() => {
    loadPublications().catch((error) => setMessage(error instanceof Error ? error.message : "No se pudieron cargar las publicaciones"));
  }, []);

  return (
    <main className={styles.shell}>
      <section className={styles.headerBand}>
        <div>
          <span>Santa Ana</span>
          <h1>Publicidad</h1>
          <p>Administra banners propios sin actualizar la APK.</p>
        </div>
        <button className={styles.secondaryButton} onClick={() => setDraft(emptyDraft)}>
          <Plus size={18} />
          <span>Nueva</span>
        </button>
      </section>

      <section className={styles.contentGrid}>
        <aside className={styles.listPanel}>
          <div className={styles.sectionHeader}>
            <span>Publicaciones</span>
            <small>{publications.length}</small>
          </div>
          <div className={styles.publicationList}>
            {publications.length === 0 ? <p className={styles.emptyState}>Todavia no hay publicaciones.</p> : null}
            {publications.map((publication) => (
              <button
                key={publication.id}
                className={`${styles.publicationRow} ${publication.id === draft.id ? styles.selectedRow : ""}`}
                onClick={() => setDraft(toDraft(publication))}
              >
                <span className={publication.active ? styles.activeDot : styles.inactiveDot} />
                <span>
                  <strong>{publication.title}</strong>
                  <small>{publication.placements.join(" / ")}</small>
                </span>
              </button>
            ))}
          </div>
          {selectedPublication ? (
            <button className={styles.listDangerButton} onClick={() => deletePublication(selectedPublication.id)} disabled={saving}>
              <Trash2 size={17} />
              <span>Borrar seleccionada</span>
            </button>
          ) : null}
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.sectionHeader}>
            <span>{selectedPublication ? "Editar" : "Nueva publicacion"}</span>
            <small>{draft.active ? "Activa" : "Pausada"}</small>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Titulo</span>
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ej: Pizzeria Don Jose" />
            </label>
            <label className={styles.field}>
              <span>Texto corto</span>
              <input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} placeholder="Ej: 20% de descuento" />
            </label>
            <label className={`${styles.field} ${styles.fullField}`}>
              <span>URL de imagen HTTPS</span>
              <input value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Ej: https://dominio.com/banner.jpg" />
            </label>
            <label className={styles.field}>
              <span>Boton</span>
              <input value={draft.buttonText} onChange={(event) => setDraft({ ...draft, buttonText: event.target.value })} placeholder="Ej: Consultar" />
            </label>
            <label className={styles.field}>
              <span>Destino</span>
              <select value={draft.destinationType} onChange={(event) => setDraft({ ...draft, destinationType: event.target.value as DestinationType })}>
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Web</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="none">Sin enlace</option>
              </select>
            </label>
            <label className={`${styles.field} ${styles.fullField}`}>
              <span>URL de destino</span>
              <input value={draft.destinationUrl} onChange={(event) => setDraft({ ...draft, destinationUrl: event.target.value })} placeholder="Ej: https://wa.me/5493881234567" disabled={draft.destinationType === "none"} />
            </label>
          </div>

          <div className={styles.optionsGrid}>
            <label className={styles.switchRow}>
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              <span>Publicacion activa</span>
            </label>
            <label className={styles.field}>
              <span>Inicio</span>
              <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Fin</span>
              <input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Prioridad</span>
              <input type="number" min="0" max="1000" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} />
            </label>
            <label className={styles.field}>
              <span>Segundos</span>
              <input type="number" min="4" max="60" value={draft.durationSeconds} onChange={(event) => setDraft({ ...draft, durationSeconds: Number(event.target.value) })} />
            </label>
          </div>

          <div className={styles.placementPanel}>
            <div className={styles.sectionHeader}>
              <span>Ubicaciones</span>
              <small>{draft.placements.length}</small>
            </div>
            <div className={styles.placementGrid}>
              {placements.map((placement) => (
                <label key={placement.code} className={styles.placementCheck}>
                  <input type="checkbox" checked={draft.placements.includes(placement.code)} onChange={() => togglePlacement(placement.code)} />
                  <span>{placement.name}</span>
                </label>
              ))}
            </div>
          </div>

          {message ? <p className={styles.message}>{message}</p> : null}
          <div className={styles.actionRow}>
            <button className={styles.primaryButton} onClick={savePublication} disabled={saving}>
              <Save size={18} />
              <span>{saving ? "Guardando" : "Guardar"}</span>
            </button>
            {draft.id ? (
              <button className={styles.dangerButton} onClick={() => deletePublication(draft.id)} disabled={saving}>
                <Trash2 size={18} />
                <span>Borrar</span>
              </button>
            ) : null}
          </div>
       </section>

        <aside className={styles.previewPanel}>
          <div className={styles.sectionHeader}>
            <span>Vista previa</span>
            <small>{draft.durationSeconds}s</small>
          </div>
          <div className={styles.previewCard}>
            {draft.imageUrl ? <img src={draft.imageUrl} alt="" /> : <div className={styles.imageFallback}><ImageIcon size={28} /></div>}
            <div className={styles.previewText}>
              <strong>{draft.title || "Titulo del comercio"}</strong>
              <span>{draft.subtitle || "Texto corto de la promocion"}</span>
            </div>
            {draft.destinationType !== "none" ? (
              <div className={styles.previewButton}>
                <ExternalLink size={14} />
                <span>{draft.buttonText || "Ver"}</span>
              </div>
            ) : null}
          </div>
          <div className={styles.dateBox}>
            <Calendar size={16} />
            <span>{draft.startDate || "inicio"} / {draft.endDate || "fin"}</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function toDraft(publication: AdPublication): Draft {
  return {
    id: publication.id,
    title: publication.title,
    subtitle: publication.subtitle,
    imageUrl: publication.imageUrl,
    buttonText: publication.buttonText,
    destinationType: publication.destinationType,
    destinationUrl: publication.destinationUrl,
    placements: publication.placements,
    active: publication.active,
    startDate: toDateInputValue(publication.startDate),
    endDate: toDateInputValue(publication.endDate),
    priority: publication.priority,
    durationSeconds: publication.durationSeconds
  };
}

function toDateInputValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string, mode: "start" | "end") {
  const suffix = mode === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return value ? `${value}${suffix}` : new Date().toISOString();
}

function nextMonthIso() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}



