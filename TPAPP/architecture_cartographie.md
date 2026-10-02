# 🗺️ Architecture — Cartographie des Marchés (Tracé GeoJSON)

## 1. Analyse de l'existant

### Backend — Comment fonctionne `MarcheViewSet`

Le pattern est classique DRF dans [views.py](file:///home/tsiky/Documents/asa/elalana/TPAPP/apitp/views.py#L405-L462) :

```python
class MarcheViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    
    def get_queryset(self):
        # select_related('axe') + prefetch_related('segments_pk', 'ordres_service', 'avancements__medias')
        # Filtres : q, axe, financement, etape, status_scope
        # Autorisations : superuser/staff = tout, sinon axe__attache_suivi=user
    
    def get_serializer_class(self):
        # list → MarcheListSerializer
        # retrieve → MarcheDetailSerializer (inclut segments_pk, ordres_service, avancements)
        # create/update → MarcheWriteSerializer
```

**Routing** : dans [urls.py](file:///home/tsiky/Documents/asa/elalana/TPAPP/apitp/urls.py) via `router.register('travaux/marches', MarcheViewSet)`, préfixé par `api/` dans [TPAPP/urls.py](file:///home/tsiky/Documents/asa/elalana/TPAPP/TPAPP/urls.py#L46).

→ `GET /api/travaux/marches/` → liste, `GET /api/travaux/marches/<id>/` → détail avec `segments_pk`

### Frontend — Structure des pages travaux

```
frontend/src/pages/
├── cartographie/
│   ├── CartographieView.tsx   ← DÉJÀ EXISTANT (1282 lignes, Leaflet vanilla)
│   └── CartographieView.css
├── travaux/
│   ├── TravauxList.tsx
│   ├── avancement/
│   ├── bac/
│   ├── common/
│   ├── cp/
│   ├── ppm/
│   └── ...
```

> [!IMPORTANT]
> **Il existe déjà une page Cartographie** ([CartographieView.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/pages/cartographie/CartographieView.tsx)) de ~1280 lignes, avec :
> - Leaflet + tuiles multi-fournisseurs (sombre/satellite/clair)
> - Chargement des GeoJSON en front (`/data/routes_osm/RN*.geojson`)
> - Découpe des segments via PK en JS (fonction `getSegmentCoords`)
> - Associations marchés ↔ axes par matching de noms
> - Popups, légende, tiroir latéral, filtres
>
> Elle est déjà **routée** dans [AppRoutes.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/routes/AppRoutes.tsx#L24-L25) et dans le **menu** [Sidebar.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/components/layout/Sidebar.tsx#L11).

### Logique PK dans `build_pk_district.py`

Le script [build_pk_district.py](file:///home/tsiky/Documents/asa/elalana/TPAPP/scripts/build_pk_district.py) implémente :

1. **Chargement GeoJSON** + filtrage par `ref` (ex: `"N 2"` pour RN 2)
2. **Reprojection** en EPSG:29701 (Laborde Madagascar)
3. **linemerge** des segments → chaînage par proximité
4. **Calcul PK** : offset cumulé le long des morceaux chaînés → `point_to_cumulative_m()`
5. **Intersection** avec les districts pour le découpage administratif

### Dépendances

| Élément | État |
|---------|------|
| `leaflet` + `@types/leaflet` dans [package.json](file:///home/tsiky/Documents/asa/elalana/frontend/package.json#L14-L16) | ✅ Déjà installés |
| `react-leaflet` | ❌ **Pas installé** (l'existant utilise Leaflet vanilla via `useRef`) |
| `shapely`, `geopandas`, `pyproj` | ❌ **Pas dans requirements.txt** — nécessaires pour le backend |

### Mapping axe → fichier GeoJSON

Défini dans le script à [L806-L812](file:///home/tsiky/Documents/asa/elalana/TPAPP/scripts/build_pk_district.py#L806-L812) :

| `axe.designation` | Fichier GeoJSON | `ref` OSM |
|---|---|---|
| `RN 1` | `RN1.geojson` | `N 1` |
| `RN 2` | `RN2.geojson` | `N 2` |
| `RN 4` | `RN4.geojson` | `N 4` |
| `RN 7` | `RN7.geojson` | `N 7` |
| `RN 43` | `RN43.geojson` | `N 43` |
| `RN 44` | `RN44.geojson` | `N 44` |

---

## 2. Architecture proposée

### OBJECTIF 1 — Backend : `GET /api/carto/marche/<marche_id>/`

#### Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `TPAPP/apitp/geo_utils.py` | **Nouveau** — Utilitaire d'extraction de tracé |
| `TPAPP/apitp/views.py` | **Modifier** — Ajouter `MarcheCartoView` |
| `TPAPP/apitp/urls.py` | **Modifier** — Ajouter la route |
| `TPAPP/requirements.txt` | **Modifier** — Ajouter `shapely`, `pyproj` (pas besoin de `geopandas` complet) |

#### `geo_utils.py` — Logique métier

```python
# Fonctions principales :

def designation_to_geojson_path(designation: str) -> Path:
    """'RN 2' → data/routes_osm/RN2.geojson"""

def designation_to_ref(designation: str) -> str:
    """'RN 2' → 'N 2'"""

def load_and_chain_route(geojson_path, ref_filter) -> LineString:
    """Charge, filtre par ref, reprojette en 29701, chaîne les morceaux"""
    # Réutilise la logique de build_pk_district.py mais simplifiée
    
def extract_segment_between_pk(chained_line, pk_debut_km, pk_fin_km) -> LineString:
    """Extraie la sous-ligne entre deux PK (en km) le long de la ligne chaînée"""
    # En EPSG:29701, pk_debut_km * 1000 = distance en mètres
    # Utilise shapely substring(line, start_dist, end_dist)
    
def reproject_to_wgs84(geom) -> geometry:
    """EPSG:29701 → EPSG:4326 pour la sortie GeoJSON"""
```

#### `MarcheCartoView` — Vue API

```python
class MarcheCartoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, marche_id):
        marche = get_object_or_404(Marche, pk=marche_id)
        segments_pk = marche.segments_pk.all()
        
        # Charger et chaîner la route
        geojson_path = designation_to_geojson_path(marche.axe.designation)
        ref = designation_to_ref(marche.axe.designation)
        chained = load_and_chain_route(geojson_path, ref)
        
        # Pour chaque PKMarche, extraire le tracé
        features = []
        for seg in segments_pk:
            line = extract_segment_between_pk(chained, seg.pk_debut, seg.pk_fin)
            line_4326 = reproject_to_wgs84(line)
            features.append({
                "type": "Feature",
                "geometry": mapping(line_4326),
                "properties": { ... }
            })
        
        # Couleur basée sur l'étape
        return JsonResponse({"type": "FeatureCollection", "features": features})
```

#### Couleurs

```python
def get_marche_color(marche):
    if marche.etape_actuelle == 'EXE':
        # Vérifier si en retard via dernier avancement
        dernier_av = marche.avancements.first()
        if dernier_av and dernier_av.est_en_retard:
            return '#ef4444'  # Rouge
        return '#10b981'  # Vert
    elif marche.etape_actuelle in ['ATTRIBUE', 'SIGNATURE', 'EVALUATION', 'AO_LANCE']:
        return '#f59e0b'  # Orange (passation)
    else:
        return '#3b82f6'  # Bleu
```

### OBJECTIF 2 — Frontend : Améliorer la page existante

> [!TIP]
> Plutôt que de créer une **nouvelle** page, je propose d'**enrichir** [CartographieView.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/pages/cartographie/CartographieView.tsx) qui fait déjà 95% du travail. La page existante utilise Leaflet vanilla (pas `react-leaflet`) et découpe déjà les segments par PK côté client.

#### Option A — Garder le découpage côté client (actuel)
La page actuelle charge les GeoJSON en front et découpe par PK en JavaScript. C'est **fonctionnel** mais les PK ne correspondent pas exactement au calcul EPSG:29701 du backend.

#### Option B — Appeler l'endpoint backend (recommandé) ✅
Pour chaque marché d'un axe sélectionné, appeler `GET /api/carto/marche/<id>/` et afficher le GeoJSON retourné. **Précision garantie** car le calcul est fait en EPSG:29701 avec shapely côté serveur.

**Changements nécessaires dans CartographieView.tsx :**
1. Ajouter dans [travaux.api.ts](file:///home/tsiky/Documents/asa/elalana/frontend/src/api/travaux.api.ts) : `fetchMarcheGeoJSON(id: string)`
2. Remplacer la logique de découpe JS (`getSegmentCoords`) par les appels API
3. Afficher les GeoJSON retournés comme `L.geoJSON()` layers
4. Les popups, couleurs, légende restent identiques

### OBJECTIF 3 — Menu

✅ **Déjà fait** — La page est déjà dans :
- [hashRoute.ts](file:///home/tsiky/Documents/asa/elalana/frontend/src/routes/hashRoute.ts#L8) : `'cartographie'` dans `APP_PAGES`
- [AppRoutes.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/routes/AppRoutes.tsx#L24-L25) : route `case 'cartographie'`
- [Sidebar.tsx](file:///home/tsiky/Documents/asa/elalana/frontend/src/components/layout/Sidebar.tsx#L11) : entrée menu avec icône `MapTrifold`

---

## 3. Dépendances à installer

### Backend
```bash
# Dans TPAPP/.venv
pip install shapely pyproj
```
Ajouter dans [requirements.txt](file:///home/tsiky/Documents/asa/elalana/TPAPP/requirements.txt) :
```
shapely>=2.0
pyproj>=3.0
```

### Frontend
**Aucune installation nécessaire** — `leaflet` et `@types/leaflet` sont déjà dans `package.json`. L'existant n'utilise pas `react-leaflet` (Leaflet vanilla via `useRef`).

---

## 4. Plan d'exécution

| Étape | Fichier | Description |
|-------|---------|-------------|
| 1 | `apitp/geo_utils.py` | Créer l'utilitaire GeoJSON (chargement, chaînage, extraction PK, reprojection) |
| 2 | `apitp/views.py` | Ajouter `MarcheCartoView` |
| 3 | `apitp/urls.py` | Ajouter `path('carto/marche/<uuid:marche_id>/', MarcheCartoView.as_view())` |
| 4 | `requirements.txt` | Ajouter `shapely`, `pyproj` |
| 5 | `api/travaux.api.ts` | Ajouter `fetchMarcheGeoJSON()` |
| 6 | `CartographieView.tsx` | Remplacer `getSegmentCoords` par l'appel API backend |

> [!NOTE]
> Ce plan **ne modifie aucun modèle** et **ne casse rien** : la nouvelle vue API est additive, et la modification du frontend remplace seulement la logique de découpe des segments.

---

## 5. Questions / Décisions à prendre

1. **Faut-il installer `geopandas` côté backend ?** Le script `build_pk_district.py` l'utilise, mais pour l'endpoint on peut s'en passer avec `shapely` + `pyproj` + `json.load()` directement. Plus léger.

2. **Faut-il un endpoint par axe** (`GET /api/carto/axe/<axe_id>/`) qui retourne TOUS les marchés d'un coup ? Ce serait plus performant (1 appel au lieu de N) et éviterait de recharger/rechaîner le GeoJSON pour chaque marché du même axe.

3. **Garder le mode "découpe JS" en fallback ?** Si l'API backend n'est pas joignable ou si le fichier GeoJSON n'existe pas pour un axe donné.
