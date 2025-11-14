from typing import Optional, List, Dict, Any, Tuple
from math import radians, sin, cos, asin, sqrt
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
import os
import json
from urllib import request as urlrequest
from urllib.parse import urlencode
from urllib.error import URLError


# =========================
# FastAPI app setup
# =========================

app = FastAPI(
    title="Spark Parking Recommender API",
    version="1.0.0",
    description="API for recommending parking spots",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# Helper functions
# =========================

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute distance in km between two lat/lng points."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


def yn_to_int(val: Any) -> int:
    """Convert YES/NO (or similar) to 1/0."""
    if isinstance(val, str):
        s = val.strip().upper()
        if s.startswith("Y"):
            return 1
        if s.startswith("N"):
            return 0
    if isinstance(val, (int, float)):
        return int(bool(val))
    return 0


def discount_to_int(val: Any) -> int:
    """Convert PWD/SC DISCOUNT text to 1/0."""
    if isinstance(val, str):
        s = val.strip().upper()
        if "EXEMPT" in s or "DISCOUNT" in s or "YES" in s:
            return 1
    return 0


def rate_to_float(val: Any) -> float:
    """Extract a numeric INITIAL RATE; return 0.0 if missing."""
    if isinstance(val, (int, float)):
        try:
            if np.isnan(val):  # type: ignore
                return 0.0
        except Exception:
            pass
        return float(val)
    if isinstance(val, str):
        m = re.search(r"(\d+(\.\d+)?)", val.replace(",", ""))
        if m:
            return float(m.group(1))
    return 0.0


def parse_hour_from_str(s: Any) -> Optional[int]:
    """
    Very simple parsing of hour from strings like '6:00 AM', '7:00PM'.
    Returns hour in 0–23, or None if unknown.
    """
    if not isinstance(s, str):
        return None
    s = s.strip()
    if not s or s.upper() == "N/A":
        return None
    if "24/7" in s:
        return 0  # we'll treat 24/7 specially elsewhere

    # use pandas to parse time
    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None
        return int(dt.hour)
    except Exception:
        return None


def compute_open_now(opening: Any, closing: Any, hour: int) -> int:
    """
    Compute open_now (1/0) based on opening/closing strings and current hour.
    '24/7' => always open.
    If parsing fails => assume open (1) so we don't block everything.
    """
    if isinstance(opening, str) and "24/7" in opening.upper():
        return 1
    if isinstance(closing, str) and "24/7" in closing.upper():
        return 1

    open_h = parse_hour_from_str(opening)
    close_h = parse_hour_from_str(closing)

    if open_h is None or close_h is None:
        # can't parse -> assume open
        return 1

    if open_h == close_h:
        # weird schedule -> treat as always open
        return 1

    if open_h < close_h:
        # normal: e.g. 7–22
        return int(open_h <= hour < close_h)
    else:
        # overnight: e.g. 20–4
        return int(hour >= open_h or hour < close_h)


# =========================
# Load Excel metadata
# =========================

def load_parking_excel(path: str = "PARKING.xlsx") -> List[Dict[str, Any]]:
    """
    Load all sheets from PARKING.xlsx and normalize columns
    to a consistent structure.
    """
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        print("❌ Error opening Excel file:", e)
        return []

    all_rows: List[Dict[str, Any]] = []

    for sheet in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=sheet)

            # normalize column names: strip + uppercase
            df.columns = [c.strip().upper() for c in df.columns]

            # mapping from Excel columns -> internal names
            rename_map = {
                "PARKING NAME": "name",
                "DETAILS": "details",
                "ADDRESS": "address",
                "OPENING": "opening",
                "CLOSING": "closing",
                "LINK": "link",
                "LATITUDE": "lat",
                "LONGITUDE": "lng",
                "GUARDS": "guards_raw",
                "CCTVS": "cctvs_raw",
                "INITIAL RATE": "initial_rate_raw",
                "PWD/SC DISCOUNT": "discount_raw",
                "STREET PARKING": "street_raw",
            }

            # only rename columns that exist
            actual_map = {k: v for k, v in rename_map.items() if k in df.columns}
            df = df.rename(columns=actual_map)

            # drop rows without coordinates
            if "lat" not in df.columns or "lng" not in df.columns:
                print(f"⚠ Sheet '{sheet}' has no LATITUDE/LONGITUDE columns, skipping.")
                continue

            df = df.dropna(subset=["lat", "lng"])

            # Add sheet name as city/area
            df["city"] = sheet

            # Convert to list[dict]
            records = df.to_dict(orient="records")
            all_rows.extend(records)

            print(f"📄 Loaded {len(records)} rows from sheet '{sheet}'")

        except Exception as e:
            print(f"⚠ Error reading sheet '{sheet}':", e)

    print(f"✅ Total parking rows loaded from Excel: {len(all_rows)}")
    return all_rows


PARKINGS: List[Dict[str, Any]] = load_parking_excel("PARKING.xlsx")


# =========================
# Load ML model
# =========================

try:
    model = joblib.load("parking_recommender_model_v6.joblib")
    print(f"🤖 Model loaded. n_features_in_ = {getattr(model, 'n_features_in_', 'unknown')}")
except Exception as e:
    print("❌ Error loading model:", e)
    model = None


# =========================
# Request schema
# =========================

class ParkingRequest(BaseModel):
    user_lat: float
    user_lng: float
    time_of_day: int          # 0–23 (use new Date().getHours() in JS)
    day_of_week: Optional[int] = None  # not used yet


# =========================
# Routing models
# =========================

class LatLon(BaseModel):
    lat: float
    lon: float

class EtaRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    mode: str  # 'car' | 'walk' | 'motor' | 'commute'
    departAt: Optional[str] = None

class RouteRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    mode: str
    stops: Optional[List[LatLon]] = None

class OptimizeRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    stops: List[LatLon]
    mode: str


# =========================
# Endpoints
# =========================

@app.get("/")
def home():
    return {"message": "Spark Parking API running!"}


@app.get("/meta-debug")
def meta_debug():
    """Peek at the first few parking records."""
    return {
        "count": len(PARKINGS),
        "sample": PARKINGS[:3],
    }


@app.post("/recommend")
def recommend(req: ParkingRequest, top_k: int = 5):
    """
    Recommend top_k best parkings for the given user location & time.
    Features (in order) match training:

      [distance_km, open_now, cctvs, guards,
       initial_rate, pwd_discount, street_parking]
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded.")
    if not PARKINGS:
        raise HTTPException(status_code=500, detail="No parking data loaded from Excel.")

    feature_rows: List[List[float]] = []
    parking_info: List[Dict[str, Any]] = []

    for idx, p in enumerate(PARKINGS):
        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
        except Exception:
            # skip if we somehow don't have valid coords
            continue

        dist_km = haversine_km(req.user_lat, req.user_lng, lat, lng)
        opening = p.get("opening", None)
        closing = p.get("closing", None)
        open_now = compute_open_now(opening, closing, req.time_of_day)

        cctvs = yn_to_int(p.get("cctvs_raw", p.get("CCTVS", "")))
        guards = yn_to_int(p.get("guards_raw", p.get("GUARDS", "")))
        initial_rate = rate_to_float(p.get("initial_rate_raw", p.get("INITIAL RATE", "")))
        pwd_discount = discount_to_int(p.get("discount_raw", p.get("PWD/SC DISCOUNT", "")))
        street_parking = yn_to_int(p.get("street_raw", p.get("STREET PARKING", "")))

        # Build feature row in EXACT order used in training
        row = [
            dist_km,
            open_now,
            cctvs,
            guards,
            initial_rate,
            pwd_discount,
            street_parking,
        ]

        feature_rows.append(row)

        # store display info for response
        parking_info.append({
            "index": idx,
            "name": p.get("name"),
            "details": p.get("details"),
            "address": p.get("address"),
            "link": p.get("link"),
            "city": p.get("city"),
            "lat": lat,
            "lng": lng,
            "distance_km": dist_km,
            "open_now": bool(open_now),
            "opening": p.get("opening"),
            "closing": p.get("closing"),
            "guards": guards,
            "cctvs": cctvs,
            "initial_rate": initial_rate,
            "pwd_discount": pwd_discount,
            "street_parking": street_parking,
        })

    if not feature_rows:
        raise HTTPException(status_code=500, detail="No valid parking rows to score.")

    X = np.array(feature_rows, dtype=float)

    try:
        scores = model.predict(X)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")

    # Attach scores
    results = []
    for info, score in zip(parking_info, scores):
        info_with_score = dict(info)
        info_with_score["score"] = float(score)
        results.append(info_with_score)

    # Sort by score DESC and take top_k
    results.sort(key=lambda r: r["score"], reverse=True)
    results = results[:top_k]

    return {
        "user_location": {
            "lat": req.user_lat,
            "lng": req.user_lng,
            "time_of_day": req.time_of_day,
        },
        "recommendations": results,
    }


# Email notification endpoint removed per request; keeping API minimal.


# =========================
# Optional ML routing hooks (if present)
# =========================
HAS_ROUTER = False
try:
    # If you have an internal routing module, expose compatible callables here
    # with signatures:
    #   ml_eta(origin: Tuple[float,float], destination: Tuple[float,float], mode: str) -> float
    #   ml_route(origin: Tuple[float,float], destination: Tuple[float,float], mode: str, stops: Optional[List[Tuple[float,float]]]) -> Tuple[List[Tuple[float,float]], Optional[float]]
    #   ml_optimize(origin: Tuple[float,float], stops: List[Tuple[float,float]], destination: Tuple[float,float], mode: str) -> Tuple[List[Tuple[float,float]], Optional[List[Tuple[float,float]]], Optional[float]]
    from router_ml import ml_eta, ml_route, ml_optimize  # type: ignore
    HAS_ROUTER = True
except Exception:
    HAS_ROUTER = False


# =========================
# OSRM helpers (fallback)
# =========================

def _mode_to_osrm(mode: str) -> str:
    m = (mode or '').lower()
    if m == 'walk':
        return 'walking'
    return 'driving'  # 'car' and 'motor' map to driving; 'commute' unsupported

def _http_get_json(url: str, timeout: float = 8.0) -> Dict[str, Any]:
    req = urlrequest.Request(url, headers={"User-Agent": "Spark/1.0"})
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode('utf-8'))

def _osrm_route(profile: str, origin: Tuple[float,float], destination: Tuple[float,float]) -> Tuple[List[List[float]], Optional[float]]:
    # coords are (lat, lon)
    o_lat, o_lon = origin
    d_lat, d_lon = destination
    url = (
        f"https://router.project-osrm.org/route/v1/{profile}/"
        f"{o_lon},{o_lat};{d_lon},{d_lat}?overview=full&geometries=geojson"
    )
    data = _http_get_json(url)
    coords = data.get('routes', [{}])[0].get('geometry', {}).get('coordinates', [])
    duration = data.get('routes', [{}])[0].get('duration')
    return coords, float(duration) if isinstance(duration, (int,float)) else None

def _osrm_trip(profile: str, points: List[Tuple[float,float]]) -> Tuple[List[List[float]], List[Tuple[float,float]], Optional[float]]:
    # OSRM expects lon,lat pairs
    if not points:
        return [], [], None
    coord_str = ';'.join([f"{lon},{lat}" for (lat, lon) in points])
    url = (
        f"https://router.project-osrm.org/trip/v1/{profile}/"
        f"{coord_str}?source=first&destination=last&roundtrip=false&geometries=geojson"
    )
    data = _http_get_json(url)
    trip = (data.get('trips') or [None])[0]
    coords = (trip or {}).get('geometry', {}).get('coordinates', [])
    duration = (trip or {}).get('duration')
    waypoints = data.get('waypoints') or []
    ordered = [(w['location'][1], w['location'][0]) for w in waypoints] if waypoints else points
    return coords, ordered, float(duration) if isinstance(duration, (int,float)) else None


# =========================
# Routing endpoints
# =========================

@app.post('/eta')
def eta(req: EtaRequest):
    origin = (req.origin.lat, req.origin.lon)
    destination = (req.destination.lat, req.destination.lon)
    mode = req.mode
    # Try ML router first, then OSRM
    if HAS_ROUTER:
        try:
            seconds = ml_eta(origin, destination, mode)  # type: ignore
            if isinstance(seconds, (int, float)) and seconds >= 0:
                return {"seconds": float(seconds)}
        except Exception:
            pass
    try:
        profile = _mode_to_osrm(mode)
        _, duration = _osrm_route(profile, origin, destination)
        return {"seconds": float(duration) if duration is not None else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETA failed: {e}")


@app.post('/route')
def route(req: RouteRequest):
    origin = (req.origin.lat, req.origin.lon)
    destination = (req.destination.lat, req.destination.lon)
    stops = [(s.lat, s.lon) for s in (req.stops or [])]
    mode = req.mode
    if HAS_ROUTER:
        try:
            geom, duration = ml_route(origin, destination, mode, stops if stops else None)  # type: ignore
            # Expect geom as list of (lat,lon) or (lon,lat); try to normalize to [lon,lat]
            coords: List[List[float]] = []
            for g in geom or []:
                if isinstance(g, (list, tuple)) and len(g) >= 2:
                    a, b = float(g[0]), float(g[1])
                    # If looks like lat,lon (lat within [-90,90]), convert to lon,lat
                    if -90.0 <= a <= 90.0 and -180.0 <= b <= 180.0:
                        coords.append([b, a])
                    else:
                        coords.append([a, b])
            return {"geometry": coords, "durationSeconds": float(duration) if duration is not None else None}
        except Exception:
            pass
    try:
        profile = _mode_to_osrm(mode)
        if stops:
            pts = [origin] + stops + [destination]
            coords, _, duration = _osrm_trip(profile, pts)
        else:
            coords, duration = _osrm_route(profile, origin, destination)
        return {"geometry": coords, "durationSeconds": float(duration) if duration is not None else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route failed: {e}")


@app.post('/optimize')
def optimize(req: OptimizeRequest):
    origin = (req.origin.lat, req.origin.lon)
    destination = (req.destination.lat, req.destination.lon)
    stops = [(s.lat, s.lon) for s in req.stops]
    mode = req.mode
    if HAS_ROUTER:
        try:
            ordered_pts, geom, duration = ml_optimize(origin, stops, destination, mode)  # type: ignore
            ordered_latlon = [
                {"latitude": float(lat), "longitude": float(lon)} for (lat, lon) in (ordered_pts or [])
            ]
            coords: Optional[List[List[float]]] = None
            if geom is not None:
                coords = []
                for g in geom:
                    if isinstance(g, (list, tuple)) and len(g) >= 2:
                        a, b = float(g[0]), float(g[1])
                        if -90.0 <= a <= 90.0 and -180.0 <= b <= 180.0:
                            coords.append([b, a])
                        else:
                            coords.append([a, b])
            return {
                "ordered": ordered_latlon,
                "geometry": coords or [],
                "durationSeconds": float(duration) if duration is not None else None,
            }
        except Exception:
            pass
    try:
        profile = _mode_to_osrm(mode)
        pts = [origin] + stops + [destination]
        coords, ordered_pts, duration = _osrm_trip(profile, pts)
        ordered_latlon = [
            {"latitude": float(lat), "longitude": float(lon)} for (lat, lon) in ordered_pts
        ]
        return {
            "ordered": ordered_latlon,
            "geometry": coords,
            "durationSeconds": float(duration) if duration is not None else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimize failed: {e}")
