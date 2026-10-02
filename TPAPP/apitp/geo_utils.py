import json
import math
import os
import re
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import linemerge

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = PROJECT_ROOT / "data" / "routes_osm"


def designation_to_ref(designation: str) -> str:
    """Convertit une désignation de route comme 'RN 2' en la ref OSM 'N 2'."""
    label = (designation or "").strip()
    if not label:
        raise ValueError("La désignation de l'axe est vide.")

    match = re.search(r"RN\s*0*(\d+)", label, flags=re.IGNORECASE)
    if match:
        return f"N {match.group(1)}"

    match = re.search(r"\b(\d+)\b", label)
    if match:
        return f"N {match.group(1)}"

    raise ValueError(f"Désignation de route non supportée : {designation}")


def designation_to_geojson_path(designation: str) -> Path:
    """Retourne le chemin du GeoJSON d'une route nationale à partir de sa désignation."""
    label = (designation or "").strip()
    if not label:
        raise ValueError("La désignation de l'axe est vide.")

    match = re.search(r"RN\s*0*(\d+)", label, flags=re.IGNORECASE)
    if not match:
        raise ValueError(f"Désignation de route non supportée pour la recherche du GeoJSON : {designation}")

    route_code = f"RN{match.group(1)}"
    candidates = [
        ROUTES_DIR / f"{route_code}.geojson",
        PROJECT_ROOT / "TPAPP" / "data" / "routes_osm" / f"{route_code}.geojson",
    ]

    for path in candidates:
        if path.exists():
            return path

    raise FileNotFoundError(f"Aucun GeoJSON trouvé pour {designation} dans {ROUTES_DIR}")


def _ensure_line_collection(geom):
    if geom is None or getattr(geom, "is_empty", False):
        return []

    if geom.geom_type == "LineString":
        return [geom]
    if geom.geom_type == "MultiLineString":
        return list(geom.geoms)
    if geom.geom_type == "GeometryCollection":
        lines = []
        for item in geom.geoms:
            lines.extend(_ensure_line_collection(item))
        return lines
    return []


def _endpoint_points(line: LineString):
    return Point(line.coords[0]), Point(line.coords[-1])


def _chain_line_parts(parts: list[LineString], *, chain_tol_m: float = 5000.0, force_max_m: float = 20000.0) -> list[LineString]:
    """Chaîne les morceaux d'une route (même logique que build_pk_district.py)."""
    if not parts:
        return []

    min_piece_m = 500.0
    filtered = [p for p in parts if p.length >= min_piece_m]
    if not filtered:
        filtered = list(parts)

    remaining = sorted(filtered, key=lambda g: -g.length)
    chained: list[LineString] = [remaining.pop(0)]

    changed = True
    while changed and remaining:
        changed = False
        chain_start, chain_end = _endpoint_points(chained[0])[0], _endpoint_points(chained[-1])[1]
        best_idx = None
        best_dist = None
        best_case = None

        for idx, piece in enumerate(remaining):
            p_start, p_end = _endpoint_points(piece)
            candidates = (
                (chain_start.distance(p_start), "prepend_start"),
                (chain_start.distance(p_end), "prepend_end"),
                (chain_end.distance(p_start), "append_start"),
                (chain_end.distance(p_end), "append_end"),
            )
            for dist, case in candidates:
                if dist <= chain_tol_m and (best_dist is None or dist < best_dist):
                    best_dist = dist
                    best_idx = idx
                    best_case = case

        if best_idx is not None:
            piece = remaining.pop(best_idx)
            if best_case == "prepend_end":
                chained.insert(0, piece)
            elif best_case == "prepend_start":
                chained.insert(0, LineString(list(piece.coords)[::-1]))
            elif best_case == "append_start":
                chained.append(piece)
            else:
                chained.append(LineString(list(piece.coords)[::-1]))
            changed = True

    # Chaînage forcé pour les morceaux orphelins (jusqu'à force_max_m)
    remaining_orphans = remaining
    while remaining_orphans:
        best_idx = None
        best_dist = None
        best_ci = None
        best_attach = None

        for idx, orphan in enumerate(remaining_orphans):
            o_start, o_end = _endpoint_points(orphan)
            for ci, cp in enumerate(chained):
                c_start, c_end = _endpoint_points(cp)
                for dist, attach in (
                    (c_end.distance(o_start), "append_start"),
                    (c_end.distance(o_end), "append_end"),
                    (c_start.distance(o_end), "prepend_end"),
                    (c_start.distance(o_start), "prepend_start"),
                ):
                    if dist <= force_max_m and (best_dist is None or dist < best_dist):
                        best_dist = dist
                        best_idx = idx
                        best_ci = ci
                        best_attach = attach

        if best_idx is None:
            break

        orphan = remaining_orphans.pop(best_idx)
        o_start, o_end = _endpoint_points(orphan)
        cp = chained[best_ci]
        c_start, c_end = _endpoint_points(cp)

        if best_attach == "append_start":
            chained.append(orphan)
        elif best_attach == "append_end":
            chained.append(LineString(list(orphan.coords)[::-1]))
        elif best_attach == "prepend_end":
            chained.insert(0, LineString(list(orphan.coords)[::-1]))
        else:
            chained.insert(0, orphan)

    return chained


def _project_route_parts(parts: list[LineString]) -> list[LineString]:
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:29701", always_xy=True)

    projected = []
    for part in parts:
        projected_coords = [transformer.transform(x, y) for x, y in part.coords]
        if len(projected_coords) >= 2:
            projected.append(LineString(projected_coords))
    return projected


def load_route_pieces(geojson_path, ref_filter: str | None = None) -> list[LineString]:
    """Charge et chaîne tous les morceaux d'une route en EPSG:29701."""
    path = Path(geojson_path)
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    features = payload.get("features", [])
    if ref_filter is not None:
        ref_filter = str(ref_filter).strip()
        features = [
            feat for feat in features
            if str(feat.get("properties", {}).get("ref", "")).strip() == ref_filter
        ]

    if not features:
        raise ValueError(f"Aucun segment de route trouvé pour ref={ref_filter} dans {path}")

    parts = []
    for feature in features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        geom = shape(geometry)
        if geom.is_empty:
            continue
        parts.extend(_ensure_line_collection(geom))

    if not parts:
        raise ValueError(f"Aucune géométrie linéaire valide dans {path}")

    projected = _project_route_parts(parts)
    merged = linemerge(projected)
    if isinstance(merged, MultiLineString):
        raw_parts = list(merged.geoms)
    elif isinstance(merged, LineString):
        raw_parts = [merged]
    else:
        raw_parts = projected

    try:
        chain_tol_m = float(os.environ.get("CHAIN_TOL_M", "5000"))
    except ValueError:
        chain_tol_m = 5000.0
    try:
        force_max_m = float(os.environ.get("FORCE_CHAIN_MAX_M", "20000"))
    except ValueError:
        force_max_m = 20000.0

    return _chain_line_parts(raw_parts, chain_tol_m=chain_tol_m, force_max_m=force_max_m)


def load_and_chain_route(geojson_path, ref_filter: str | None = None):
    """Charge un GeoJSON de route et renvoie une ligne unique chaînée en EPSG:29701."""
    pieces = load_route_pieces(geojson_path, ref_filter)
    return combined_line_from_pieces(pieces)


def combined_line_from_pieces(pieces: list[LineString]) -> LineString:
    """Concatène les morceaux chaînés en une seule LineString (PK cumulés le long des pièces)."""
    combined_coords: list[tuple[float, float]] = []
    for idx, piece in enumerate(pieces):
        coords = list(piece.coords)
        if idx > 0 and combined_coords and combined_coords[-1] == coords[0]:
            combined_coords.extend(coords[1:])
        else:
            combined_coords.extend(coords)
    if len(combined_coords) < 2:
        return LineString()
    return LineString(combined_coords)


def extract_segment_from_pieces(pieces: list[LineString], start_m: float, end_m: float) -> LineString:
    """Extrait un tronçon entre deux distances cumulées (mètres) le long des pièces chaînées."""
    if not pieces:
        return LineString()

    if start_m > end_m:
        start_m, end_m = end_m, start_m

    total_length = sum(p.length for p in pieces)
    start_m = max(0.0, min(start_m, total_length))
    end_m = max(start_m, min(end_m, total_length))
    if end_m <= start_m:
        return LineString()

    result_coords: list[tuple[float, float]] = []
    offset = 0.0
    for piece in pieces:
        piece_end = offset + piece.length
        if piece_end <= start_m:
            offset = piece_end
            continue
        if offset >= end_m:
            break

        local_start = max(0.0, start_m - offset)
        local_end = min(piece.length, end_m - offset)
        sub = _coerce_segment(piece, local_start, local_end)
        if not sub.is_empty:
            coords = list(sub.coords)
            if result_coords and coords[0] == result_coords[-1]:
                result_coords.extend(coords[1:])
            else:
                result_coords.extend(coords)
        offset = piece_end

    if len(result_coords) < 2:
        return LineString()
    return LineString(result_coords)


def _coerce_segment(line: LineString, start_distance: float, end_distance: float):
    if line.is_empty:
        return LineString()

    try:
        from shapely.ops import substring as shapely_substring

        start_distance = max(0.0, min(start_distance, end_distance))
        end_distance = max(start_distance, end_distance)
        if end_distance <= start_distance:
            return LineString()
        return shapely_substring(line, start_distance, end_distance)
    except Exception:
        pass

    coords = list(line.coords)
    if len(coords) < 2:
        return LineString()

    cumulative = [0.0]
    for idx in range(len(coords) - 1):
        x1, y1 = coords[idx]
        x2, y2 = coords[idx + 1]
        cumulative.append(cumulative[-1] + math.hypot(x2 - x1, y2 - y1))

    total_length = cumulative[-1]
    if total_length == 0:
        return LineString()

    start_distance = max(0.0, min(start_distance, end_distance))
    end_distance = min(max(start_distance, end_distance), total_length)
    if end_distance <= start_distance:
        return LineString()

    extracted = []
    for idx in range(len(coords) - 1):
        segment_start = cumulative[idx]
        segment_end = cumulative[idx + 1]
        if segment_end <= start_distance or segment_start >= end_distance:
            continue

        clamped_start = max(start_distance, segment_start)
        clamped_end = min(end_distance, segment_end)
        if clamped_end <= clamped_start:
            continue

        x1, y1 = coords[idx]
        x2, y2 = coords[idx + 1]
        segment_length = segment_end - segment_start
        if segment_length == 0:
            continue

        ratio_start = (clamped_start - segment_start) / segment_length
        ratio_end = (clamped_end - segment_start) / segment_length

        point_start = (
            x1 + (x2 - x1) * ratio_start,
            y1 + (y2 - y1) * ratio_start,
        )
        point_end = (
            x1 + (x2 - x1) * ratio_end,
            y1 + (y2 - y1) * ratio_end,
        )

        if not extracted:
            extracted.append(point_start)
        extracted.append(point_end)

    if not extracted:
        return LineString()
    return LineString(extracted)


def extract_segment_between_pk(chained_line, pk_debut_km, pk_fin_km, *, pieces: list[LineString] | None = None):
    """Extrait le sous-tracé compris entre deux PK (en km) le long d'une ligne chaînée."""
    try:
        start_km = float(pk_debut_km)
        end_km = float(pk_fin_km)
    except (TypeError, ValueError):
        return LineString()

    if math.isnan(start_km) or math.isnan(end_km):
        return LineString()

    start_distance = start_km * 1000.0
    end_distance = end_km * 1000.0

    if pieces:
        return extract_segment_from_pieces(pieces, start_distance, end_distance)

    if chained_line is None or getattr(chained_line, "is_empty", False):
        return LineString()

    if start_km > end_km:
        start_km, end_km = end_km, start_km
        start_distance = start_km * 1000.0
        end_distance = end_km * 1000.0

    segment = _coerce_segment(chained_line, start_distance, end_distance)
    if segment.is_empty:
        return LineString()
    return segment


def reproject_to_wgs84(geom):
    """Reprojette une géométrie EPSG:29701 vers EPSG:4326 pour la sortie GeoJSON."""
    if geom is None or getattr(geom, "is_empty", False):
        return geom

    transformer = Transformer.from_crs("EPSG:29701", "EPSG:4326", always_xy=True)

    def _reproject_coords(coords):
        return [transformer.transform(x, y) for x, y in coords]

    if geom.geom_type == "LineString":
        coords = _reproject_coords(geom.coords)
        if len(coords) < 2:
            return LineString()
        return LineString(coords)
    if geom.geom_type == "MultiLineString":
        return MultiLineString([LineString(_reproject_coords(line.coords)) for line in geom.geoms])
    return LineString(_reproject_coords(geom.coords))
