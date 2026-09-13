"use client";

import { FormEvent, useState } from "react";
import styles from "./delete-account.module.css";

type SubmitState = "idle" | "loading" | "success" | "error";

export default function DeleteAccountForm() {
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const isLoading = submitState === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("loading");
    setMessage("");
    setRequestId("");

    try {
      const response = await fetch("/api/public/delete-account-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, confirmed })
      });
      const body = (await response.json()) as { requestId?: string; message?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "No se pudo registrar la solicitud.");
      }

      setSubmitState("success");
      setRequestId(body.requestId ?? "");
      setMessage(body.message ?? "Solicitud recibida.");
      setEmail("");
      setConfirmed(false);
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Email de la cuenta</span>
        <input
          type="email"
          value={email}
          autoComplete="email"
          disabled={isLoading}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className={styles.checkField}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={isLoading}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
        />
        <span>
          Confirmo que quiero iniciar la solicitud de eliminacion de esta cuenta y entiendo que se verificara mi
          identidad antes de eliminarla definitivamente.
        </span>
      </label>

      <button className={styles.submit} type="submit" disabled={isLoading}>
        {isLoading ? "Enviando solicitud..." : "Iniciar solicitud"}
      </button>

      {message && (
        <div className={submitState === "success" ? styles.messageSuccess : styles.messageError} role="status">
          <p>{message}</p>
          {requestId && <p>Identificador de solicitud: {requestId}</p>}
        </div>
      )}
    </form>
  );
}
