import type { ReactNode } from 'react'
import { CAMPAIGN } from '../config/campaign'
import { CATALOG, FAMILY_BY_ID, REVIEW } from '../lib/catalog'
import type { ReviewItem } from '../types'
import { readImageIncidents } from './Common'
import { Brand } from './Header'

function Section({ title, count, open, children }: { title: string; count?: number; open?: boolean; children: ReactNode }) {
  return (
    <details className="rev-section" open={open}>
      <summary>{title}{count !== undefined && <span className="rev-count">{count}</span>}</summary>
      <div className="rev-body">{children}</div>
    </details>
  )
}

function Items({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return <p className="muted">Sin incidencias.</p>
  return (
    <table className="rev-table">
      <thead><tr><th>Referencia / modelo</th><th>Fila</th><th>Detalle</th></tr></thead>
      <tbody>
        {items.map((i, n) => (
          <tr key={n}>
            <td><code>{i.sku ?? i.model ?? '—'}</code></td>
            <td>{i.sourceRow ?? ''}</td>
            <td>{i.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ReviewPanel() {
  const incidents = readImageIncidents()
  const failedCount = REVIEW.imageIssues.length
  const noFallback = REVIEW.imageIssues.filter((i) => i.message.includes('sin otra verificada')).length
  const allOk = REVIEW.checks.every((c) => c.ok)
  return (
    <div className="review">
      <header className="site-header"><div className="wrap header-row"><Brand /><a className="btn btn-primary" href="./">Volver a la web</a></div></header>
      <main className="wrap review-main">
        <h1>Revisión interna de datos</h1>
        <p className="muted">
          Origen: <code>{CATALOG.meta.sourceFile}</code> (hoja {CATALOG.meta.sheet}) · importado el {new Date(CATALOG.meta.importedAt).toLocaleString('es-ES', { timeZone: CAMPAIGN.timeZone })} ·
          SHA-256 <code>{CATALOG.meta.sourceSha256.slice(0, 16)}…</code>. Esta pantalla no es para clientes.
        </p>

        <Section title="Comprobaciones de integridad" count={REVIEW.checks.length} open>
          <p className={allOk ? 'rev-ok' : 'rev-bad'}>{allOk ? 'Todas las comprobaciones automáticas pasan.' : 'Hay comprobaciones con fallo.'}</p>
          <ul className="checks-list">
            {REVIEW.checks.map((c) => (
              <li key={c.id} className={c.ok ? 'ok' : 'bad'}><b>{c.ok ? '✔' : '✘'} {c.label}</b><span>{c.detail}</span></li>
            ))}
          </ul>
        </Section>

        <Section title="Parámetros pendientes antes de publicar" open count={4}>
          <ul className="plain">
            <li><b>IVA:</b> confirmado por Reynasa: <b>no incluido</b> (parámetro <code>vat.status</code> = <code>{CAMPAIGN.vat.status}</code> en <code>src/config/campaign.ts</code>). Se muestra como condición.</li>
            <li><b>Logotipo de Reynasa:</b> {CAMPAIGN.reynasaLogo ? 'configurado.' : 'falta el archivo del logo «Reynasa» (no existe un logo «Reynasa Moto»: «Moto» va en texto). Mientras tanto se muestra REYNASA MOTO en texto. Colocar el archivo en public/brand/ y fijar reynasaLogo en la configuración.'}</li>
            <li><b>Pedidos:</b> la web no está conectada con ningún sistema (confirmado por Reynasa); solo descarga el CSV o copia el resumen (<code>src/lib/order.ts → submitOrder</code> si algún día se conecta).</li>
            <li><b>Cifra de 419 referencias:</b> {REVIEW.discrepancyNote}</li>
          </ul>
        </Section>

        <Section title="Descripciones «0» (herencias validadas)" count={REVIEW.inheritedDescriptions.length}>
          <p className="muted">Solo se hereda de otra fila del mismo modelo y del mismo código de color; nunca de «la fila anterior» sin más.</p>
          <table className="rev-table">
            <thead><tr><th>Referencia</th><th>Fila</th><th>Hereda de</th><th>Descripción usada</th></tr></thead>
            <tbody>{REVIEW.inheritedDescriptions.map((i) => <tr key={i.sku}><td><code>{i.sku}</code></td><td>{i.sourceRow}</td><td><code>{i.from}</code></td><td>{i.description}</td></tr>)}</tbody>
          </table>
        </Section>

        <Section title="Descripciones «0» sin resolver" count={REVIEW.unresolvedDescriptions.length} open>
          <Items items={REVIEW.unresolvedDescriptions} />
        </Section>

        <Section title="Excepciones de descuento (se conservan)" count={REVIEW.exceptions.length} open>
          <Items items={REVIEW.exceptions} />
        </Section>

        <Section title="Datos pendientes de confirmar" count={REVIEW.pendingData.length}>
          <Items items={REVIEW.pendingData} />
        </Section>

        <Section title="Clasificación por familias: puntos a confirmar" count={REVIEW.classificationNotes.length}>
          <Items items={REVIEW.classificationNotes} />
        </Section>

        <Section title="Imágenes que no cargan (comprobación en la importación)" count={failedCount}>
          <p className="muted">{failedCount} referencias con imagen caída; {noFallback} sin otra verificada del mismo producto y color (se muestra marcador). No se sustituye nunca por un artículo parecido.</p>
          <Items items={REVIEW.imageIssues} />
          <h4>Incidencias detectadas en este navegador</h4>
          {incidents.length === 0 ? <p className="muted">Ninguna todavía.</p> : <ul className="plain">{incidents.map((i, n) => <li key={n}><code>{i.sku}</code> {i.url}</li>)}</ul>}
        </Section>

        <Section title="Equivalencias de talla (sufijo → talla)" count={REVIEW.sizeEvidence.length}>
          <table className="rev-table">
            <thead><tr><th>Sufijo</th><th>Talla</th><th>Referencias en Excel</th><th>Confirmadas por descripción</th><th>Fuente</th></tr></thead>
            <tbody>{REVIEW.sizeEvidence.map((s) => <tr key={s.code}><td><code>{s.code}</code></td><td>{s.label}</td><td>{s.rowsInExcel}</td><td>{s.confirmedByDescription}</td><td>{s.source}</td></tr>)}</tbody>
          </table>
          <p className="muted">Los sufijos numéricos (030, 032, 033, 043, 050, 052, 054) y los que no son talla (003, 016, 023, 098) se conservan pero no se convierten en talla sin validación.</p>
        </Section>

        <Section title="Agrupación por modelo y color" count={REVIEW.groups.length}>
          <table className="rev-table">
            <thead><tr><th>Modelo</th><th>Producto</th><th>Familia</th><th>Var.</th><th>Uds.</th><th>Grupos de color (código · variantes · uds.)</th></tr></thead>
            <tbody>
              {REVIEW.groups.map((g) => (
                <tr key={g.model}>
                  <td><code>{g.model}</code></td><td>{g.name}</td><td>{FAMILY_BY_ID.get(g.family)?.name}</td><td>{g.variants}</td><td>{g.units}</td>
                  <td>{g.colors.map((c) => `${c.code ?? '—'}${c.label ? ` ${c.label}` : ''}: ${c.variants}/${c.units}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </main>
    </div>
  )
}
