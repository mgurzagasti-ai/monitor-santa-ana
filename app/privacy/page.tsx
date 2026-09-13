import Link from "next/link";
import styles from "./privacy.module.css";

const lastUpdated = "13 de septiembre de 2026";

export const metadata = {
  title: "Politica de Privacidad - Santa Ana Bus",
  description: "Politica de Privacidad de la aplicacion Santa Ana Bus"
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.document}>
        <p className={styles.brand}>Santa Ana Bus</p>
        <h1>Politica de Privacidad</h1>
        <p className={styles.updated}>Ultima actualizacion: {lastUpdated}</p>

        <section>
          <h2>Aplicacion identificada</h2>
          <p>
            Esta politica corresponde a la aplicacion movil <strong>Santa Ana Bus</strong>, utilizada para consultar
            lineas, recorridos, paradas cercanas, novedades y unidades activas del servicio.
          </p>
        </section>

        <section>
          <h2>Cuenta y autenticacion</h2>
          <p>
            Santa Ana Bus utiliza el email para registro, inicio de sesion, sesiones y recuperacion de contrasena
            mediante nuestro servicio Appwrite self-hosted. No almacenamos la contrasena en la APK.
          </p>
        </section>

        <section>
          <h2>Ubicacion</h2>
          <p>
            La aplicacion solicita ubicacion aproximada y precisa unicamente para funciones del mapa, mostrar la
            ubicacion del usuario y calcular paradas cercanas. La ubicacion del usuario se procesa localmente en el
            dispositivo y la APK actual no la envia a nuestro servidor, Appwrite ni Traccar.
          </p>
          <p>No se utiliza ubicacion en segundo plano.</p>
        </section>

        <section>
          <h2>Publicidad propia</h2>
          <p>
            La aplicacion puede mostrar publicidad propia contextual segun la seccion de la app. No utilizamos AdMob,
            advertising ID, tracking ni perfilado publicitario.
          </p>
        </section>

        <section>
          <h2>Preferencias locales</h2>
          <p>
            Preferencias como tema y favoritos se almacenan localmente en el dispositivo. No guardamos contactos,
            telefono/SMS, camara, fotos/videos, archivos personales, datos de salud ni pagos.
          </p>
        </section>

        <section>
          <h2>Analytics y reportes</h2>
          <p>
            No usamos Firebase Analytics, Crashlytics ni sistemas equivalentes de analytics o tracking en la APK actual.
          </p>
        </section>

        <section>
          <h2>Servicios utilizados</h2>
          <p>
            Usamos Appwrite self-hosted para autenticacion, OpenStreetMap/osmdroid para mapas e infraestructura propia
            del monitor Santa Ana Bus para informacion publica de lineas, paradas, flota, novedades y publicidad propia.
            Los datos se transmiten mediante HTTPS cuando corresponde.
          </p>
        </section>

        <section>
          <h2>Conservacion y eliminacion de datos</h2>
          <p>
            Conservamos los datos de cuenta mientras la cuenta permanezca activa o mientras sean necesarios para prestar
            el servicio, atender solicitudes, proteger la seguridad del sistema o cumplir obligaciones legales cuando
            correspondiera.
          </p>
          <p>
            El usuario puede solicitar la eliminacion de su cuenta y los datos asociados desde la pagina publica{" "}
            <Link href="/delete-account">/delete-account</Link>. La eliminacion definitiva requiere una verificacion de
            identidad antes de borrar la cuenta.
          </p>
        </section>

        <Link className={styles.action} href="/delete-account">
          Solicitar eliminacion de cuenta
        </Link>
      </article>
    </main>
  );
}
