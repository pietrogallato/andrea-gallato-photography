import styles from './Footer.module.css'

/**
 * Non riceve la lingua perche non ha testo localizzato: solo l anno, il nome e
 * una mail. Il parametro c era e non veniva usato, e senza di esso la pagina
 * 404 — che in Next non riceve `params` — puo renderlo senza inventarsi un
 * locale.
 */
export function Footer({
  siteName,
  email,
}: {
  siteName: string
  email?: string
}) {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <p className={styles.line}>
        © {year} {siteName}
      </p>
      {email ? (
        <a href={`mailto:${email}`} className={styles.link}>
          {email}
        </a>
      ) : null}
    </footer>
  )
}
