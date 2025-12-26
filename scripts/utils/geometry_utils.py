# scripts/utils/geometry_utils.py

def convert_wkt_to_geojson(wkt_str):
    """Konverter NVDB WKT LINESTRING til GeoJSON LineString"""
    try:
        coords_str = wkt_str.strip().split("(")[1].rstrip(")")
        coords = []
        for pair in coords_str.split(","):
            parts = pair.strip().split()
            if len(parts) >= 2:
                lat = float(parts[0])
                lon = float(parts[1])
                coords.append([lon, lat])  # GeoJSON = [lon, lat]
        return {"type": "LineString", "coordinates": coords}
    except Exception:
        return None
