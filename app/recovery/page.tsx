"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { Account, Client } from "appwrite";
import { useSearchParams } from "next/navigation";
import styles from "./recovery.module.css";

const appwriteEndpoint = "https://appwrite.santaanasrl.com.ar/v1";
const appwriteProjectId = "6aa4501a00048053dc71";

type SubmitState = "idle" | "loading" | "success" | "error";

export default function RecoveryPage() {
  return (
    <Suspense fallback={<RecoveryShell />}>
      <RecoveryForm />
    </Suspense>
  );
}

function RecoveryShell() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>Santa Ana Bus</div>
        <h1>Recuperar acceso</h1>
        <p className={styles.lead}>Cargando enlace de recuperacion...</p>
      </section>
    </main>
  );
}

function RecoveryForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const secret = searchParams.get("secret") ?? "";
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const account = useMemo(() => {
    const client = new Client()
      .setEndpoint(appwriteEndpoint)
      .setProject(appwriteProjectId);

    return new Account(client);
  }, []);

  const hasRecoveryParams = userId.length > 0 && secret.length > 0;
  const isLoading = submitState === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasRecoveryParams) {
      setSubmitState("error");
      setMessage("El enlace de recuperacion no es valido o esta incompleto.");
      return;
    }

    if (password.length < 8) {
      setSubmitState("error");
      setMessage("La contrase\u00f1a debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== repeatPassword) {
      setSubmitState("error");
      setMessage("Las contrase\u00f1as no coinciden.");
      return;
    }

    setSubmitState("loading");
    setMessage("");

    try {
      await account.updateRecovery({
        userId,
        secret,
        password
      });
      setSubmitState("success");
      setPassword("");
      setRepeatPassword("");
      setMessage("Contrase\u00f1a actualizada correctamente. Ya podes volver a la app e iniciar sesion.");
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contrase\u00f1a.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="recovery-title">
        <div className={styles.brand}>Santa Ana Bus</div>
        <h1 id="recovery-title">Recuperar acceso</h1>
        <p className={styles.lead}>{"Elegi una nueva contrase\u00f1a para tu cuenta."}</p>

        {!hasRecoveryParams && (
          <div className={styles.messageError} role="alert">
            El enlace de recuperacion no es valido o esta incompleto.
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{"Nueva contrase\u00f1a"}</span>
            <input
              type="password"
              value={password}
              minLength={8}
              autoComplete="new-password"
              disabled={isLoading || !hasRecoveryParams || submitState === "success"}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>{"Repetir contrase\u00f1a"}</span>
            <input
              type="password"
              value={repeatPassword}
              minLength={8}
              autoComplete="new-password"
              disabled={isLoading || !hasRecoveryParams || submitState === "success"}
              onChange={(event) => setRepeatPassword(event.target.value)}
              required
            />
          </label>

          <button
            className={styles.submit}
            type="submit"
            disabled={isLoading || !hasRecoveryParams || submitState === "success"}
          >
            {isLoading ? "Actualizando..." : "Actualizar contrase\u00f1a"}
          </button>
        </form>

        {message && (
          <div
            className={submitState === "success" ? styles.messageSuccess : styles.messageError}
            role="status"
          >
            {message}
          </div>
        )}
      </section>
    </main>
  );
}