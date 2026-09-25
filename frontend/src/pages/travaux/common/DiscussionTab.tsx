import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Camera,
  ChatCircleDots,
  DownloadSimple,
  FileText,
  HandWaving,
  HardHat,
  Image as ImageIcon,
  Paperclip,
  PaperPlaneRight,
  Smiley,
  X,
} from '@phosphor-icons/react'
import { createMessage, deleteMessage, fetchMessages } from '../../../api/travaux.api'
import type { MessageMarcheItem } from '../../../types/travaux'
import MessageRowActions from './actions/MessageRowActions'

/** Cadence de relecture du fil : assez fréquente pour suivre l'échange, assez
 *  espacée pour ne pas marteler l'API. */
const RAFRAICHISSEMENT_MS = 20000

const formatDateTime = (s: string) => {
  try {
    const d = new Date(s)
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return s
  }
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const initiales = (nom: string) =>
  nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('') || '?'

const EMOJIS_POPULAIRES = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
  '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎',
  '🥳', '🤔', '🤫', '🤐', '😴', '🥺', '😭', '😱', '😡', '👍',
  '👎', '👌', '✌️', '👏', '🙌', '🤝', '🙏', '💪', '❤️', '🔥',
  '✨', '⭐', '🎉', '🚀', '💯', '🎯', '💡', '💬', '👀'
]

const EMOJIS_CHANTIER = [
  '🏗️', '🚧', '🚜', '🛣️', '🧱', '🔨', '🛠️', '🔧', '📐', '📏',
  '📋', '📁', '📌', '📍', '⚠️', 'ℹ️', '⏳', '⏰', '📅', '✅',
  '❌', '🟢', '🟡', '🔴', '🚗', '🚚', '🚛', '🏢', '🏠', '🌦️',
  '☀️', '🌧️', '⚡', '💧', '🦺', '🪵', '⚙️', '🔍', '📦', '🏷️'
]

type DiscussionTabProps = {
  marcheId: string
}

/**
 * Onglet « Discussion » : fil de messages entre les utilisateurs à propos du
 * marché. Les messages sont persistés côté API, donc partagés et conservés
 * au rechargement. Supporte le texte, les photos/fichiers et les émojis.
 */
export default function DiscussionTab({ marcheId }: DiscussionTabProps) {
  const [messages, setMessages] = useState<MessageMarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [contenu, setContenu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Pièce jointe en cours
  const [fichier, setFichier] = useState<File | null>(null)
  const [fichierPreview, setFichierPreview] = useState<string | null>(null)

  // Sélecteur d'émojis
  const [showEmoji, setShowEmoji] = useState(false)
  const [emojiTab, setEmojiTab] = useState<'populaires' | 'chantier'>('populaires')
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ bottom: number; right: number } | null>(null)
  // Position mémorisée du curseur dans le textarea (avant que le clic sur emoji ne déplace le focus)
  const cursorPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })

  // Lightbox pour agrandir les images
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxNom, setLightboxNom] = useState<string | null>(null)

  const filRef = useRef<HTMLDivElement>(null)
  const carteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)

  // Fermer le sélecteur d'émojis si clic en dehors (mais pas sur le bouton qui le gère lui-même)
  useEffect(() => {
    if (!showEmoji) return
    const handleClickOutside = (e: MouseEvent) => {
      const clickedOutsidePicker = emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)
      const clickedOutsideBtn = emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)
      if (clickedOutsidePicker && clickedOutsideBtn) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  // Ajustement de la hauteur de la carte
  useLayoutEffect(() => {
    const carte = carteRef.current
    if (!carte) return

    const ajuster = () => {
      const margeBasse = carte.closest('main')
        ? parseFloat(getComputedStyle(carte.closest('main')!).paddingBottom) || 0
        : 0
      const haut = carte.getBoundingClientRect().top + window.scrollY
      carte.style.height = `${Math.max(480, window.innerHeight - haut - margeBasse)}px`
    }

    ajuster()
    window.addEventListener('resize', ajuster)

    return () => {
      window.removeEventListener('resize', ajuster)
      carte.style.height = ''
    }
  }, [])

  useEffect(() => {
    let actif = true

    const charger = () => {
      if (!actif) return
      fetchMessages(marcheId)
        .then((data) => {
          if (!actif) return
          setMessages(data)
          setErreur(null)
        })
        .catch(() => {
          if (actif) setErreur('Impossible de charger la discussion.')
        })
        .finally(() => {
          if (actif) setLoading(false)
        })
    }

    charger()
    const timer = window.setInterval(charger, RAFRAICHISSEMENT_MS)

    return () => {
      actif = false
      window.clearInterval(timer)
    }
  }, [marcheId])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (smooth = false) => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
      } else if (filRef.current) {
        filRef.current.scrollTop = filRef.current.scrollHeight
      }
    })
  }

  // Scroll vers le bas à l'arrivée de messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false)
    }
  }, [messages.length])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFichier(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFichierPreview(url)
    } else {
      setFichierPreview(null)
    }
    e.target.value = ''
  }

  const supprimerFichier = () => {
    if (fichierPreview) {
      URL.revokeObjectURL(fichierPreview)
    }
    setFichier(null)
    setFichierPreview(null)
  }

  const insererEmoji = (emoji: string) => {
    // Utilise la position mémorisée du curseur (le focus est déjà passé au bouton emoji)
    const { start, end } = cursorPosRef.current
    const nouveau = contenu.substring(0, start) + emoji + contenu.substring(end)
    const curseurApres = start + [...emoji].length  // correct pour les emoji multi-codepoints
    setContenu(nouveau)
    // Ajustement de la hauteur de la textarea
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(120, textarea.scrollHeight)}px`
      }
      // Mémorise la nouvelle position du curseur pour les émojis suivants
      cursorPosRef.current = { start: curseurApres, end: curseurApres }
    })
  }

  const envoyer = async () => {
    const texte = contenu.trim()
    if ((!texte && !fichier) || envoi) return

    setEnvoi(true)
    setErreur(null)
    try {
      const message = await createMessage({ marche: marcheId, contenu: texte, fichier })
      setMessages((prev) => [...prev, message])
      setContenu('')
      supprimerFichier()
      setShowEmoji(false)
      setTimeout(() => scrollToBottom(true), 50)
    } catch {
      setErreur("Le message n'a pas pu être envoyé.")
    } finally {
      setEnvoi(false)
    }
  }

  const supprimer = async (message: MessageMarcheItem) => {
    if (!window.confirm('Supprimer ce message ?')) return
    try {
      await deleteMessage(message.id)
      setMessages((prev) => prev.filter((m) => m.id !== message.id))
    } catch {
      setErreur('Impossible de supprimer ce message.')
    }
  }

  const sameAuthor = (a?: MessageMarcheItem, b?: MessageMarcheItem) => !!a && !!b && a.auteur === b.auteur
  const closeInTime = (a?: MessageMarcheItem, b?: MessageMarcheItem, ms = 5 * 60 * 1000) => {
    if (!a || !b) return false
    try {
      return Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < ms
    } catch {
      return false
    }
  }

  return (
    <div
      ref={carteRef}
      className="card border-0 shadow-sm"
      style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 480, overflow: 'hidden' }}
    >
      <div
        className="card-header py-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
        style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(var(--primary-rgb, 14, 165, 233), 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChatCircleDots size={22} weight="duotone" />
          </div>
          <div>
            <h6 className="mb-0 fw-bold" style={{ color: 'var(--text-strong)' }}>Discussion du marché</h6>
            <span className="text-muted small discussion-sous-titre">Échanges et suivi entre les utilisateurs</span>
          </div>
        </div>
        <span
          className="badge rounded-pill"
          style={{
            background: 'var(--panel-soft)',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {messages.length} message{messages.length > 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={filRef}
        className="discussion-fil"
        style={{ flex: 1 }}
      >
        {loading ? (
          <p className="text-muted small mb-0 text-center py-4">Chargement de la discussion…</p>
        ) : messages.length === 0 ? (
          <div className="discussion-vide-box">
            <div className="discussion-vide-icon-wrapper">
              <ChatCircleDots size={34} weight="duotone" />
            </div>
            <div className="discussion-vide-titre">Discussion sur ce marché</div>
            <div className="discussion-vide-desc">
              Communiquez en direct avec les intervenants sur ce marché. Posez vos questions, signalez un imprévu ou partagez des photos de chantier.
            </div>
            <div className="discussion-vide-suggestions">
              <button
                type="button"
                className="discussion-suggestion-btn"
                onClick={() => {
                  setContenu('Bonjour à tous !')
                  textareaRef.current?.focus()
                }}
              >
                <HandWaving size={15} weight="bold" /> Saluer l'équipe
              </button>
              <button
                type="button"
                className="discussion-suggestion-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} weight="bold" /> Joindre une photo
              </button>
              <button
                type="button"
                className="discussion-suggestion-btn"
                onClick={() => {
                  setContenu('Bonjour, quel est le point de situation des travaux ?')
                  textareaRef.current?.focus()
                }}
              >
                <HardHat size={15} weight="bold" /> Point de situation
              </button>
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const next = messages[i + 1]
            const firstInGroup = !prev || !sameAuthor(prev, m) || !closeInTime(prev, m)
            const lastInGroup = !next || !sameAuthor(next, m) || !closeInTime(m, next)

            if (m.est_moi) {
              return (
                <div key={m.id} className="discussion-message">
                  <div className="discussion-row-inner is-me" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="discussion-content">
                      <div className={`discussion-bubble is-me ${firstInGroup ? 'first' : ''} ${lastInGroup ? 'last' : ''}`}>
                        {m.fichier_url && (
                          <div className="discussion-bubble-attachment">
                            {m.est_image ? (
                              <img
                                src={m.fichier_url}
                                alt={m.fichier_nom ?? 'Photo'}
                                className="discussion-attachment-image"
                                onClick={() => {
                                  setLightboxUrl(m.fichier_url!)
                                  setLightboxNom(m.fichier_nom ?? 'Photo')
                                }}
                                title="Agrandir la photo"
                              />
                            ) : (
                              <a
                                href={m.fichier_url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="discussion-attachment-file"
                                download={m.fichier_nom ?? true}
                              >
                                <FileText size={24} weight="duotone" />
                                <div className="discussion-file-info">
                                  <span className="discussion-file-name">{m.fichier_nom ?? 'Fichier joint'}</span>
                                  {m.fichier_taille && <span className="discussion-file-size">{formatFileSize(m.fichier_taille)}</span>}
                                </div>
                                <DownloadSimple size={18} weight="bold" />
                              </a>
                            )}
                          </div>
                        )}

                        {m.contenu && <div>{m.contenu}</div>}

                        <div className="message-actions-inline">
                          <MessageRowActions message={m} onEdit={() => window.alert('Modifier — à implémenter')} onDelete={() => supprimer(m)} />
                        </div>
                      </div>
                      {lastInGroup && (
                        <div className="text-muted small message-time" style={{ marginTop: 4 }}>{formatDateTime(m.created_at)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            // Messages des autres utilisateurs
            return (
              <div key={m.id} className="discussion-message">
                <div className="discussion-row-inner is-other" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div className="discussion-avatar" title={m.auteur_nom} aria-hidden="true">{firstInGroup ? initiales(m.auteur_nom) : ''}</div>

                  <div className="discussion-content">
                    {firstInGroup && (
                      <div className="discussion-meta" style={{ marginBottom: 4 }}>
                        <span className="fw-bold small" style={{ color: 'var(--text-strong)' }}>{m.auteur_nom}</span>
                      </div>
                    )}

                    <div className={`discussion-bubble ${firstInGroup ? 'first' : ''} ${lastInGroup ? 'last' : ''}`}>
                      {m.fichier_url && (
                        <div className="discussion-bubble-attachment">
                          {m.est_image ? (
                            <img
                              src={m.fichier_url}
                              alt={m.fichier_nom ?? 'Photo'}
                              className="discussion-attachment-image"
                              onClick={() => {
                                setLightboxUrl(m.fichier_url!)
                                setLightboxNom(m.fichier_nom ?? 'Photo')
                              }}
                              title="Agrandir la photo"
                            />
                          ) : (
                            <a
                              href={m.fichier_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="discussion-attachment-file"
                              download={m.fichier_nom ?? true}
                            >
                              <FileText size={24} weight="duotone" />
                              <div className="discussion-file-info">
                                <span className="discussion-file-name">{m.fichier_nom ?? 'Fichier joint'}</span>
                                {m.fichier_taille && <span className="discussion-file-size">{formatFileSize(m.fichier_taille)}</span>}
                              </div>
                              <DownloadSimple size={18} weight="bold" />
                            </a>
                          )}
                        </div>
                      )}

                      {m.contenu && <div>{m.contenu}</div>}
                    </div>

                    {lastInGroup && (
                      <div className="text-muted small message-time" style={{ marginTop: 4 }}>{formatDateTime(m.created_at)}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
      </div>

      <div className="discussion-pied border-top" style={{ borderColor: 'var(--border)', flexShrink: 0 }}>
        {erreur && <p className="small mb-2" style={{ color: 'var(--danger)' }}>{erreur}</p>}

        {/* Aperçu du fichier joint avant l'envoi */}
        {fichier && (
          <div className="discussion-piece-jointe-preview">
            {fichierPreview ? (
              <div className="discussion-piece-jointe-img-wrap">
                <img src={fichierPreview} alt="Aperçu photo" />
              </div>
            ) : (
              <div className="discussion-piece-jointe-icon-wrap">
                <FileText size={26} weight="duotone" />
              </div>
            )}
            <div className="discussion-piece-jointe-details">
              <span className="discussion-piece-jointe-tag">
                {fichierPreview ? 'Photo prête à l\'envoi' : 'Document joint'}
              </span>
              <span className="discussion-piece-jointe-nom">{fichier.name}</span>
              <span className="discussion-piece-jointe-taille">{formatFileSize(fichier.size)}</span>
            </div>
            <button
              type="button"
              className="discussion-piece-jointe-supprimer"
              onClick={supprimerFichier}
              title="Retirer la pièce jointe"
              aria-label="Retirer"
            >
              <X size={15} weight="bold" />
            </button>
          </div>
        )}

        {/* Sélecteur d'émojis popover — position fixed calculée depuis le bouton */}
        {showEmoji && emojiPickerPos && (
          <div
            ref={emojiPickerRef}
            className="discussion-emoji-popover"
            style={{
              bottom: emojiPickerPos.bottom,
              right: emojiPickerPos.right,
            }}
          >
            <div className="discussion-emoji-tabs">
              <button
                type="button"
                className={`discussion-emoji-tab ${emojiTab === 'populaires' ? 'is-active' : ''}`}
                onClick={() => setEmojiTab('populaires')}
              >
                😀 Émojis
              </button>
              <button
                type="button"
                className={`discussion-emoji-tab ${emojiTab === 'chantier' ? 'is-active' : ''}`}
                onClick={() => setEmojiTab('chantier')}
              >
                🏗️ Travaux
              </button>
            </div>
            <div className="discussion-emoji-grid">
              {(emojiTab === 'populaires' ? EMOJIS_POPULAIRES : EMOJIS_CHANTIER).map((em) => (
                <button
                  key={em}
                  type="button"
                  className="discussion-emoji-btn"
                  onMouseDown={(e) => {
                    // Empêche le blur du textarea pour conserver la position du curseur
                    e.preventDefault()
                    insererEmoji(em)
                  }}
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Champ de fichier masqué */}
        <input
          ref={fileInputRef}
          type="file"
          className="d-none"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
          onChange={handleFileChange}
        />

        {/* Barre de saisie capsule unifiée : [📎] [textarea] [😊] [➤] */}
        <div className="discussion-composeur-box">
          {/* Bouton pièce jointe — à gauche */}
          <button
            type="button"
            className="discussion-outil-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Joindre une photo ou un fichier"
            aria-label="Joindre un fichier"
          >
            <Paperclip size={18} weight="bold" />
          </button>

          <textarea
            ref={textareaRef}
            className="form-control discussion-textarea"
            rows={1}
            value={contenu}
            placeholder={fichier ? 'Ajouter une légende…' : 'Écrire un message…'}
            aria-label="Nouveau message"
            onChange={(event) => {
              setContenu(event.target.value)
              const el = event.target
              el.style.height = 'auto'
              el.style.height = `${Math.min(120, el.scrollHeight)}px`
            }}
            onSelect={(event) => {
              // Mémorise la position du curseur avant que le focus ne quitte la textarea
              const el = event.currentTarget
              cursorPosRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
            }}
            onKeyUp={(event) => {
              const el = event.currentTarget
              cursorPosRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                envoyer()
              }
            }}
          />

          {/* Bouton émoji — à droite du champ */}
          <button
            ref={emojiBtnRef}
            type="button"
            className={`discussion-outil-btn ${showEmoji ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              // Garde le focus du textarea en empêchant le comportement par défaut
              e.preventDefault()
              // Calcule la position du popover depuis le bouton
              const btn = emojiBtnRef.current
              if (btn) {
                const rect = btn.getBoundingClientRect()
                setEmojiPickerPos({
                  bottom: window.innerHeight - rect.top + 8,
                  right: window.innerWidth - rect.right,
                })
              }
              setShowEmoji((v) => !v)
            }}
            title="Ajouter un émoji"
            aria-label="Émojis"
          >
            <Smiley size={18} weight="bold" />
          </button>

          <button
            type="button"
            className={`discussion-envoyer-btn ${(contenu.trim().length > 0 || Boolean(fichier)) && !envoi ? 'is-active' : ''}`}
            onClick={envoyer}
            disabled={(!contenu.trim() && !fichier) || envoi}
            aria-label={envoi ? 'Envoi en cours…' : 'Envoyer'}
            title={envoi ? 'Envoi en cours…' : 'Envoyer'}
          >
            <PaperPlaneRight size={17} weight="bold" />
          </button>
        </div>

        <p className="text-muted small mb-0 mt-2 discussion-aide">
          Entrée pour envoyer, Maj+Entrée pour revenir à la ligne.
        </p>
      </div>

      {/* Lightbox / Agrandissement d'une photo */}
      {lightboxUrl && (
        <div className="discussion-lightbox-backdrop" onClick={() => setLightboxUrl(null)}>
          <div className="discussion-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="discussion-lightbox-close"
              onClick={() => setLightboxUrl(null)}
              title="Fermer"
              aria-label="Fermer"
            >
              <X size={20} weight="bold" />
            </button>
            <img src={lightboxUrl} alt={lightboxNom ?? 'Photo'} className="discussion-lightbox-img" />
            <a
              href={lightboxUrl}
              download={lightboxNom ?? 'photo'}
              className="discussion-lightbox-download"
              target="_blank"
              rel="noreferrer"
            >
              <DownloadSimple size={18} weight="bold" />
              Télécharger la photo
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

