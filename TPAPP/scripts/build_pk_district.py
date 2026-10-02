#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construire le fichier de découpage PK × district pour une route nationale.

Ce script est conçu pour être exécuté en standalone :
    python scripts/build_pk_district.py

Objectif :
- charger le référentiel administratif des districts depuis le shapefile
- charger le tracé de la route depuis un GeoJSON OSM
- reprojeter les données en EPSG:29701
- intersecter route × districts
- calculer les PK cumulés le long du tracé
- exporter un CSV avec les colonnes :
    axe,pk_debut,pk_fin,district,region,deb,fin,section

Important :
- aucun nom de district n'est inventé ; on ne garde que des valeurs
  vérifiées depuis le shapefile et la table de correspondance officielle
  pour les arrondissements d'Antananarivo.
- le script ne modifie ni le modèle Axe, ni le modèle Localisation,
  ni le modèle PKDistrict ; il génère seulement le fichier CSV de données.
"""

from __future__ import annotations

import csv
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge
import os

# Name mapping to match values stored in the Localisation table
REGION_NAME_MAP = {
    "HAUTE_MATSIATRA": "MATSIATRA_AMBONY",
}

DISTRICT_NAME_MAP = {
    "Toliary-I": "Toliara I",
    "Toliary-II": "Toliara II",
    "Ambato Boeni": "Ambato Boeny",
    "Antananarivo Atsimondrano": "Antananarivo-Atsimondrano",
    "Antananarivo Avaradrano": "Antananarivo-Avaradrano",
    "Antananarivo Renivohitra": "Antananarivo-Renivohitra",
}


def normalize_region_name(name: str) -> str:
    """Apply REGION_NAME_MAP; return original if not mapped."""
    if name is None:
        return name
    return REGION_NAME_MAP.get(name, name)


def normalize_district_name(name: str) -> str:
    """Apply DISTRICT_NAME_MAP; return original if not mapped."""
    if name is None:
        return name
    return DISTRICT_NAME_MAP.get(name, name)


def find_project_root() -> Path:
    """Retourne le répertoire racine du projet ELALANA."""
    current = Path(__file__).resolve().parent
    for candidate in [current.parent, current]:
        if (candidate / "manage.py").exists() or (candidate / "TPAPP").exists():
            return candidate
    return current.parent


def find_districts_csv(project_root: Path) -> Path:
    """Cherche le fichier districts.csv dans les emplacements connus."""
    candidates = [
        project_root / "districts.csv",
        project_root / "TPAPP" / "districts.csv",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "districts.csv introuvable. Vérifiez son emplacement dans le projet."
    )


def normalize_region(name: str | None) -> str:
    """Normalise une région en MAJUSCULES + underscores.

    Exemples:
        'Alaotra-Mangoro' -> 'ALAOTRA_MANGORO'
        'Atsimo-Atsinanana' -> 'ATSIMO_ATSINANANA'
        'ANALAMANGA' -> 'ANALAMANGA'
    """
    if name is None:
        return ""

    cleaned = str(name).strip()
    if not cleaned:
        return ""

    cleaned = cleaned.replace("'", "")
    cleaned = cleaned.replace("-", " ")
    cleaned = cleaned.replace("/", " ")
    cleaned = re.sub(r"[^A-Za-z0-9]+", " ", cleaned)
    cleaned = " ".join(cleaned.split())
    cleaned = cleaned.upper()
    return cleaned.replace(" ", "_")


def get_district_name(adm2_name: str | None) -> str:
    """Convertit les noms du shapefile en noms compatibles avec districts.csv.

    Le shapefile contient des arrondissements d'Antananarivo sous la forme
    '2e Arrondissement' alors que districts.csv utilise 'TANA II'.
    """
    if adm2_name is None:
        return ""

    name = str(adm2_name).strip()
    if not name:
        return ""

    mapping = {
        "1er Arrondissement": "TANA I",
        "1e Arrondissement": "TANA I",
        "2e Arrondissement": "TANA II",
        "2eme Arrondissement": "TANA II",
        "3e Arrondissement": "TANA III",
        "3eme Arrondissement": "TANA III",
        "4e Arrondissement": "TANA IV",
        "4eme Arrondissement": "TANA IV",
        "5e Arrondissement": "TANA V",
        "5eme Arrondissement": "TANA V",
        "6e Arrondissement": "TANA VI",
        "6eme Arrondissement": "TANA VI",
        "7e Arrondissement": "TANA VII",
        "7eme Arrondissement": "TANA VII",
    }

    if name in mapping:
        return mapping[name]

    return name


def get_geojson_candidates(project_root: Path) -> list[Path]:
    """Liste les chemins possibles pour le GeoJSON de route."""
    return [
        project_root / "data" / "routes_osm" / "RN44.geojson",
        project_root / "TPAPP" / "data" / "routes_osm" / "RN44.geojson",
    ]


def load_districts(shapefile_path: Path) -> gpd.GeoDataFrame:
    """Charge le shapefile des districts et normalise ses colonnes."""
    if not shapefile_path.exists():
        raise FileNotFoundError(f"Shapefile des districts introuvable : {shapefile_path}")

    gdf = gpd.read_file(shapefile_path, engine="pyogrio")
    required = {"adm2_name", "adm1_name", "geometry"}
    missing = required - set(gdf.columns)
    if missing:
        raise ValueError(
            f"Le shapefile {shapefile_path} manque les colonnes attendues : {sorted(missing)}"
        )

    gdf = gdf[["adm2_name", "adm1_name", "geometry"]].copy()
    gdf = gdf.rename(columns={"adm2_name": "adm2_name_orig", "adm1_name": "adm1_name_orig"})
    gdf["district"] = gdf["adm2_name_orig"].map(get_district_name)
    gdf["region"] = gdf["adm1_name_orig"].map(normalize_region)

    if gdf.crs is None:
        gdf.set_crs(epsg=4326, inplace=True)
    else:
        gdf = gdf.to_crs(epsg=4326)

    gdf = gdf.to_crs(epsg=29701)
    return gdf


def load_route(geojson_path: Path, ref_filter: str | None = None) -> gpd.GeoDataFrame:
    """Charge le tracé d'une route depuis un GeoJSON.

    Si ref_filter est fourni, on garde uniquement les features dont la colonne
    'ref' correspond exactement à cette valeur. Cela permet de charger seulement
    la vraie RN44 et d'ignorer les routes parasites comme RIP 144.T.
    """
    if not geojson_path.exists():
        raise FileNotFoundError(f"GeoJSON de route introuvable : {geojson_path}")

    route = gpd.read_file(geojson_path, engine="pyogrio")
    if route.empty:
        raise ValueError(f"Le fichier route est vide : {geojson_path}")

    if "geometry" not in route.columns:
        raise ValueError(f"Le GeoJSON {geojson_path} ne contient pas de colonne 'geometry'.")

    before_filter = len(route)

    if ref_filter is not None:
        if "ref" not in route.columns:
            raise ValueError(
                f"Le GeoJSON {geojson_path} ne contient pas de colonne 'ref' ; "
                "impossible de filtrer par référence routière."
            )

        normalized_ref = str(ref_filter).strip()
        route = route[route["ref"].astype(str).str.strip().eq(normalized_ref)].copy()

        print(
            f"[INFO] {len(route)} segments chargés pour ref={normalized_ref} "
            f"(avant filtrage : {before_filter})"
        )

        if route.empty:
            raise ValueError(
                f"Aucun segment trouvé pour ref={normalized_ref} dans {geojson_path}. "
                "Vérifiez la valeur de ref ou le fichier GeoJSON."
            )

    route = route[["geometry"]].copy()
    if route.crs is None:
        route.set_crs(epsg=4326, inplace=True)
    else:
        route = route.to_crs(epsg=4326)

    route = route.to_crs(epsg=29701)
    print(f"[INFO] CRS final du tracé : {route.crs}")
    total_km = route.geometry.length.sum() / 1000.0
    print(f"[INFO] Longueur totale du tracé chargé : {total_km:.3f} km")
    return route


def _explode_geometry(geometry):
    """Retourne les sous-parties d'un MultiLineString comme lignes séparées."""
    if geometry is None or geometry.is_empty:
        return []

    if geometry.geom_type == "LineString":
        return [geometry]
    if geometry.geom_type == "MultiLineString":
        return list(geometry.geoms)
    return [geometry]


def build_pk_district(
    route: gpd.GeoDataFrame,
    districts: gpd.GeoDataFrame,
    axe_name: str,
    ref_point_proj: Point | None = None,
) -> list[dict]:
    """Intersecte la route avec les districts et retourne des segments triés par PK.

    - Oriente le tracé pour que PK=0 corresponde au `ref_point_proj` si fourni.
    - Fusionne les micro-segments < 0.5 km en les rattachant au voisin le plus long.
    - Affiche des logs détaillés (longueur OSM, PK générés, couverture).
    """
    if route.empty:
        raise ValueError(f"Aucun tracé routier pour l'axe {axe_name}.")

    # union_all when available, otherwise fallback
    try:
        from shapely.ops import union_all as _union_all  # type: ignore

        route_geom = _union_all(list(route.geometry))
    except Exception:
        route_geom = route.geometry.unary_union

    if route_geom is None or route_geom.is_empty:
        raise ValueError(f"Le tracé de {axe_name} est vide ou invalide.")

    route_geom = linemerge(route_geom)

    # If the merged geometry produces multiple disconnected pieces, we need
    # to chain them (attempt to reconstruct a continuous route) instead of
    # keeping only the longest piece. This preserves coverage across all
    # relevant segments of the route.
    if route_geom.geom_type == "MultiLineString":
        parts = sorted(list(route_geom.geoms), key=lambda g: -g.length)
    else:
        parts = [route_geom]

    # Logging: number of detected pieces and total length
    total_parts = len(parts)
    total_length_m = sum(p.length for p in parts)
    print(f"[INFO] Morceaux détectés : {total_parts} (longueur totale = {total_length_m/1000.0:.3f} km)")

    # Filter tiny pieces considered noise (< 500 m)
    min_piece_m = 500.0
    filtered = [p for p in parts if p.length >= min_piece_m]
    filtered_length_m = sum(p.length for p in filtered)
    print(f"[INFO] Morceaux conservés après filtrage (<{min_piece_m} m supprimés) : {len(filtered)} (longueur = {filtered_length_m/1000.0:.3f} km)")
    # Chain pieces by proximity. Tolerance configurable via env CHAIN_TOL_M (meters).
    # Default to 5000 m (5 km) as requested.
    try:
        tol_m = float(os.environ.get("CHAIN_TOL_M", "5000"))
    except Exception:
        tol_m = 5000.0

    debug_chain = os.environ.get("DEBUG_CHAINAGE", "0") in ("1", "true", "True")

    # maximum distance for forced chaining (env FORCE_CHAIN_MAX_M, default 20000 m)
    try:
        force_max_m = float(os.environ.get("FORCE_CHAIN_MAX_M", "20000"))
    except Exception:
        force_max_m = 20000.0
    remaining = list(filtered)
    chained: list = []
    if remaining:
        # start from the longest piece
        remaining.sort(key=lambda g: -g.length)
        chained.append(remaining.pop(0))

    def endpoint_points(line):
        return Point(line.coords[0]), Point(line.coords[-1])

    chained_count = 0
    changed = True
    while changed and remaining:
        changed = False
        chain_start = Point(chained[0].coords[0])
        chain_end = Point(chained[-1].coords[-1])
        best = None
        best_idx = None
        best_case = None
        for idx, p in enumerate(remaining):
            p_start, p_end = endpoint_points(p)
            ds_s = chain_start.distance(p_start)
            ds_e = chain_start.distance(p_end)
            de_s = chain_end.distance(p_start)
            de_e = chain_end.distance(p_end)
            cand_min = min(ds_s, ds_e, de_s, de_e)
            if cand_min <= tol_m:
                if best is None or cand_min < best:
                    best = float(cand_min)
                    best_idx = idx
                    # record which case
                    if cand_min == ds_s:
                        best_case = "prepend_start"
                    elif cand_min == ds_e:
                        best_case = "prepend_end"
                    elif cand_min == de_s:
                        best_case = "append_start"
                    else:
                        best_case = "append_end"

        if best_idx is not None:
            p = remaining.pop(best_idx)
            if best_case is None:
                best_case = "append_start"
            if best_case == "prepend_end":
                chained.insert(0, p)
                src = "p_end -> chain_start"
            elif best_case == "prepend_start":
                chained.insert(0, LineString(list(p.coords)[::-1]))
                src = "p_start -> chain_start (reversed)"
            elif best_case == "append_start":
                chained.append(p)
                src = "p_start -> chain_end"
            else:  # append_end
                chained.append(LineString(list(p.coords)[::-1]))
                src = "p_end -> chain_end (reversed)"

            # log if chained at a large distance (>1 km)
            if best is not None and best > 1000.0:
                print(f"[INFO] chaînage à distance {best/1000.0:.3f} km entre morceaux ({src})")

            changed = True
            chained_count += 1

    orphan_pieces = remaining
    orphan_count = len(orphan_pieces)
    orphan_length_m = sum(p.length for p in orphan_pieces)

    # compute chained total length (sum of piece lengths)
    chained_length_m = sum(p.length for p in chained)
    print(f"[INFO] Morceaux chaînés : {len(chained)} (longueur = {chained_length_m/1000.0:.3f} km)")
    if orphan_count:
        print(f"[ALERTE] {orphan_count} morceaux non connectés, {orphan_length_m/1000.0:.3f} km perdus")
        # DEBUG info for each orphan if requested
        if debug_chain:
            # precompute districts in projected CRS for nearest lookups
            try:
                districts_proj = districts
            except Exception:
                districts_proj = districts
            print("[DEBUG] Détails des morceaux orphelins :")
            for idx_o, op in enumerate(orphan_pieces, start=1):
                try:
                    o_start, o_end = endpoint_points(op)
                    # compute minimal distance to chained endpoints
                    min_dist = None
                    nearest_chained_idx = None
                    for ci, cp in enumerate(chained):
                        cs, ce = endpoint_points(cp)
                        for ep in (cs, ce):
                            d = ep.distance(o_start)
                            if min_dist is None or d < min_dist:
                                min_dist = d
                                nearest_chained_idx = ci
                            d2 = ep.distance(o_end)
                            if d2 < min_dist:
                                min_dist = d2
                                nearest_chained_idx = ci

                    # coords in WGS84
                    try:
                        gs = gpd.GeoSeries([o_start, o_end], crs=29701)
                        gs4326 = gs.to_crs(epsg=4326)
                        s_lon, s_lat = gs4326.iloc[0].x, gs4326.iloc[0].y
                        e_lon, e_lat = gs4326.iloc[1].x, gs4326.iloc[1].y
                    except Exception:
                        s_lon, s_lat = o_start.x, o_start.y
                        e_lon, e_lat = o_end.x, o_end.y

                    # nearest district names for ends
                    try:
                        # compute nearest district for start
                        dists_start = districts_proj.geometry.distance(o_start)
                        idx_start = int(dists_start.idxmin())
                        nearest_start = districts_proj.iloc[idx_start]["district"]
                        dists_end = districts_proj.geometry.distance(o_end)
                        idx_end = int(dists_end.idxmin())
                        nearest_end = districts_proj.iloc[idx_end]["district"]
                    except Exception:
                        nearest_start = "?"
                        nearest_end = "?"

                    print(f"  - Orphelin {idx_o}: longueur={op.length/1000.0:.3f} km")
                    print(f"    → Début: lat={s_lat:.6f}, lon={s_lon:.6f}")
                    print(f"    → Fin:   lat={e_lat:.6f}, lon={e_lon:.6f}")
                    print(f"    → Dist min aux chaînés: {min_dist/1000.0:.3f} km (proche morceau idx={nearest_chained_idx})")
                    print(f"    → Districts proches: début={nearest_start}, fin={nearest_end}")
                except Exception as e:
                    print(f"    [DEBUG] erreur détail orphelin: {e}")

    # Build offsets moved below so we can attempt forced chaining
    # and then optionally re-orient the whole chained route before
    # computing cumulative offsets.
    piece_offsets: list[tuple[LineString, float]] = []  # will be filled later (piece, offset_m)

    # If there are orphan pieces, attempt forced chaining up to force_max_m
    if orphan_count and force_max_m > 0:
        if debug_chain:
            print(f"[DEBUG] Tentative de chaînage forcé (max {force_max_m/1000.0:.1f} km)")
        forced = True
        while orphan_pieces and forced:
            forced = False
            # find orphan with minimal distance to chained set
            best_o = None
            best_o_idx = None
            best_o_dist = None
            best_o_case = None
            for idx_o, op in enumerate(orphan_pieces):
                o_s, o_e = endpoint_points(op)
                # compute minimal distance to any chained endpoint
                for ci, cp in enumerate(chained):
                    cs, ce = endpoint_points(cp)
                    for ep_label, ep in (("cs", cs), ("ce", ce)):
                        for op_end_label, op_end in (("os", o_s), ("oe", o_e)):
                            d = ep.distance(op_end)
                            if best_o_dist is None or d < best_o_dist:
                                best_o_dist = float(d)
                                best_o = op
                                best_o_idx = idx_o
                                best_o_case = (ci, ep_label, op_end_label)

            if best_o is not None and best_o_dist <= force_max_m:
                # attach best_o to chained according to nearest ends
                ci, ep_label, op_end_label = best_o_case
                cp = chained[ci]
                cp_s, cp_e = endpoint_points(cp)
                o_s, o_e = endpoint_points(best_o)
                # decide how to attach
                if op_end_label == "os" and ep_label == "ce":
                    chained.append(best_o)
                    attach_desc = "os -> chain_end"
                elif op_end_label == "oe" and ep_label == "ce":
                    chained.append(LineString(list(best_o.coords)[::-1]))
                    attach_desc = "oe -> chain_end (reversed)"
                elif op_end_label == "os" and ep_label == "cs":
                    chained.insert(0, LineString(list(best_o.coords)[::-1]))
                    attach_desc = "os -> chain_start (reversed)"
                else:
                    chained.insert(0, best_o)
                    attach_desc = "oe -> chain_start"

                if debug_chain:
                    print(f"[FORCE] Chaînage forcé : orphelin idx={best_o_idx} dist={best_o_dist/1000.0:.3f} km -> {attach_desc}")

                # remove from orphan list and rebuild offsets
                orphan_pieces.pop(best_o_idx)
                # rebuild offsets
                piece_offsets = []
                offset = 0.0
                for p in chained:
                    piece_offsets.append((p, offset))
                    offset += p.length

                # recompute orphan_count
                orphan_count = len(orphan_pieces)
                forced = True

        if orphan_count:
            print(f"[ALERTE] Après chaînage forcé : {orphan_count} morceaux non connectés, {sum(p.length for p in orphan_pieces)/1000.0:.3f} km perdus")

    # At this point chained (and orphan_pieces) reflect final assembly.
    # RÉORIENTATION : si un point de référence projeté est fourni et se
    # trouve plus proche de la FIN que du DÉBUT, inverser l'ordre des
    # morceaux et leurs coordonnées afin que PK 0 corresponde au point
    # de référence.
    try:
        if ref_point_proj is not None and chained:
            # build a concatenated LineString from chained pieces
            tmp_coords = []
            for idx_p, p in enumerate(chained):
                coords = list(p.coords)
                if idx_p > 0 and tmp_coords and tmp_coords[-1] == coords[0]:
                    tmp_coords.extend(coords[1:])
                else:
                    tmp_coords.extend(coords)

            if tmp_coords:
                tmp_line = LineString(tmp_coords)
                start_pt_proj = Point(tmp_line.coords[0])
                end_pt_proj = Point(tmp_line.coords[-1])
                d_start = ref_point_proj.distance(start_pt_proj)
                d_end = ref_point_proj.distance(end_pt_proj)
                dist_start_km = float(d_start) / 1000.0
                dist_end_km = float(d_end) / 1000.0

                # Si la fin est plus proche du point de référence, inverser
                if d_end < d_start:
                    # reverse order of pieces and invert each piece coords
                    chained = [LineString(list(p.coords)[::-1]) for p in reversed(chained)]
                    if debug_chain:
                        print(f"[INFO] {axe_name} : tracé inversé (PK 0 = point de référence à {dist_end_km:.1f} km)")
                    else:
                        print(f"[INFO] {axe_name} : tracé inversé (PK 0 = point de référence à {dist_end_km:.1f} km)")
                else:
                    print(f"[INFO] {axe_name} : tracé conservé (PK 0 = point de référence à {dist_start_km:.1f} km)")
    except Exception as e:
        print(f"[AVERTISSEMENT] Impossible de réorienter {axe_name}: {e}")

    # Now compute the piece offsets for cumulative PK calculation
    offset = 0.0
    piece_offsets = []
    for p in chained:
        piece_offsets.append((p, offset))
        offset += p.length

    total_route_km = sum(p.length for p in parts) / 1000.0

    # helper: compute PK (meters) along chained pieces for a given point
    def point_to_cumulative_m(pt: Point) -> float:
        # find the nearest piece (by distance)
        best_dist = None
        best_piece = None
        best_offset = 0.0
        for p, off in piece_offsets:
            d = p.distance(pt)
            if best_dist is None or d < best_dist:
                best_dist = d
                best_piece = p
                best_offset = off
        if best_piece is None:
            raise ValueError("Aucun morceau ne correspond au point pour le calcul du PK")
        # project onto the chosen piece
        proj = best_piece.project(pt, normalized=False)
        return best_offset + proj

    # Build a combined LineString for simple start/end display (concatenate coords)
    combined_coords = []
    for idx, p in enumerate(chained):
        coords = list(p.coords)
        if idx > 0:
            # avoid duplicating the connecting coordinate
            if combined_coords and combined_coords[-1] == coords[0]:
                combined_coords.extend(coords[1:])
            else:
                combined_coords.extend(coords)
        else:
            combined_coords.extend(coords)
    if combined_coords:
        display_route = LineString(combined_coords)
    else:
        display_route = chained[0] if chained else route_geom

    # intersections will be computed per-piece using the chained pieces
    rows = []
    omitted_length_m = 0.0

    if not piece_offsets:
        raise ValueError(f"Le tracé de {axe_name} est vide après traitement des morceaux.")

    piece_count = len(piece_offsets)
    print(f"[INFO] Intersection par morceau : {piece_count} morceaux à traiter")

    for p_idx, (piece, offset_m) in enumerate(piece_offsets, start=1):
        try:
            piece_gdf = gpd.GeoDataFrame({"geometry": [piece]}, crs=29701)
            inter = gpd.overlay(piece_gdf, districts, how="intersection")
        except Exception as e:
            print(f"[AVERTISSEMENT] Erreur intersection morceau {p_idx} : {e}")
            continue

        if inter.empty:
            continue

        for _, row in inter.iterrows():
            geom = row["geometry"]
            for part in _explode_geometry(geom):
                if part.is_empty or part.length <= 0:
                    continue

                coords = list(part.coords)
                if len(coords) < 2:
                    continue

                start_point = Point(coords[0])
                end_point = Point(coords[-1])

                # compute cumulative distances (meters) using piece offsets
                try:
                    start_dist_m = point_to_cumulative_m(start_point)
                    end_dist_m = point_to_cumulative_m(end_point)
                except Exception:
                    # fallback: project on concatenated display route
                    start_dist_m = display_route.project(start_point, normalized=False)
                    end_dist_m = display_route.project(end_point, normalized=False)

                if start_dist_m > end_dist_m:
                    start_dist_m, end_dist_m = end_dist_m, start_dist_m

                district_name = get_district_name(row.get("adm2_name_orig"))
                region_name = normalize_region(row.get("adm1_name_orig"))

                # Apply mapping to match Localisation table values
                mapped_district = normalize_district_name(district_name)
                mapped_region = normalize_region_name(region_name)
                if debug_chain:
                    if mapped_district != district_name:
                        print(f"[MAP] district '{district_name}' → '{mapped_district}'")
                    if mapped_region != region_name:
                        print(f"[MAP] region '{region_name}' → '{mapped_region}'")

                district_name = mapped_district
                region_name = mapped_region

                if not district_name:
                    omitted_length_m += (end_dist_m - start_dist_m)
                    continue

                rows.append(
                    {
                        "pk_debut_m": Decimal(str(start_dist_m / 1000.0)),
                        "pk_fin_m": Decimal(str(end_dist_m / 1000.0)),
                        "district": district_name,
                        "region": region_name,
                        "deb": district_name,
                        "fin": district_name,
                        "section": f"{axe_name} - {district_name}",
                    }
                )

    if not rows:
        raise ValueError(f"Aucune géométrie exploitable pour {axe_name} après intersection.")

    # Trier et fusionner les intervalles contigus du même district
    rows = sorted(rows, key=lambda x: (x["pk_debut_m"], x["pk_fin_m"]))

    merged = []
    tol = Decimal("0.000001")
    for row in rows:
        if not merged:
            merged.append(row)
            continue

        previous = merged[-1]
        if previous["district"] == row["district"] and previous["region"] == row["region"]:
            # fusionner si chevauchement ou contiguïté (tolérance minime pour flotants)
            if row["pk_debut_m"] <= previous["pk_fin_m"] + tol:
                previous["pk_fin_m"] = max(previous["pk_fin_m"], row["pk_fin_m"])
                continue

        merged.append(row)

    # Fusion des micro-segments inférieurs au seuil (0.5 km)
    threshold = Decimal("0.5")
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(merged):
            seg_len = merged[i]["pk_fin_m"] - merged[i]["pk_debut_m"]
            if seg_len < threshold:
                if i == 0 and len(merged) > 1:
                    merged[1]["pk_debut_m"] = merged[i]["pk_debut_m"]
                    del merged[i]
                    changed = True
                    continue
                elif i == len(merged) - 1 and len(merged) > 1:
                    merged[i - 1]["pk_fin_m"] = merged[i]["pk_fin_m"]
                    del merged[i]
                    changed = True
                    i -= 1
                else:
                    prev_len = merged[i - 1]["pk_fin_m"] - merged[i - 1]["pk_debut_m"]
                    next_len = merged[i + 1]["pk_fin_m"] - merged[i + 1]["pk_debut_m"]
                    if prev_len >= next_len:
                        merged[i - 1]["pk_fin_m"] = merged[i]["pk_fin_m"]
                        del merged[i]
                        changed = True
                        i -= 1
                    else:
                        merged[i + 1]["pk_debut_m"] = merged[i]["pk_debut_m"]
                        del merged[i]
                        changed = True
                        continue
            i += 1

    final_rows = []
    for idx, row in enumerate(merged, start=1):
        pk_debut = Decimal(str(row["pk_debut_m"]))
        pk_fin = Decimal(str(row["pk_fin_m"]))
        if pk_fin <= pk_debut:
            continue

        final_rows.append(
            {
                "axe": axe_name,
                "pk_debut": float(pk_debut.quantize(Decimal("0.001"))),
                "pk_fin": float(pk_fin.quantize(Decimal("0.001"))),
                "district": row["district"],
                "region": row["region"],
                "deb": row["deb"],
                "fin": row["fin"],
                "section": row["section"],
            }
        )

    generated_km = sum(float(r["pk_fin"]) - float(r["pk_debut"]) for r in final_rows)
    coverage_pct = (generated_km / float(total_route_km)) * 100.0 if total_route_km > 0 else 0.0
    print(f"[DETAIL] {axe_name} : tracé OSM = {total_route_km:.3f} km, PK générés = {generated_km:.3f} km ({coverage_pct:.1f}%)")
    if coverage_pct < 90.0:
        print(f"[ALERTE] Couverture PK pour {axe_name} faible : {coverage_pct:.1f}%")

    if omitted_length_m > 0:
        omitted_km = omitted_length_m / 1000.0
        print(f"[AVERTISSEMENT] {axe_name} : {omitted_km:.3f} km omis car district introuvable dans le shapefile.")

    return final_rows


def write_csv(output_path: Path, rows: Iterable[dict]) -> None:
    """Écrit le CSV final dans le dossier data/."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["axe", "pk_debut", "pk_fin", "district", "region", "deb", "fin", "section"]

    with output_path.open("w", encoding="utf-8", newline="") as file_handle:
        writer = csv.DictWriter(file_handle, fieldnames=fieldnames, delimiter=",")
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "axe": row["axe"],
                "pk_debut": f"{Decimal(str(row['pk_debut'])).quantize(Decimal('0.001'))}",
                "pk_fin": f"{Decimal(str(row['pk_fin'])).quantize(Decimal('0.001'))}",
                "district": row["district"],
                "region": row["region"],
                "deb": row["deb"],
                "fin": row["fin"],
                "section": row["section"],
            })


def main() -> int:
    """Orchestre le chargement du shapefile, du tracé et l'export CSV."""
    project_root = find_project_root()
    data_dir = project_root / "data"
    output_path = data_dir / "PK_DISTRICT_DATA.csv"

    # fichier du référentiel administratif
    districts_csv = find_districts_csv(project_root)
    districts_path = Path("/home/tsiky/Documents/asa/elalana/mdg_admin_boundaries.shp/mdg_admin2.shp")

    if not districts_path.exists():
        raise FileNotFoundError(
            "Le shapefile mdg_admin2.shp est introuvable. Vérifiez le chemin : "
            f"{districts_path}"
        )

    print(f"[INFO] Projet racine : {project_root}")
    print(f"[INFO] Districts.csv : {districts_csv}")
    print(f"[INFO] Shapefile districts : {districts_path}")

    districts = load_districts(districts_path)

    # Batch processing configuration: list of (geojson_filename, axe_designation, ref_osm)
    # axes with their reference PK0 coordinates (lat, lon)
    axes = [
        ("RN1.geojson", "RN 1", "N 1", (-18.91, 47.52)),
        ("RN2.geojson", "RN 2", "N 2", (-18.91, 47.52)),
        ("RN4.geojson", "RN 4", "N 4", (-18.91, 47.52)),
        ("RN7.geojson", "RN 7", "N 7", (-18.91, 47.52)),
        ("RN43.geojson", "RN 43", "N 43", (-18.98, 46.73)),
        ("RN44.geojson", "RN 44", "N 44", (-18.95, 48.23)),
    ]

    all_rows: list[dict] = []
    per_axe_summary = {}

    def process_axe(geojson_path: Path, axe_designation: str, ref_osm: str, districts_gdf: gpd.GeoDataFrame, ref_point_proj: Point | None = None) -> list[dict]:
        """Charge un GeoJSON, filtre sur ref_osm, calcule les intersections et renvoie les lignes CSV.

        En cas d'erreur le message est affiché et une liste vide est retournée.
        """
        try:
            if not geojson_path.exists():
                self_msg = f"[AVERTISSEMENT] Fichier manquant pour {axe_designation} : {geojson_path}"
                print(self_msg)
                return []

            route_gdf = load_route(geojson_path, ref_filter=ref_osm)
            rows = build_pk_district(route_gdf, districts_gdf, axe_designation, ref_point_proj=ref_point_proj)
            return rows
        except FileNotFoundError as e:
            print(f"[AVERTISSEMENT] {e}")
            return []
        except ValueError as e:
            print(f"[AVERTISSEMENT] {axe_designation} : {e}")
            return []
        except Exception as e:
            print(f"[ERREUR] {axe_designation} : erreur inattendue : {e}")
            return []

    for filename, designation, ref, ref_coord in axes:
        geojson_path = project_root / "data" / "routes_osm" / filename
        print(f"\n[INFO] Traitement de {designation} depuis {geojson_path} (ref={ref})")
        # project reference point to EPSG:29701
        try:
            ref_point_proj = None
            if ref_coord:
                ref_gs = gpd.GeoSeries([Point(ref_coord[1], ref_coord[0])], crs=4326)
                ref_gs = ref_gs.to_crs(epsg=29701)
                ref_point_proj = ref_gs.iloc[0]
        except Exception as e:
            print(f"[AVERTISSEMENT] Impossible de projeter le point de référence pour {designation}: {e}")
            ref_point_proj = None

        rows = process_axe(geojson_path, designation, ref, districts, ref_point_proj)
        per_axe_summary[designation] = len(rows)
        if not rows:
            print(f"[AVERTISSEMENT] Aucun segment généré pour {designation}.")
            continue

        # Ensure the 'axe' column uses the designation with a space (already provided)
        all_rows.extend(rows)
        unique_districts = sorted({r["district"] for r in rows})
        total_km = sum(float(r["pk_fin"]) - float(r["pk_debut"]) for r in rows)
        print(f"[RÉSULTAT] {designation} : {len(rows)} segments, {', '.join(unique_districts)} ; total {total_km:.3f} km")

    if not all_rows:
        print("[ERREUR] Aucun segment généré pour aucune des routes. CSV non généré.")
        return 1

    # Écrire un seul CSV cumulé
    write_csv(output_path, all_rows)

    # Résumé global
    unique_districts_all = sorted({row["district"] for row in all_rows})
    total_km_all = sum(float(row["pk_fin"]) - float(row["pk_debut"]) for row in all_rows)

    print("\n=== RÉSUMÉ GLOBAL ===")
    for designation in per_axe_summary:
        print(f"  {designation} : {per_axe_summary[designation]} segments")
    print(f"Total segments : {len(all_rows)}")
    print(f"Districts traversés : {', '.join(unique_districts_all)}")
    print(f"PK total cumulé : {total_km_all:.3f} km")
    print(f"CSV exporté : {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - garder un message lisible en CLI
        print(f"[ERREUR] {exc}", file=sys.stderr)
        raise SystemExit(1)
