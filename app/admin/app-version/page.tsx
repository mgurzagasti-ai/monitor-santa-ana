"use client";

import { ExternalLink, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./app-version.module.css";

type AppVersion = {
  latestVersionCode: number;
  latestVersionName: string;
  title: string;
  message: string;
  playStoreUrl: string;
  required: boolean;
  updatedAt: string;
};

const emptyVersion: AppVersion = {
  latestVersionCode: 4,
  latestVersionName: "1.1.2",
  title: "Nueva version disponible",
  message: "Ya podes actualizar Colectivos Jujuy desde Google Play.",
  playStoreUrl: "https://play.google.com/store/apps/details?id=ar.com.santaana.bus",
  required: false,
  updatedAt: ""
};

export default function AppVersionAdminPage() {
  const [version, setVersion] = useState<AppVersion>(emptyVersion);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadVersion() {
    const response = await fetch("/api/admin/app-version", { cache: "no-store" });
    const data = (await response.json()) as { version?: AppVersion; error?: string };
    if (!response.ok || !data.version) throw new Error(data.error ?? "No se pudo cargar la version");
    setVersion(data.version);
  }

  async function saveVersion() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/app-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(version)
      });
      const data = (await response.json()) as { version?: AppVersion; error?: string };
      if (!response.ok || !data.version) throw new Error(data.error ?? "No se pudo guardar");
      setVersion(data.version);
      setMessage("Mensaje de version guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadVersion().catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo cargar la version"));
  }, []);

  return (
    <main className={styles.shell}>
      <section className={styles.headerBand}>
        <div>
          <span>Colectivos Jujuy</span>
          <h1>Version de la APK</h1>
          <p>Administra el aviso de actualizacion que aparece en Novedades.</p>
        </div>
        <a className={styles.secondaryButton} href="/admin/ads">
          Publicidad
        </a>
      </section>

      <section className={styles.contentGrid}>
        <section className={styles.formPanel}>
          <div className={styles.sectionHeader}>
            <span>Mensaje para usuarios</span>
            <small>{version.required ? "Obligatoria" : "Opcional"}</small>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Codigo de version</span>
              <input
                type="number"
                min="1"
                value={version.latestVersionCode}
                onChange={(event) => setVersion({ ...version, latestVersionCode: Number(event.target.value) })}
              />
            </label>
            <label className={styles.field}>
              <span>Nombre de version</span>
              <input
                value={version.latestVersionName}
                onChange={(event) => setVersion({ ...version, latestVersionName: event.target.value })}
                placeholder="Ej: 1.1.3"
              />
            </label>
            <label className={`${styles.field} ${styles.fullField}`}>
              <span>Titulo</span>
              <input
                value={version.title}
                onChange={(event) => setVersion({ ...version, title: event.target.value })}
                placeholder="Nueva version disponible"
              />
            </label>
            <label className={`${styles.field} ${styles.fullField}`}>
              <span>Mensaje</span>
              <textarea
                value={version.message}
                onChange={(event) => setVersion({ ...version, message: event.target.value })}
                rows={5}
                placeholder="Ya podes actualizar Colectivos Jujuy desde Google Play."
              />
            </label>
            <label className={`${styles.field} ${styles.fullField}`}>
              <span>URL de Google Play</span>
              <input
                value={version.playStoreUrl}
                onChange={(event) => setVersion({ ...version, playStoreUrl: event.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=ar.com.santaana.bus"
              />
            </label>
          </div>

          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={version.required}
              onChange={(event) => setVersion({ ...version, required: event.target.checked })}
            />
            <span>Marcar como actualizacion obligatoria</span>
          </label>

          {message ? <p className={styles.message}>{message}</p> : null}

          <div className={styles.actionRow}>
            <button className={styles.primaryButton} onClick={saveVersion} disabled={saving}>
              <Save size={18} />
              <span>{saving ? "Guardando" : "Guardar mensaje"}</span>
            </button>
            <button className={styles.secondaryButton} onClick={() => loadVersion()} disabled={saving}>
              <RotateCcw size={18} />
              <span>Recargar</span>
            </button>
          </div>
        </section>

        <aside className={styles.previewPanel}>
          <div className={styles.sectionHeader}>
            <span>Vista previa</span>
            <small>APK</small>
          </div>
          <div className={styles.previewCard}>
            <strong>{version.title || "Nueva version disponible"}</strong>
            <span>Version {version.latestVersionName || "1.1.3"}</span>
            <p>{version.message || "Mensaje para los usuarios."}</p>
            <div className={styles.previewButton}>
              <ExternalLink size={15} />
              <span>{version.required ? "Actualizar ahora" : "Abrir Google Play"}</span>
            </div>
          </div>
          <p className={styles.helpText}>
            Para avisar una version nueva, el codigo debe ser mayor que el de la APK instalada. Ejemplo: si la app instalada es 4, carga 5.
          </p>
        </aside>
      </section>
    </main>
  );
}