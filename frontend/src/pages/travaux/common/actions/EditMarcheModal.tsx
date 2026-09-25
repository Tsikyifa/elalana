import { CalendarBlank, CurrencyCircleDollar, MagnifyingGlass, MapPin, Stack } from '@phosphor-icons/react'
import type { PpmRow } from '../../ppm/types'

type EditMarcheModalProps = {
  market: PpmRow
  onClose: (refresh?: boolean) => void
}

export default function EditMarcheModal({ market, onClose }: EditMarcheModalProps) {
  return (
    <form className="panel-body marche-form" onSubmit={(e) => { e.preventDefault(); onClose() }}>
      {/* 1. IDENTIFICATION ET AXE */}
      <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
        <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
          <h6 className="fw-bold mb-0">1. IDENTIFICATION ET AXE</h6>
          <div className="d-flex align-items-center gap-3">
            <span className="badge" style={{ background: 'var(--border)', color: 'var(--text)', padding: '0.4rem 0.7rem', borderRadius: 999 }}>
              {market.axe}
            </span>
            <div className="form-check form-switch mb-0">
              <input id="est-anticipe-modal" type="checkbox" className="form-check-input" defaultChecked={false} />
              <label className="form-check-label small fw-bold" htmlFor="est-anticipe-modal">MARCHÉ ANTICIPÉ</label>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <label className="form-label fw-bold small" htmlFor="ppm-etat">ÉTAT / ÉTAPE ACTUELLE</label>
          <select id="ppm-etat" className="filter-select" defaultValue="EN_COURS">
            <option value="">-- Choisir --</option>
            <option value="EN_COURS">Exécution</option>
            <option value="ATTRIBUE">Attribué</option>
            <option value="ACHEVE">Achevé</option>
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label fw-bold small" htmlFor="ppm-axe">AXE ROUTIER CONCERNÉ</label>
          <div className="input-group marche-input-group">
            <span className="input-group-text">
              <MapPin size={16} weight="bold" aria-hidden="true" />
            </span>
            <select id="ppm-axe" className="filter-select" defaultValue={market.axe}>
              <option value="RN1">RN1 - Antananarivo-Tamatave</option>
              <option value="RN5">RN5 - Exemple 2</option>
              <option value="RN10">RN10 - Exemple 3</option>
            </select>
          </div>
        </div>

        <div className="col-md-4">
          <label className="form-label fw-bold small" htmlFor="ppm-objet">OBJET / RÉSUMÉ</label>
          <input id="ppm-objet" className="filter-select" defaultValue={market.objet} />
        </div>

        <div className="col-12">
          <label className="form-label fw-bold small" htmlFor="ppm-description">DESCRIPTION DES TRAVAUX</label>
          <textarea id="ppm-description" className="form-control marche-textarea" rows={3} defaultValue={market.objet} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-bold small" htmlFor="ppm-responsable">INSTITUTION RESPONSABLE</label>
          <select id="ppm-responsable" className="filter-select" defaultValue={market.mdc || ''}>
            <option value="">-- Non spécifié --</option>
            <option value="AR">AR — Agence Routière</option>
            <option value="DINFRA">DINFRA — Direction des Infrastructures</option>
            <option value="DER">DER — Direction de l'Entretien Routier</option>
            <option value="DAU">DAU — Direction de l'Aménagement Urbain</option>
            <option value="CCP">CCP — Cellule de Coordination des Projets</option>
            <option value="PACFC">PACFC</option>
            <option value="PCMCI">PCMCI</option>
            <option value="PDDR">PDDR</option>
          </select>
        </div>

        <div className="col-md-6">
          <div className="marche-alert-box">
            <label className="form-label fw-bold small" htmlFor="ppm-financement">
              <MagnifyingGlass size={14} weight="bold" aria-hidden="true" />
              SOURCE DE FINANCEMENT
            </label>
            <select id="ppm-financement" className="filter-select" defaultValue={market.financement || 'RPI'}>
              <option value="RPI">RPI — Ressources Propres Internes</option>
              <option value="FR">FR — Fonds Routier</option>
              <option value="FIN_EX">FIN_EX — Financement Extérieur</option>
              <option value="Rech_finan">En recherche de financement</option>
              <option value="AUTRE">Autre</option>
            </select>
            <div className="form-text tiny">Sélectionnez la source de financement attribuée ou prévisionnelle.</div>
          </div>
        </div>
      </div>

      {/* 2. BUDGET & 3. PLANNING */}
      <div className="row g-3 mb-4 mx-0">
        <div className="col-md-5">
          <div className="p-3 bg-white rounded shadow-sm h-100">
            <h6 className="marche-section__title small fw-bold border-bottom pb-2 mb-3">
              <CurrencyCircleDollar size={18} weight="bold" aria-hidden="true" />
              2. BUDGET DÉTAILLÉ
            </h6>

            <div className="mb-3">
              <label className="form-label fw-bold small" htmlFor="ppm-num-marche">N° DU MARCHÉ</label>
              <input id="ppm-num-marche" className="filter-select" defaultValue={market.id} />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small" htmlFor="ppm-montant">Montant total (Ar)</label>
              <div className="input-group marche-input-group">
                <input id="ppm-montant" className="filter-select" inputMode="decimal" defaultValue="245000000" />
                <span className="input-group-text">Ar</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small" htmlFor="ppm-detail-fin">Détails financement</label>
              <input id="ppm-detail-fin" className="filter-select" defaultValue="BAD 60 % / Budget national 40 %" />
            </div>

            <div>
              <label className="form-label fw-bold small" htmlFor="ppm-titulaire">Entreprise titulaire</label>
              <input id="ppm-titulaire" className="filter-select" defaultValue={market.titulaire} />
            </div>
          </div>
        </div>

        <div className="col-md-7">
          <div className="p-3 bg-white rounded shadow-sm h-100">
            <h6 className="marche-section__title small fw-bold border-bottom pb-2 mb-3">
              <CalendarBlank size={18} weight="bold" aria-hidden="true" />
              3. PLANNING ET TIERS
            </h6>

            <div className="mb-3">
              <label className="form-label fw-bold small" htmlFor="ppm-mdc">Maître d'œuvre / Contrôle</label>
              <input id="ppm-mdc" className="filter-select" defaultValue={market.mdc} />
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-bold small" htmlFor="ppm-date-os">Date OS N°1</label>
                <input id="ppm-date-os" type="date" className="filter-select" defaultValue="2026-09-16" />
              </div>

              <div className="col-md-8">
                <label className="form-label fw-bold small" htmlFor="ppm-delai-nombre">Délai contractuel</label>
                <div className="input-group marche-input-group">
                  <input
                    id="ppm-delai-nombre"
                    className="filter-select"
                    inputMode="numeric"
                    aria-label="Nombre de l'unité de délai"
                    defaultValue="12"
                  />
                  <select className="filter-select marche-input-group__unit" aria-label="Unité du délai" defaultValue="MOIS">
                    <option value="MOIS">Mois</option>
                    <option value="JOURS">Jours</option>
                  </select>
                  <span className="input-group-text">+</span>
                  <input className="filter-select" inputMode="numeric" aria-label="Jours supplémentaires" defaultValue="0" />
                  <span className="input-group-text">j</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TRAVAUX GLISSÉS */}
      <div className="panel mb-4">
        <div className="panel-header">
          <div className="panel-header__title">
            <Stack size={18} weight="bold" aria-hidden="true" />
            <h6 className="small fw-bold mb-0">4. TRAVAUX GLISSÉS</h6>
          </div>
        </div>
        <div className="panel-body">
          <div className="glissement-item p-3 border rounded shadow-sm bg-white">
            <div className="row g-3 mb-3">
              <div className="col-md-2">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-origine">Année origine</label>
                <input id="ppm-gliss-origine" type="number" className="filter-select" defaultValue="2025" />
              </div>
              <div className="col-md-2">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-report">Reporté en</label>
                <input id="ppm-gliss-report" type="number" className="filter-select" defaultValue="2026" />
              </div>
              <div className="col-md-4">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-reliquat">Reliquat (Ar)</label>
                <div className="input-group marche-input-group">
                  <input id="ppm-gliss-reliquat" className="filter-select" inputMode="decimal" defaultValue="84000000" />
                  <span className="input-group-text">Ar</span>
                </div>
              </div>
              <div className="col-md-4">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-passation">État passation</label>
                <select id="ppm-gliss-passation" className="filter-select" defaultValue="LANCEMENT">
                  <option value="LANCEMENT">Lancement</option>
                  <option value="ATTRIBUTION">Attribution</option>
                  <option value="CONTRAT">Contrat</option>
                </select>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-3">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-auc">Statut AUC</label>
                <select id="ppm-gliss-auc" className="filter-select" defaultValue="EN_ATTENTE">
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="OBTENU">Obtenu</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-date-auc">Date AUC</label>
                <input id="ppm-gliss-date-auc" type="date" className="filter-select" defaultValue="2026-03-15" />
              </div>
              <div className="col-md-6">
                <label className="tiny fw-bold" htmlFor="ppm-gliss-observation">Observation</label>
                <input id="ppm-gliss-observation" className="filter-select" defaultValue="Travaux ralentis par conditions météo" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
        <button type="button" className="btn btn-ghost" onClick={() => onClose()}>Annuler</button>
        <button type="submit" className="btn btn-primary">VALIDER ET ENREGISTRER</button>
      </div>
    </form>
  )
}
