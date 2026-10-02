import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AnchorSimple,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Compass,
  Eye,
  Globe,
  MapPin,
  MapTrifold,
  WarningCircle,
  X,
  Funnel,
  Stack,
  RoadHorizon,
  CurrencyCircleDollar,
  Buildings,
  NavigationArrow,
} from '@phosphor-icons/react'
import { fetchMarches, fetchBacs, fetchMarcheGeoJSON, type MarcheCartoFeatureCollection } from '../../api/travaux.api'
import type { MarcheItem, BacItem } from '../../types/travaux'
import './CartographieView.css'

export type RouteConfig = {
  id: string
  name: string
  code: string
  file: string
  defaultColor: string
  description: string
}

export type RouteStatusType = 'en_cours' | 'retard' | 'acheve' | 'arrete' | 'aucun'
export type StatusFilterType = 'all' | RouteStatusType

const ROUTES: RouteConfig[] = [
  { id: 'RN 1', name: 'Route Nationale 1', code: 'RN 1', file: '/data/routes_osm/RN1.geojson', defaultColor: '#38bdf8', description: 'Antananarivo – Analavory – Tsiroanomandidy' },
  { id: 'RN 2', name: 'Route Nationale 2', code: 'RN 2', file: '/data/routes_osm/RN2.geojson', defaultColor: '#34d399', description: 'Antananarivo – Moramanga – Toamasina' },
  { id: 'RN 4', name: 'Route Nationale 4', code: 'RN 4', file: '/data/routes_osm/RN4.geojson', defaultColor: '#fbbf24', description: 'Antananarivo – Mahajanga' },
  { id: 'RN 7', name: 'Route Nationale 7', code: 'RN 7', file: '/data/routes_osm/RN7.geojson', defaultColor: '#f87171', description: 'Antananarivo – Antsirabe – Fianarantsoa – Toliara' },
  { id: 'RN 43', name: 'Route Nationale 43', code: 'RN 43', file: '/data/routes_osm/RN43.geojson', defaultColor: '#a78bfa', description: 'Analavory – Ampefy – Ambohibary' },
  { id: 'RN 44', name: 'Route Nationale 44', code: 'RN 44', file: '/data/routes_osm/RN44.geojson', defaultColor: '#f472b6', description: 'Moramanga – Ambatondrazaka' },
]

const STATUS_CONFIG: Record<RouteStatusType, { label: string; color: string }> = {
  retard: { label: 'En retard', color: '#ef4444' },
  en_cours: { label: 'En cours', color: '#38bdf8' },
  acheve: { label: 'Achevé', color: '#10b981' },
  arrete: { label: 'Arrêté', color: '#f59e0b' },
  aucun: { label: 'Sans marché', color: '#64748b' },
}

const TILE_PROVIDERS = {
  sombre: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Dark Gray Canvas',
    name: 'Sombre',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; World Imagery',
    name: 'Satellite',
  },
  clair: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    name: 'Standard',
  },
}

// Découpe précise d'un sous-segment le long d'une polyligne ordonnée avec PK
function getSegmentCoords(
  points: [number, number, number][],
  pkStart: number,
  pkEnd: number,
): [number, number][] {
  const min = Math.min(pkStart, pkEnd)
  const max = Math.max(pkStart, pkEnd)
  const slice: [number, number][] = []

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const km = p[2]

    if (km >= min && km <= max) {
      if (slice.length === 0 && i > 0 && points[i - 1][2] < min) {
        const prev = points[i - 1]
        const ratio = (min - prev[2]) / (km - prev[2] || 1)
        slice.push([prev[0] + (p[0] - prev[0]) * ratio, prev[1] + (p[1] - prev[1]) * ratio])
      }
      slice.push([p[0], p[1]])
    } else if (km > max) {
      if (slice.length > 0 && i > 0 && points[i - 1][2] <= max) {
        const prev = points[i - 1]
        const ratio = (max - prev[2]) / (km - prev[2] || 1)
        slice.push([prev[0] + (p[0] - prev[0]) * ratio, prev[1] + (p[1] - prev[1]) * ratio])
      }
      break
    }
  }

  // Cas où l'intervalle est très court
  if (slice.length === 0 && points.length > 1) {
    for (let i = 1; i < points.length; i++) {
      if (points[i - 1][2] <= min && points[i][2] >= max) {
        const p1 = points[i - 1]
        const p2 = points[i]
        const r1 = (min - p1[2]) / (p2[2] - p1[2] || 1)
        const r2 = (max - p1[2]) / (p2[2] - p1[2] || 1)
        slice.push([p1[0] + (p2[0] - p1[0]) * r1, p1[1] + (p2[1] - p1[1]) * r1])
        slice.push([p1[0] + (p2[0] - p1[0]) * r2, p1[1] + (p2[1] - p1[1]) * r2])
        break
      }
    }
  }

  return slice
}

export function CartographieView() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const layersRef = useRef<{ [key: string]: L.GeoJSON }>({})
  const bacMarkersLayerRef = useRef<L.LayerGroup | null>(null)
  const workSegmentsLayerRef = useRef<L.LayerGroup | null>(null)
  const baseTileLayerRef = useRef<L.TileLayer | null>(null)
  const linearRoutesRef = useRef<Record<string, { total_km: number; points: [number, number, number][] }>>({})
  const marcheGeoCacheRef = useRef<Record<string, MarcheCartoFeatureCollection>>({})

  const [marches, setMarches] = useState<MarcheItem[]>([])
  const [marcheGeoRevision, setMarcheGeoRevision] = useState(0)
  const [linearRoutesRevision, setLinearRoutesRevision] = useState(0)
  const [bacs, setBacs] = useState<BacItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtres & options
  const [selectedRoute, setSelectedRoute] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all')
  const [colorMode, setColorMode] = useState<'status' | 'route'>('status')
  const [baseMap, setBaseMap] = useState<'satellite' | 'clair'>('clair')
  const [showBacs, setShowBacs] = useState<boolean>(true)
  const [activeDrawerAxe, setActiveDrawerAxe] = useState<RouteConfig | null>(null)
  const [drawerMarcheTab, setDrawerMarcheTab] = useState<'all' | 'retard' | 'en_cours' | 'acheve'>('all')

  // Marché sélectionné
  const [selectedMarcheId, setSelectedMarcheId] = useState<string | null>(null)

  // Chargement des données et des données linéaires PK
  const loadData = useCallback(async () => {
    marcheGeoCacheRef.current = {}
    setMarcheGeoRevision((v) => v + 1)
    try {
      const [marchesData, bacsData, linearData] = await Promise.allSettled([
        fetchMarches(),
        fetchBacs(),
        fetch('/data/routes_osm/routes_linear.json').then((r) => r.json()),
      ])
      if (marchesData.status === 'fulfilled') setMarches(marchesData.value ?? [])
      if (bacsData.status === 'fulfilled') setBacs(bacsData.value ?? [])
      if (linearData.status === 'fulfilled') {
        linearRoutesRef.current = linearData.value ?? {}
        setLinearRoutesRevision((v) => v + 1)
      }
    } catch (err) {
      console.error('Erreur chargement données cartographie:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // Association des marchés à un axe
  const getMarchesForRoute = useCallback(
    (route: RouteConfig): MarcheItem[] => {
      const codeNorm = route.code.toUpperCase().replace(/\s+/g, '')
      const idNorm = route.id.toUpperCase().replace(/\s+/g, '')
      return marches.filter((m) => {
        const axeStr = ((m.axe_detail?.designation || m.axe || '') + ' ' + (m.resume || '')).toUpperCase().replace(/\s+/g, '')
        return axeStr.includes(codeNorm) || axeStr.includes(idNorm)
      })
    },
    [marches],
  )

  // Trouver l'axe associé à un marché donné
  const getRouteForMarche = useCallback(
    (m: MarcheItem): RouteConfig | undefined => {
      const axeStr = ((m.axe_detail?.designation || m.axe || '') + ' ' + (m.resume || '')).toUpperCase()
      return ROUTES.find(
        (r) => axeStr.includes(r.code.replace(/\s+/g, '')) || axeStr.includes(r.id.replace(/\s+/g, '')),
      )
    },
    [],
  )

  const marcheHasPkSegments = useCallback((m: MarcheItem): boolean => {
    if (m.segments_pk && m.segments_pk.length > 0) return true
    if (m.pk_debut != null && m.pk_fin != null) return true
    return false
  }, [])

  // Tracés GeoJSON précis (backend EPSG:29701)
  useEffect(() => {
    let cancelled = false

    const marchesToFetch = marches.filter((m) => getRouteForMarche(m) && marcheHasPkSegments(m))
    if (marchesToFetch.length === 0) return () => { cancelled = true }

    Promise.allSettled(
      marchesToFetch.map(async (m) => {
        const id = String(m.id)
        if (marcheGeoCacheRef.current[id]) return
        const fc = await fetchMarcheGeoJSON(id)
        if (fc?.features?.length) {
          marcheGeoCacheRef.current[id] = fc
        }
      }),
    ).then(() => {
      if (!cancelled) setMarcheGeoRevision((v) => v + 1)
    })

    return () => {
      cancelled = true
    }
  }, [marches, getRouteForMarche, marcheHasPkSegments])

  // Statut consolidé pour chaque axe
  const routeStatusMap = useMemo(() => {
    const map = new Map<string, {
      status: RouteStatusType
      label: string
      color: string
      marchesCount: number
      marchesRetardCount: number
      avgPhysique: number
      totalMontant: number
      minPk: number | null
      maxPk: number | null
      hasPkMarches: boolean
    }>()

    ROUTES.forEach((route) => {
      const marchesAxe = getMarchesForRoute(route)
      const count = marchesAxe.length

      if (count === 0) {
        map.set(route.id, {
          status: 'aucun',
          label: STATUS_CONFIG.aucun.label,
          color: STATUS_CONFIG.aucun.color,
          marchesCount: 0,
          marchesRetardCount: 0,
          avgPhysique: 0,
          totalMontant: 0,
          minPk: null,
          maxPk: null,
          hasPkMarches: false,
        })
        return
      }

      const marchesRetard = marchesAxe.filter((m) => m.dernier_avancement?.est_en_retard)
      const marchesAcheves = marchesAxe.filter(
        (m) => m.dernier_avancement?.situation_w === 'Acheve' || (m.dernier_avancement?.avancement_physique ?? 0) >= 100,
      )
      const marchesArretes = marchesAxe.filter((m) => m.dernier_avancement?.situation_w === 'Arrete')

      const marchesWithAv = marchesAxe.filter((m) => m.dernier_avancement != null)
      const avgPhysique = marchesWithAv.length
        ? Math.round(
            marchesWithAv.reduce((acc, m) => acc + (m.dernier_avancement?.avancement_physique || 0), 0) /
              marchesWithAv.length,
          )
        : 0

      const totalMontant = marchesAxe.reduce((acc, m) => acc + (Number(m.montant) || 0), 0)

      const hasPkMarches = marchesAxe.some(
        (m) =>
          (m.segments_pk && m.segments_pk.length > 0) ||
          (m.pk_debut != null && m.pk_fin != null && !isNaN(Number(m.pk_debut)) && !isNaN(Number(m.pk_fin))),
      )

      const pksDeb = marchesAxe.flatMap((m) => {
        if (m.segments_pk?.length) {
          return m.segments_pk.map((s) => Number(s.pk_debut)).filter((n) => !isNaN(n))
        }
        const deb = Number(m.pk_debut)
        return !isNaN(deb) ? [deb] : []
      })
      const pksFin = marchesAxe.flatMap((m) => {
        if (m.segments_pk?.length) {
          return m.segments_pk.map((s) => Number(s.pk_fin)).filter((n) => !isNaN(n))
        }
        const fin = Number(m.pk_fin)
        return !isNaN(fin) ? [fin] : []
      })
      const minPk = pksDeb.length ? Math.min(...pksDeb, ...pksFin) : null
      const maxPk = pksFin.length ? Math.max(...pksDeb, ...pksFin) : null

      let status: RouteStatusType = 'en_cours'
      if (marchesRetard.length > 0) {
        status = 'retard'
      } else if (marchesAcheves.length === count) {
        status = 'acheve'
      } else if (marchesArretes.length > 0) {
        status = 'arrete'
      }

      map.set(route.id, {
        status,
        label: STATUS_CONFIG[status].label,
        color: STATUS_CONFIG[status].color,
        marchesCount: count,
        marchesRetardCount: marchesRetard.length,
        avgPhysique,
        totalMontant,
        minPk,
        maxPk,
        hasPkMarches,
      })
    })

    return map
  }, [getMarchesForRoute])

  // Compteurs pour les filtres de statut
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilterType, number> = {
      all: ROUTES.length,
      retard: 0,
      en_cours: 0,
      acheve: 0,
      arrete: 0,
      aucun: 0,
    }

    ROUTES.forEach((r) => {
      const info = routeStatusMap.get(r.id)
      if (info) {
        counts[info.status] = (counts[info.status] || 0) + 1
      }
    })

    return counts
  }, [routeStatusMap])

  // Statistiques pour les KPIs globaux
  const globalStats = useMemo(() => {
    const totalMarches = marches.length
    const marchesWithAv = marches.filter((m) => m.dernier_avancement)
    const avgPhysique = marchesWithAv.length
      ? Math.round(
          marchesWithAv.reduce((acc, m) => acc + (m.dernier_avancement?.avancement_physique || 0), 0) /
            marchesWithAv.length,
        )
      : 0
    const marchesEnRetard = marches.filter((m) => m.dernier_avancement?.est_en_retard).length
    const bacsGeoloc = bacs.filter((b) => b.latitude && b.longitude).length
    const bacsHorsUsage = bacs.filter((b) => b.etat_bac === 'Hors_usage').length

    return { totalMarches, avgPhysique, marchesEnRetard, bacsTotal: bacs.length, bacsGeoloc, bacsHorsUsage }
  }, [marches, bacs])

  const selectedMarche = useMemo(() => {
    if (!selectedMarcheId) return null
    return marches.find((m) => String(m.id) === String(selectedMarcheId)) || null
  }, [selectedMarcheId, marches])

  // Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [-18.8792, 47.5079],
      zoom: 6,
      zoomControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    const initialTile = L.tileLayer(TILE_PROVIDERS.clair.url, {
      attribution: TILE_PROVIDERS.clair.attribution,
      maxZoom: 19,
    }).addTo(map)

    baseTileLayerRef.current = initialTile

    const bacGroup = L.layerGroup().addTo(map)
    bacMarkersLayerRef.current = bacGroup

    const workSegmentsGroup = L.layerGroup().addTo(map)
    workSegmentsLayerRef.current = workSegmentsGroup

    // Chargement initial des GeoJSON
    ROUTES.forEach((route) => {
      fetch(route.file)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then((geojsonData) => {
          if (!mapRef.current) return

          const featureCollection = geojsonData && typeof geojsonData === 'object' && Array.isArray((geojsonData as { features?: unknown[] }).features)
            ? {
                ...geojsonData,
                features: ((geojsonData as { features?: unknown[] }).features ?? []).filter((feature) => {
                  if (!feature || typeof feature !== 'object') return false
                  const typedFeature = feature as { geometry?: { coordinates?: unknown } }
                  const coords = typedFeature.geometry?.coordinates
                  return Array.isArray(coords) && coords.length > 0
                }),
              }
            : { type: 'FeatureCollection', features: [] }

          if (!featureCollection.features.length) return

          const geojsonLayer = L.geoJSON(featureCollection, {
            style: {
              color: route.defaultColor,
              weight: 3.5,
              opacity: 0.6,
            },
            onEachFeature: (_, layer) => {
              layer.on({
                mouseover: (e) => {
                  const target = e.target as L.Path
                  target.setStyle({ weight: 6, opacity: 0.9 })
                  target.bringToFront()
                },
                mouseout: (e) => {
                  const target = e.target as L.Path
                  target.setStyle({
                    weight: selectedRoute === route.id ? 5 : 3.5,
                    opacity: selectedRoute === route.id ? 0.7 : 0.4,
                  })
                },
                click: () => {
                  setSelectedRoute(route.id)
                  setActiveDrawerAxe(route)
                },
              })
            },
          }).addTo(map)

          layersRef.current[route.id] = geojsonLayer
        })
        .catch((err) => {
          console.warn(`Impossible de charger le GeoJSON pour ${route.name}:`, err)
        })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Mise à jour du fond de carte
  useEffect(() => {
    if (!mapRef.current || !baseTileLayerRef.current) return

    baseTileLayerRef.current.remove()
    const provider = TILE_PROVIDERS[baseMap] || TILE_PROVIDERS.clair
    const newTile = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
    }).addTo(mapRef.current)

    baseTileLayerRef.current = newTile
  }, [baseMap])

  // RENDU DES TRONÇONS EXACTS [PK DÉBUT -> PK FIN] SUR LA CARTE
  useEffect(() => {
    if (!workSegmentsLayerRef.current || !mapRef.current) return
    workSegmentsLayerRef.current.clearLayers()

    const linearData = linearRoutesRef.current
    const hasLinearPk = linearData && Object.keys(linearData).length > 0

    // 1. Pour chaque axe, mettre à jour le style de la route de base (fond)
    ROUTES.forEach((route) => {
      const baseLayer = layersRef.current[route.id]
      if (!baseLayer) return

      const info = routeStatusMap.get(route.id)
      const hasPkMarches = info?.hasPkMarches
      const isAxeSelected = selectedRoute === 'all' || selectedRoute === route.id
      const isStatusMatched = statusFilter === 'all' || info?.status === statusFilter

      const hasVisiblePkSegments = marches.some((m) => {
        const sameRoute = getRouteForMarche(m)?.id === route.id
        if (!sameRoute) return false

        const av = m.dernier_avancement
        const phys = Number(av?.avancement_physique || 0)
        const isRetard = av?.est_en_retard
        const isAcheve = av?.situation_w === 'Acheve' || phys >= 100
        const isArrete = av?.situation_w === 'Arrete'
        const marcheStatus: RouteStatusType = isRetard ? 'retard' : isAcheve ? 'acheve' : isArrete ? 'arrete' : 'en_cours'

        return (statusFilter === 'all' || statusFilter === marcheStatus) && (selectedRoute === 'all' || selectedRoute === route.id)
      })

      const shouldFocusRoute = selectedRoute !== 'all'

      // En vue globale, on garde la route visible en fond pour ne pas la faire disparaître.
      // Le masquage n'est utile uniquement lorsqu'un axe particulier est explicitement sélectionné.
      if (hasPkMarches && hasVisiblePkSegments && shouldFocusRoute) {
        baseLayer.setStyle({
          color: '#334155',
          weight: 0,
          opacity: 0,
        })
      } else {
        // Sinon on réaffiche le fond de la route pour éviter qu'un axe entier disparaisse
        const isHighlighted = isAxeSelected && isStatusMatched
        const chosenColor = colorMode === 'status' ? info?.color || route.defaultColor : route.defaultColor

        baseLayer.setStyle({
          color: isHighlighted ? chosenColor : '#334155',
          weight: isHighlighted ? 4.5 : 2,
          opacity: isHighlighted ? 0.85 : 0.2,
        })
      }
    })

    // 2. Tracer spécifiquement les tronçons de marchés actifs [PK Début -> PK Fin]
    marches.forEach((m) => {
      const route = getRouteForMarche(m)
      if (!route) return

      const marcheGeo = marcheGeoCacheRef.current[String(m.id)]
      const apiFeatures =
        marcheGeo?.features?.filter(
          (f) => f.geometry?.type === 'LineString' && (f.geometry.coordinates?.length ?? 0) >= 2,
        ) ?? []

      const routeLinear = hasLinearPk ? linearData[route.code] || linearData[route.id] : null

      // Segments à tracer : priorité API backend, repli découpe JS locale
      const segmentsToDraw: Array<{ pkDeb: number; pkFin: number; coords: [number, number][] }> = []

      if (apiFeatures.length > 0) {
        apiFeatures.forEach((f) => {
          const pkDeb = Number(f.properties.pk_debut)
          const pkFin = Number(f.properties.pk_fin)
          const coords = f.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          )
          if (!isNaN(pkDeb) && !isNaN(pkFin) && coords.length >= 2) {
            segmentsToDraw.push({ pkDeb, pkFin, coords })
          }
        })
      } else if (routeLinear?.points?.length) {
        const pkRanges: Array<{ pkDeb: number; pkFin: number }> = []
        if (m.segments_pk && m.segments_pk.length > 0) {
          m.segments_pk.forEach((s) => {
            const deb = Number(s.pk_debut)
            const fin = Number(s.pk_fin)
            if (!isNaN(deb) && !isNaN(fin)) pkRanges.push({ pkDeb: deb, pkFin: fin })
          })
        } else if (m.pk_debut != null && m.pk_fin != null) {
          const deb = Number(m.pk_debut)
          const fin = Number(m.pk_fin)
          if (!isNaN(deb) && !isNaN(fin)) pkRanges.push({ pkDeb: deb, pkFin: fin })
        }
        pkRanges.forEach(({ pkDeb, pkFin }) => {
          const coords = getSegmentCoords(routeLinear.points, pkDeb, pkFin)
          if (coords.length >= 2) segmentsToDraw.push({ pkDeb, pkFin, coords })
        })
      }

      if (segmentsToDraw.length === 0) return

      // Détermine le statut et la couleur de ce marché
      const av = m.dernier_avancement
      const phys = Number(av?.avancement_physique || 0)
      const isRetard = av?.est_en_retard
      const isAcheve = av?.situation_w === 'Acheve' || phys >= 100
      const isArrete = av?.situation_w === 'Arrete'
      const marcheStatus: RouteStatusType = isRetard ? 'retard' : isAcheve ? 'acheve' : isArrete ? 'arrete' : 'en_cours'

      // Vérifie si ce marché correspond aux filtres en cours
      const matchesStatus = statusFilter === 'all' || statusFilter === marcheStatus
      const matchesRoute = selectedRoute === 'all' || selectedRoute === route.id
      const isSelectedMarche = selectedMarcheId != null && String(m.id) === String(selectedMarcheId)

      // Si le marché est exclu du filtre statut ou de l'axe sélectionné, on ne l'affiche pas ou on l'estompe
      if (!matchesRoute) return
      if (!matchesStatus && !isSelectedMarche) return

      const statusColor = STATUS_CONFIG[marcheStatus].color

      segmentsToDraw.forEach(({ pkDeb, pkFin, coords }) => {
        // Polyligne spécifique du tronçon
        const segmentPolyline = L.polyline(coords, {
          color: isSelectedMarche ? '#ffffff' : statusColor,
          weight: isSelectedMarche ? 8.5 : 6,
          opacity: isSelectedMarche ? 1.0 : 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        })

        // Infobulle sur le tronçon
        segmentPolyline.bindTooltip(
          `
          <div class="carto-tooltip-wrap">
            <div class="carto-tooltip-header">
              <strong>${route.code} &bull; PK ${pkDeb.toFixed(1)} &rarr; PK ${pkFin.toFixed(1)}</strong>
            </div>
            <div class="carto-tooltip-sub">${m.resume || m.description || 'Chantier'}</div>
            <div class="carto-tooltip-status">
              <span class="carto-dot" style="background: ${statusColor};"></span>
              <span style="font-weight: 700; color: ${statusColor};">${STATUS_CONFIG[marcheStatus].label}</span>
              <span style="color: #94a3b8; font-size: 0.72rem;">(${Math.abs(pkFin - pkDeb).toFixed(1)} km)</span>
            </div>
            <div class="carto-tooltip-progress">
              <span>Avancement :</span>
              <strong>${phys}%</strong> &bull; <span>${m.titulaire || 'Titulaire'}</span>
            </div>
          </div>
          `,
          { sticky: true, opacity: 0.98 },
        )

        segmentPolyline.on('click', () => {
          setSelectedRoute(route.id)
          setActiveDrawerAxe(route)
          setSelectedMarcheId(String(m.id))
        })

        workSegmentsLayerRef.current?.addLayer(segmentPolyline)

        // Ajout de pastilles de début et de fin de PK
        const startPt = coords[0]
        const endPt = coords[coords.length - 1]

        const startPinIcon = L.divIcon({
          className: 'carto-pk-marker-pin',
          html: `<div class="carto-pk-tag start">PK ${Math.round(pkDeb)}</div>`,
          iconSize: [50, 18],
          iconAnchor: [25, 9],
        })

        const endPinIcon = L.divIcon({
          className: 'carto-pk-marker-pin',
          html: `<div class="carto-pk-tag end">PK ${Math.round(pkFin)}</div>`,
          iconSize: [50, 18],
          iconAnchor: [25, 9],
        })

        const startMarker = L.marker(startPt, { icon: startPinIcon, interactive: false })
        const endMarker = L.marker(endPt, { icon: endPinIcon, interactive: false })

        workSegmentsLayerRef.current?.addLayer(startMarker)
        workSegmentsLayerRef.current?.addLayer(endMarker)

        // Si ce marché précis est sélectionné, zoomer dessus
        if (isSelectedMarche && mapRef.current) {
          const segBounds = segmentPolyline.getBounds()
          if (segBounds.isValid()) {
            mapRef.current.fitBounds(segBounds, { padding: [80, 80], maxZoom: 11 })
          }
        }
      })
    })
  }, [
    marches,
    marcheGeoRevision,
    linearRoutesRevision,
    selectedRoute,
    statusFilter,
    colorMode,
    selectedMarcheId,
    routeStatusMap,
    getRouteForMarche,
  ])

  // Marqueurs des bacs fluviaux
  useEffect(() => {
    if (!bacMarkersLayerRef.current) return
    bacMarkersLayerRef.current.clearLayers()

    if (!showBacs) return

    bacs.forEach((bac) => {
      const lat = Number(bac.latitude)
      const lng = Number(bac.longitude)
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return

      const isHorsUsage = bac.etat_bac === 'Hors_usage'

      const customIcon = L.divIcon({
        className: 'carto-bac-marker',
        html: `
          <div class="carto-bac-pin ${isHorsUsage ? 'hors-usage' : 'operationnel'}">
            <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
              <path d="M184,120a8,8,0,0,1-8,8,48.05,48.05,0,0,1-40,47.33V120a8,8,0,0,1,16,0,8,8,0,0,0,16,0,24,24,0,0,0-24-24h-8V80a8,8,0,0,0-16,0v16h-8a24,24,0,0,0-24,24,8,8,0,0,0,16,0,8,8,0,0,1,16,0v55.33A48.05,48.05,0,0,1,80,128a8,8,0,0,1-16,0,64.07,64.07,0,0,0,56,63.49V216H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H136V191.49A64.07,64.07,0,0,0,192,128,8,8,0,0,1,184,120ZM128,40a16,16,0,1,1-16,16A16,16,0,0,1,128,40m0-16a32,32,0,1,0,32,32A32,32,0,0,0,128,24Z"/>
            </svg>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })

      const marker = L.marker([lat, lng], { icon: customIcon })
      marker.bindPopup(`
        <div class="carto-bac-popup">
          <div class="carto-bac-popup-title">
            <span>Bac ${bac.localite || 'Sans nom'}</span>
            <span class="carto-bac-status-badge ${isHorsUsage ? 'badge-danger' : 'badge-success'}">
              ${isHorsUsage ? 'Hors service' : 'Opérationnel'}
            </span>
          </div>
          <div class="carto-bac-popup-body">
            <div><strong>Rivière :</strong> ${bac.riviere || '—'}</div>
            <div><strong>Axe :</strong> ${bac.axe_detail?.designation || bac.axe || '—'}</div>
            ${bac.pk_bac ? `<div><strong>Point kilométrique :</strong> PK ${bac.pk_bac}</div>` : ''}
            ${bac.longueur_travers ? `<div><strong>Traversée :</strong> ${bac.longueur_travers} m</div>` : ''}
          </div>
        </div>
      `)
      bacMarkersLayerRef.current?.addLayer(marker)
    })
  }, [bacs, showBacs])

  // Ajustement de la taille de la carte si le tiroir s'ouvre/ferme
  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize()
    }, 200)
    return () => clearTimeout(timer)
  }, [activeDrawerAxe])

  // Réinitialiser la vue au centre de Madagascar
  const handleResetView = () => {
    if (!mapRef.current) return
    mapRef.current.setView([-18.8792, 47.5079], 6)
    setSelectedRoute('all')
    setStatusFilter('all')
    setSelectedMarcheId(null)
  }

  // Marchés de l'axe sélectionné dans le tiroir
  const activeDrawerMarches = useMemo(() => {
    if (!activeDrawerAxe) return []
    return getMarchesForRoute(activeDrawerAxe)
  }, [activeDrawerAxe, getMarchesForRoute])

  // Plage PK de l'axe actuellement sélectionné dans le tiroir
  const activeDrawerPkRange = useMemo(() => {
    const pksDeb = activeDrawerMarches.map((m) => Number(m.pk_debut)).filter((n) => !isNaN(n) && n != null)
    const pksFin = activeDrawerMarches.map((m) => Number(m.pk_fin)).filter((n) => !isNaN(n) && n != null)
    if (!pksDeb.length && !pksFin.length) return null
    const min = Math.min(...pksDeb, ...pksFin)
    const max = Math.max(...pksDeb, ...pksFin)
    return { min, max }
  }, [activeDrawerMarches])

  // Marchés filtrés par l'onglet du tiroir
  const filteredDrawerMarches = useMemo(() => {
    if (drawerMarcheTab === 'all') return activeDrawerMarches
    if (drawerMarcheTab === 'retard') {
      return activeDrawerMarches.filter((m) => m.dernier_avancement?.est_en_retard)
    }
    if (drawerMarcheTab === 'en_cours') {
      return activeDrawerMarches.filter(
        (m) =>
          !m.dernier_avancement?.est_en_retard &&
          m.dernier_avancement?.situation_w !== 'Acheve' &&
          (m.dernier_avancement?.avancement_physique ?? 0) < 100,
      )
    }
    if (drawerMarcheTab === 'acheve') {
      return activeDrawerMarches.filter(
        (m) =>
          m.dernier_avancement?.situation_w === 'Acheve' ||
          (m.dernier_avancement?.avancement_physique ?? 0) >= 100,
      )
    }
    return activeDrawerMarches
  }, [activeDrawerMarches, drawerMarcheTab])

  // Formatage des montants
  const formatMontant = (val?: number | string | null) => {
    if (!val) return '—'
    const n = Number(val)
    if (isNaN(n)) return String(val)
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} Ar`
  }

  const formatPKText = (pk?: number | string | null) => {
    if (pk == null || pk === '') return '—'
    const n = Number(pk)
    if (isNaN(n)) return String(pk)
    return `PK ${n.toFixed(3)}`
  }

  return (
    <div className="cartographie-page">
      {/* 2. Bandeau de KPIs Synthétiques */}
      <section className="carto-kpis-grid">
        <div className="carto-kpi-card">
          <div className="carto-kpi-icon">
            <RoadHorizon size={20} />
          </div>
          <div className="carto-kpi-content">
            <span className="carto-kpi-label">Axes Cartographiés</span>
            <div className="carto-kpi-number">{ROUTES.length} <span className="carto-kpi-unit">routes</span></div>
            <span className="carto-kpi-sub">RN1, RN2, RN4, RN7, RN43, RN44</span>
          </div>
        </div>

        <div className="carto-kpi-card">
          <div className="carto-kpi-icon">
            <CheckCircle size={20} />
          </div>
          <div className="carto-kpi-content">
            <span className="carto-kpi-label">Avancement Moyen</span>
            <div className="carto-kpi-number">{globalStats.avgPhysique}%</div>
            <div className="carto-kpi-progress">
              <div
                className="carto-kpi-progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, globalStats.avgPhysique))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="carto-kpi-card">
          <div className="carto-kpi-icon">
            <WarningCircle size={20} />
          </div>
          <div className="carto-kpi-content">
            <span className="carto-kpi-label">Chantiers en Retard</span>
            <div className="carto-kpi-number" style={{ color: globalStats.marchesEnRetard > 0 ? '#ef4444' : undefined }}>
              {globalStats.marchesEnRetard}
            </div>
            <span className="carto-kpi-sub">
              {globalStats.marchesEnRetard > 0 ? 'Alerte opérationnelle' : 'Aucun retard critique'}
            </span>
          </div>
        </div>

        <div className="carto-kpi-card">
          <div className="carto-kpi-icon">
            <AnchorSimple size={20} />
          </div>
          <div className="carto-kpi-content">
            <span className="carto-kpi-label">Bacs Fluviaux</span>
            <div className="carto-kpi-number">{globalStats.bacsTotal}</div>
            <span className="carto-kpi-sub">
              {globalStats.bacsGeoloc} géolocalisés &bull; {globalStats.bacsHorsUsage} hors service
            </span>
          </div>
        </div>
      </section>

      {/* 3. Barre de Contrôles & Filtres Dynamiques */}
      <section className="carto-toolbar">
        {/* LIGNE 1 : Filtre d'état des travaux */}
        <div className="carto-filter-status-row">
          <div className="carto-filter-title">
            <Funnel size={14} />
            <span>État des travaux :</span>
          </div>

          <div className="carto-status-pills">
            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>Tous</span>
              <span className="carto-pill-count">{statusCounts.all}</span>
            </button>

            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'en_cours' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'en_cours' ? 'all' : 'en_cours')}
            >
              <span className="carto-dot dot-en-cours" />
              <span>En cours</span>
              <span className="carto-pill-count">{statusCounts.en_cours}</span>
            </button>

            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'retard' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'retard' ? 'all' : 'retard')}
            >
              <span className="carto-dot dot-retard" />
              <span>En retard</span>
              <span className="carto-pill-count">{statusCounts.retard}</span>
            </button>

            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'acheve' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'acheve' ? 'all' : 'acheve')}
            >
              <span className="carto-dot dot-acheve" />
              <span>Achevés</span>
              <span className="carto-pill-count">{statusCounts.acheve}</span>
            </button>

            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'arrete' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'arrete' ? 'all' : 'arrete')}
            >
              <span className="carto-dot dot-arrete" />
              <span>Arrêtés</span>
              <span className="carto-pill-count">{statusCounts.arrete}</span>
            </button>

            <button
              type="button"
              className={`carto-status-pill ${statusFilter === 'aucun' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'aucun' ? 'all' : 'aucun')}
            >
              <span className="carto-dot dot-aucun" />
              <span>Sans marché</span>
              <span className="carto-pill-count">{statusCounts.aucun}</span>
            </button>
          </div>

          <div className="carto-header-actions">
            <button
              type="button"
              className="carto-btn-action"
              onClick={handleResetView}
              title="Recentrer sur tout Madagascar"
            >
              <Compass size={16} />
              <span>Recentrer</span>
            </button>
            <button
              type="button"
              className={`carto-btn-action ${refreshing ? 'loading' : ''}`}
              onClick={handleRefresh}
              title="Rafraîchir les données"
            >
              <ArrowsClockwise size={16} className={refreshing ? 'spin' : ''} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* LIGNE 2 : Outils de sélection, couches et fond de carte */}
        <div className="carto-options-row">
          <div className="carto-options-left">
            <div className="carto-select-wrap">
              <label htmlFor="select-axe">Axe :</label>
              <select
                id="select-axe"
                className="carto-select"
                value={selectedRoute}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedRoute(val)
                  const found = ROUTES.find((r) => r.id === val)
                  if (found) setActiveDrawerAxe(found)
                }}
              >
                <option value="all">Tous les axes ({ROUTES.length})</option>
                {ROUTES.map((route) => {
                  const info = routeStatusMap.get(route.id)
                  return (
                    <option key={route.id} value={route.id}>
                      {route.code} — {route.name} ({info?.marchesCount || 0} marchés)
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="carto-seg-control">
              <span className="carto-seg-label">Couleur :</span>
              <button
                type="button"
                className={`carto-seg-btn ${colorMode === 'status' ? 'active' : ''}`}
                onClick={() => setColorMode('status')}
                title="Colorer selon l'état d'avancement des chantiers"
              >
                <span>État travaux</span>
              </button>
              <button
                type="button"
                className={`carto-seg-btn ${colorMode === 'route' ? 'active' : ''}`}
                onClick={() => setColorMode('route')}
                title="Colorer selon l'axe routier"
              >
                <Stack size={13} />
                <span>Par axe</span>
              </button>
            </div>
          </div>

          <div className="carto-options-right">
            <button
              type="button"
              className={`carto-toggle-btn ${showBacs ? 'active' : ''}`}
              onClick={() => setShowBacs(!showBacs)}
              title="Afficher ou masquer les bacs fluviaux"
            >
              <AnchorSimple size={15} />
              <span>Bacs ({bacs.length})</span>
            </button>

            <div className="carto-basemap-group">
              <button
                type="button"
                className={`carto-basemap-btn ${baseMap === 'satellite' ? 'active' : ''}`}
                onClick={() => setBaseMap('satellite')}
              >
                <Globe size={13} />
                <span>Satellite</span>
              </button>
              <button
                type="button"
                className={`carto-basemap-btn ${baseMap === 'clair' ? 'active' : ''}`}
                onClick={() => setBaseMap('clair')}
              >
                <span>Clair</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Zone Carte & Éléments Flottants */}
      <section className="carto-map-wrapper">
        <div ref={mapContainerRef} className="carto-leaflet-canvas" />

        {/* Bannière de localisation du tronçon PK sélectionné */}
        {selectedMarche && (
          <aside className="carto-pk-active-banner">
            <div className="carto-pk-banner-main">
              <div className="carto-pk-banner-header">
                <span className="carto-pk-banner-tag">
                  <NavigationArrow size={12} weight="bold" />
                  <span>Tronçon PK Sélectionné</span>
                </span>
                <span className="carto-pk-banner-axe">
                  {selectedMarche.axe_detail?.designation || selectedMarche.axe || 'Axe national'}
                </span>
              </div>

              <div className="carto-pk-banner-title">
                {selectedMarche.resume || selectedMarche.description || `Marché #${selectedMarche.id}`}
              </div>

              <div className="carto-pk-banner-metrics">
                <div className="carto-pk-metric">
                  <span className="pk-metric-label">PK Début</span>
                  <span className="pk-metric-val">{formatPKText(selectedMarche.pk_debut)}</span>
                </div>
                <span className="carto-pk-arrow">&rarr;</span>
                <div className="carto-pk-metric">
                  <span className="pk-metric-label">PK Fin</span>
                  <span className="pk-metric-val">{formatPKText(selectedMarche.pk_fin)}</span>
                </div>
                {selectedMarche.longueur_totale ? (
                  <div className="carto-pk-metric">
                    <span className="pk-metric-label">Longueur</span>
                    <span className="pk-metric-val">{Number(selectedMarche.longueur_totale).toFixed(1)} km</span>
                  </div>
                ) : null}
                <div className="carto-pk-metric">
                  <span className="pk-metric-label">Avancement</span>
                  <span className="pk-metric-val">
                    {selectedMarche.dernier_avancement?.avancement_physique ?? 0}%
                  </span>
                </div>
                <div className="carto-pk-metric">
                  <span className="pk-metric-label">Titulaire</span>
                  <span className="pk-metric-val" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedMarche.titulaire || '—'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="carto-pk-banner-close"
              onClick={() => setSelectedMarcheId(null)}
              title="Fermer la vue de ce tronçon"
            >
              <X size={15} />
            </button>
          </aside>
        )}

        {/* Légende interactive flottante */}
        <aside className="carto-floating-legend">
          <div className="carto-legend-title">
            <span>{colorMode === 'status' ? 'Filtrage rapide' : 'Axes routiers'}</span>
          </div>

          {colorMode === 'status' ? (
            <div className="carto-legend-list">
              {(
                [
                  { key: 'en_cours', label: 'En cours', color: STATUS_CONFIG.en_cours.color },
                  { key: 'retard', label: 'En retard', color: STATUS_CONFIG.retard.color },
                  { key: 'acheve', label: 'Achevé', color: STATUS_CONFIG.acheve.color },
                  { key: 'arrete', label: 'Arrêté', color: STATUS_CONFIG.arrete.color },
                  { key: 'aucun', label: 'Sans marché', color: STATUS_CONFIG.aucun.color },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className={`carto-legend-clickable ${statusFilter === item.key ? 'selected' : ''}`}
                  onClick={() => setStatusFilter(statusFilter === item.key ? 'all' : item.key)}
                  title={`Filtrer par : ${item.label}`}
                >
                  <span className="carto-legend-line" style={{ background: item.color }} />
                  <span className="carto-legend-text">{item.label}</span>
                  <span className="carto-legend-badge">{statusCounts[item.key]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="carto-legend-list">
              {ROUTES.map((r) => (
                <div
                  key={r.id}
                  className={`carto-legend-clickable ${selectedRoute === r.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedRoute(r.id)
                    setActiveDrawerAxe(r)
                  }}
                >
                  <span className="carto-legend-line" style={{ background: r.defaultColor }} />
                  <span className="carto-legend-text">{r.code}</span>
                </div>
              ))}
            </div>
          )}

          {showBacs && (
            <div className="carto-legend-bacs-note">
              <span className="carto-dot" style={{ background: '#38bdf8' }} /> <span>Opérationnel</span>
              <span className="carto-dot" style={{ background: '#ef4444', marginLeft: '8px' }} /> <span>Hors service</span>
            </div>
          )}
        </aside>

        {/* Tiroir coulissant d'information de l'axe */}
        {activeDrawerAxe && (
          <aside className="carto-side-drawer">
            <div className="carto-drawer-header">
              <div>
                <div className="carto-drawer-axe-badge">
                  <span
                    className="carto-dot"
                    style={{
                      background:
                        colorMode === 'status'
                          ? routeStatusMap.get(activeDrawerAxe.id)?.color || activeDrawerAxe.defaultColor
                          : activeDrawerAxe.defaultColor,
                    }}
                  />
                  <span>{activeDrawerAxe.code}</span>
                </div>
                <h3 className="carto-drawer-title">{activeDrawerAxe.name}</h3>
                <p className="carto-drawer-desc">{activeDrawerAxe.description}</p>
              </div>

              <button
                type="button"
                className="carto-drawer-close-btn"
                onClick={() => setActiveDrawerAxe(null)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Métriques clés de l'axe */}
            <div className="carto-drawer-kpis">
              <div className="carto-drawer-kpi-item">
                <span className="kpi-small-label">Chantiers</span>
                <span className="kpi-small-val">{activeDrawerMarches.length}</span>
              </div>
              <div className="carto-drawer-kpi-item">
                <span className="kpi-small-label">Avancement</span>
                <span className="kpi-small-val">
                  {routeStatusMap.get(activeDrawerAxe.id)?.avgPhysique ?? 0}%
                </span>
              </div>
              <div className="carto-drawer-kpi-item">
                <span className="kpi-small-label">Plage PK travaux</span>
                <span className="kpi-small-val">
                  {activeDrawerPkRange
                    ? `PK ${activeDrawerPkRange.min.toFixed(0)} &rarr; ${activeDrawerPkRange.max.toFixed(0)}`
                    : 'Axe entier'}
                </span>
              </div>
            </div>

            {/* Onglets rapides dans le tiroir */}
            {activeDrawerMarches.length > 0 && (
              <div className="carto-drawer-tabs">
                <button
                  type="button"
                  className={`carto-drawer-tab ${drawerMarcheTab === 'all' ? 'active' : ''}`}
                  onClick={() => setDrawerMarcheTab('all')}
                >
                  Tous ({activeDrawerMarches.length})
                </button>
                <button
                  type="button"
                  className={`carto-drawer-tab ${drawerMarcheTab === 'en_cours' ? 'active' : ''}`}
                  onClick={() => setDrawerMarcheTab('en_cours')}
                >
                  En cours
                </button>
                <button
                  type="button"
                  className={`carto-drawer-tab ${drawerMarcheTab === 'retard' ? 'active' : ''}`}
                  onClick={() => setDrawerMarcheTab('retard')}
                >
                  En retard ({activeDrawerMarches.filter((m) => m.dernier_avancement?.est_en_retard).length})
                </button>
                <button
                  type="button"
                  className={`carto-drawer-tab ${drawerMarcheTab === 'acheve' ? 'active' : ''}`}
                  onClick={() => setDrawerMarcheTab('acheve')}
                >
                  Achevés
                </button>
              </div>
            )}

            {/* Liste des marchés de l'axe */}
            <div className="carto-drawer-content">
              {filteredDrawerMarches.length === 0 ? (
                <div className="carto-drawer-empty">
                  <RoadHorizon size={32} weight="thin" />
                  <p>Aucun marché de travaux associé à cet axe.</p>
                </div>
              ) : (
                filteredDrawerMarches.map((m) => {
                  const av = m.dernier_avancement
                  const phys = Number(av?.avancement_physique || 0)
                  const isRetard = av?.est_en_retard
                  const isAcheve = av?.situation_w === 'Acheve' || phys >= 100
                  const isSelected = String(m.id) === String(selectedMarcheId)

                  const hasPk = m.pk_debut != null || m.pk_fin != null

                  return (
                    <article
                      key={m.id}
                      className={`carto-marche-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedMarcheId(isSelected ? null : String(m.id))}
                    >
                      <div className="carto-card-header">
                        <h4 className="carto-card-title">{m.resume || m.description || `Marché #${m.id}`}</h4>
                        <span
                          className={`carto-badge-status ${
                            isRetard ? 'badge-retard' : isAcheve ? 'badge-acheve' : 'badge-en-cours'
                          }`}
                        >
                          {isRetard ? 'En retard' : isAcheve ? 'Achevé' : 'En cours'}
                        </span>
                      </div>

                      {/* BLOC TRONÇON PK DÉBUT & FIN */}
                      <div className="carto-pk-section-card">
                        <div className="carto-pk-range-row">
                          <MapPin size={14} className="carto-pk-icon" weight="bold" />
                          <div className="carto-pk-range-content">
                            <span className="carto-pk-label">Tronçon du chantier :</span>
                            <span className="carto-pk-values">
                              {hasPk ? (
                                <>
                                  <strong className="carto-pk-num">
                                    {m.pk_debut != null ? `PK ${Number(m.pk_debut).toFixed(3)}` : 'PK Début non renseigné'}
                                  </strong>
                                  <span className="carto-pk-sep">&rarr;</span>
                                  <strong className="carto-pk-num">
                                    {m.pk_fin != null ? `PK ${Number(m.pk_fin).toFixed(3)}` : 'PK Fin non renseigné'}
                                  </strong>
                                  {m.longueur_totale ? (
                                    <span className="carto-pk-dist">({Number(m.longueur_totale).toFixed(1)} km)</span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="carto-pk-none">Non segmenté (Axe complet)</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Sous-segments éventuels (segments_pk) */}
                        {m.segments_pk && m.segments_pk.length > 1 && (
                          <div className="carto-subsegments-pills">
                            {m.segments_pk.map((s, idx) => (
                              <span key={idx} className="carto-subsegment-pill">
                                S{idx + 1}: PK {s.pk_debut} &rarr; PK {s.pk_fin}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="carto-card-details">
                        <div className="carto-detail-row">
                          <Buildings size={13} />
                          <span>Titulaire : <strong>{m.titulaire || 'Non spécifié'}</strong></span>
                        </div>
                        {m.montant ? (
                          <div className="carto-detail-row">
                            <CurrencyCircleDollar size={13} />
                            <span>Montant : <strong>{formatMontant(m.montant)}</strong></span>
                          </div>
                        ) : null}
                      </div>

                      <div className="carto-card-prog-section">
                        <div className="carto-prog-meta">
                          <span>Avancement</span>
                          <strong>{phys.toFixed(1)}%</strong>
                        </div>
                        <div className="carto-prog-track">
                          <div
                            className={`carto-prog-fill ${
                              isRetard ? 'fill-retard' : isAcheve ? 'fill-acheve' : 'fill-en-cours'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, phys))}%` }}
                          />
                        </div>
                      </div>

                      <div className="carto-card-footer">
                        <span className="carto-card-hint-click">
                          {isSelected ? 'Tronçon ciblé sur la carte' : 'Cliquer pour afficher ce tronçon sur la carte'}
                        </span>
                        <a
                          href={`#/travaux/detail/${m.id}`}
                          className="carto-btn-view-detail"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye size={13} />
                          <span>Consulter la fiche</span>
                        </a>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </aside>
        )}
      </section>
    </div>
  )
}
