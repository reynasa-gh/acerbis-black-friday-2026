import { CAMPAIGN, CONDITIONS, VAT_MESSAGE } from '../config/campaign'
import { asset, CATALOG } from '../lib/catalog'
import { daysLeft } from '../lib/campaign'
import { formatPct } from '../lib/money'
import { Icon } from './Common'

/** Aviso de borrador: solo aparece mientras el IVA esté pendiente (si está confirmado va en las condiciones). */
export function VatBadge() {
  const { status, label } = CAMPAIGN.vat
  if (status !== 'pending') return null
  return (
    <span className={`vat vat-${status}`} title={status === 'pending' ? 'El Excel no indica si los precios incluyen o excluyen IVA. Confirmar antes de publicar.' : undefined}>
      {status === 'pending' && <Icon name="alert" />}
      {label[status]}
    </span>
  )
}

export function Hero({ closed, now, onSeeOffers }: { closed: boolean; now: Date; onSeeOffers: () => void }) {
  const left = daysLeft(now)
  const maxDto = Math.max(...CATALOG.products.flatMap((p) => p.variants.map((v) => v.discountPct)))
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-stripes" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">{CAMPAIGN.distributor} · Para talleres y tiendas</p>
          <h1 id="hero-title">
            <span>Black Friday</span>
            <span className="hero-acerbis">
              <img src={asset(CAMPAIGN.acerbisLogo)} alt="Acerbis" />
            </span>
          </h1>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-xl" onClick={onSeeOffers}>Ver ofertas</button>
            <span className="hero-days">
              <Icon name="clock" />
              {closed ? 'Campaña finalizada' : left === 0 ? 'Último día de campaña' : `Quedan ${left} días`}
            </span>
          </div>
        </div>
        <div className="hero-figure" aria-hidden="true">
          <span className="hero-pct">−{String(maxDto).replace('.', ',')}<small>%</small></span>
          <span className="hero-pct-label">Descuento máximo sobre PVP</span>
        </div>
      </div>
    </section>
  )
}

export function ConditionsBar({ closed }: { closed: boolean }) {
  return (
    <section className="conditions" id="condiciones" aria-label="Condiciones de campaña">
      <div className="wrap conditions-row">
        <ul>
          <li><Icon name="euro" /><span>{CAMPAIGN.messages.minOrder}</span></li>
          <li><Icon name="truck" /><span>{CAMPAIGN.messages.shipping}</span></li>
          <li><Icon name="clock" /><span>{CAMPAIGN.messages.validity}</span></li>
          {VAT_MESSAGE && <li><Icon name="check" /><span>{VAT_MESSAGE}</span></li>}
        </ul>
        <div className="conditions-side">
          <VatBadge />
          <span className="stock-note"><Icon name="alert" /><span>Existencias sujetas a confirmación. ¡Unidades limitadas!</span></span>
        </div>
      </div>
      {closed && (
        <div className="closed-banner" role="status">
          <div className="wrap"><b>La campaña ha finalizado.</b> Los precios se muestran solo como consulta: ya no se pueden preparar pedidos con esta promoción.</div>
        </div>
      )}
    </section>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <b>{CAMPAIGN.title} · {CAMPAIGN.distributor} {CAMPAIGN.year}</b>
          <p>{CONDITIONS.join(' ')} Precios válidos salvo error tipográfico.</p>
        </div>
        <div>
          <p><a href="https://www.reynasa.es/aviso-legal/" target="_blank" rel="noopener noreferrer">Aviso legal</a></p>
          <p><a href="#/revision">Revisión interna de datos</a></p>
        </div>
      </div>
    </footer>
  )
}
