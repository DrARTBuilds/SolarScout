import * as turf from '@turf/turf';

export interface Panel {
    id: string;
    bounds: Array<{ lat: number; lng: number }>;
}

export function clientGenerateIndividualPanels(
    lat: number,
    lng: number,
    polygonCoords: Array<{ lat: number; lng: number }>,
    maxCount: number,
    orientation: 'portrait' | 'landscape' = 'portrait'
): Panel[] {
    if (!polygonCoords || polygonCoords.length < 3) return [];

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const p of polygonCoords) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
    }

    const PANEL_WIDTH_M = orientation === 'portrait' ? 1.13 : 2.28;
    const PANEL_HEIGHT_M = orientation === 'portrait' ? 2.28 : 1.13;

    const METERS_PER_DEG_LAT = 111320;
    const METERS_PER_DEG_LNG = 111320 * Math.cos(lat * Math.PI / 180);

    const panelWidthDeg = PANEL_WIDTH_M / METERS_PER_DEG_LNG;
    const panelHeightDeg = PANEL_HEIGHT_M / METERS_PER_DEG_LAT;

    const boundsHeight = maxLat - minLat;
    const boundsWidth = maxLng - minLng;

    const SPACING_FACTOR = 1.05;
    const panelsPerRow = Math.floor(boundsWidth / (panelWidthDeg * SPACING_FACTOR));
    const panelsPerCol = Math.floor(boundsHeight / (panelHeightDeg * SPACING_FACTOR));

    // Convert polygonCoords to turf polygon format
    const coordsList = polygonCoords.map(p => [p.lng, p.lat]);
    coordsList.push(coordsList[0]); // Close polygon
    const turfPoly = turf.polygon([coordsList]);

    const panels: Panel[] = [];
    let panelsAdded = 0;

    for (let row = 0; row < panelsPerCol && panelsAdded < maxCount; row++) {
        for (let col = 0; col < panelsPerRow && panelsAdded < maxCount; col++) {
            const panelSouth = minLat + (row * panelHeightDeg * SPACING_FACTOR);
            const panelWest = minLng + (col * panelWidthDeg * SPACING_FACTOR);
            const panelNorth = panelSouth + panelHeightDeg;
            const panelEast = panelWest + panelWidthDeg;

            const panelCenterLat = (panelNorth + panelSouth) / 2;
            const panelCenterLng = (panelEast + panelWest) / 2;

            const point = turf.point([panelCenterLng, panelCenterLat]);
            const inside = turf.booleanPointInPolygon(point, turfPoly);

            if (inside) {
                panels.push({
                    id: `panel-${row}-${col}-${Math.random().toString(36).substring(2, 6)}`,
                    bounds: [
                        { lat: panelSouth, lng: panelWest },
                        { lat: panelNorth, lng: panelWest },
                        { lat: panelNorth, lng: panelEast },
                        { lat: panelSouth, lng: panelEast }
                    ]
                });
                panelsAdded++;
            }
        }
    }
    return panels;
}
