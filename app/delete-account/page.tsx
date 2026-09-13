import Link from "next/link";
import DeleteAccountForm from "./DeleteAccountForm";
import styles from "./delete-account.module.css";

export const metadata = {
  title: "Eliminacion de cuenta - Santa Ana Bus",
  description: "Solicitud publica de eliminacion de cuenta de Santa Ana Bus"
};

export default function DeleteAccountPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="delete-account-title">
        <p className={styles.brand}>Santa Ana Bus</p>
        <h1 id="delete-account-title">Eliminacion de cuenta - Santa Ana Bus</h1>
        <p className={styles.lead}>
          Esta pagina permite iniciar una solicitud real para eliminar una cuenta de Santa Ana Bus. La eliminacion
          definitiva no es automatica: antes se revisara y verificara la identidad del solicitante.
        </p>

        <div className={styles.info}>
          <h2>Que datos se eliminaran</h2>
          <p>
            Cuando la solicitud sea verificada, se eliminara la cuenta asociada al email indicado y los datos de cuenta
            vinculados al servicio de autenticacion. No se eliminaran automaticamente datos que deban conservarse por
            razones legales, de seguridad o prevencion de abuso, si correspondiera.
          </p>
          <p>
            No solicites contrasenas ni las ingreses en este formulario. Para iniciar la solicitud solo necesitamos el
            email de la cuenta y tu confirmacion expresa.
          </p>
        </div>

        <DeleteAccountForm />

        <p className={styles.footerText}>
          Tambien podes revisar la <Link href="/privacy">Politica de Privacidad</Link> de Santa Ana Bus.
        </p>
      </section>
    </main>
  );
}
