import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Ray Casting Point-in-Polygon Check (Zero external dependencies)
function isPointInPolygon(point: { lat: number, lng: number }, vs: Array<{ lat: number, lng: number }>) {
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].lng, yi = vs[i].lat;
        const xj = vs[j].lng, yj = vs[j].lat;
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Helper to generate individual solar panels aligned within coordinates
function generateIndividualPanels(
    lat: number,
    lng: number,
    polygonCoords: Array<{ lat: number, lng: number }>,
    maxCount: number,
    orientation: 'portrait' | 'landscape' = 'portrait'
) {
    if (polygonCoords.length < 3) return [];

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

    const panels: Array<{ id: string, bounds: Array<{ lat: number, lng: number }> }> = [];
    let panelsAdded = 0;

    for (let row = 0; row < panelsPerCol && panelsAdded < maxCount; row++) {
        for (let col = 0; col < panelsPerRow && panelsAdded < maxCount; col++) {
            const panelSouth = minLat + (row * panelHeightDeg * SPACING_FACTOR);
            const panelWest = minLng + (col * panelWidthDeg * SPACING_FACTOR);
            const panelNorth = panelSouth + panelHeightDeg;
            const panelEast = panelWest + panelWidthDeg;

            const panelCenterLat = (panelNorth + panelSouth) / 2;
            const panelCenterLng = (panelEast + panelWest) / 2;

            if (isPointInPolygon({ lat: panelCenterLat, lng: panelCenterLng }, polygonCoords)) {
                panels.push({
                    id: `panel-${row}-${col}-${Math.random().toString(36).substr(2, 4)}`,
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

// AI Panel Detection Endpoint
router.post('/detect-panels', async (req, res) => {
    try {
        const { lat, lng, polygon, orientation = 'portrait' } = req.body;

        // Try calling the FastAPI Python Visual Detection service
        try {
            console.log(`[EXPRESS GATEWAY] Forwarding panel detection to FastAPI CV Service...`);
            const response = await fetch('http://localhost:8000/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lat,
                    lng,
                    polygon,
                    orientation
                })
            });

            if (response.ok) {
                const data: any = await response.json();
                console.log(`[EXPRESS GATEWAY] FastAPI response success! Detected: ${data.detected}, Count: ${data.panelCount}`);
                return res.json({
                    success: data.success,
                    detected: data.detected,
                    confidence: data.confidence,
                    polygons: [polygon],
                    detectedPanels: data.detectedPanels,
                    panelCount: data.panelCount,
                    capacityKW: data.capacityKW,
                    message: data.message
                });
            } else {
                console.warn(`[EXPRESS GATEWAY] FastAPI service returned status ${response.status}. Falling back to local geometric layout...`);
            }
        } catch (fastApiErr) {
            console.warn(`[EXPRESS GATEWAY] Could not connect to FastAPI service. Using Node.js geometric layout fallback.`);
        }

        // Fallback: local geometric packing layout (ensuring 100% uptime!)
        if (polygon && Array.isArray(polygon) && polygon.length >= 3) {
            // Geodesic Shoelace formula for highly precise polygon area calculation on the sphere
            const R = 6371000;
            let areaSum = 0;
            for (let i = 0; i < polygon.length; i++) {
                const j = (i + 1) % polygon.length;
                const lat1 = polygon[i].lat * Math.PI / 180;
                const lat2 = polygon[j].lat * Math.PI / 180;
                const lng1 = polygon[i].lng * Math.PI / 180;
                const lng2 = polygon[j].lng * Math.PI / 180;
                areaSum += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
            }
            const approximateAreaSqM = Math.abs(areaSum * R * R / 2);

            const PANEL_AREA_SQM = 2.58;
            const USABLE_ROOF_PERCENTAGE = 0.75;
            const usableArea = approximateAreaSqM * USABLE_ROOF_PERCENTAGE;
            const panelCount = Math.max(1, Math.floor(usableArea / PANEL_AREA_SQM));

            const detectedPanels = generateIndividualPanels(lat, lng, polygon, panelCount, orientation);

            return res.json({
                success: true,
                detected: false,
                confidence: 0.75,
                polygons: [polygon],
                detectedPanels,
                panelCount: detectedPanels.length,
                capacityKW: Math.round(((detectedPanels.length * 550) / 1000) * 100) / 100,
                message: "Rooftop geometry mapped (Local Geometric Packer fallback)"
            });
        }

        // Fallback for auto-detect without drawing (mocking a default realistic 24-panel array)
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // Generate a mock polygon around the center point (Approx 9m x 10m roof = ~90m²)
        const offsetLat = 0.00004; 
        const offsetLng = 0.000045; 
        const mockPolygon = [
            { lat: lat + offsetLat, lng: lng - offsetLng },
            { lat: lat + offsetLat, lng: lng + offsetLng },
            { lat: lat - offsetLat, lng: lng + offsetLng },
            { lat: lat - offsetLat, lng: lng - offsetLng }
        ];

        const detectedPanels = generateIndividualPanels(lat, lng, mockPolygon, 24, orientation);

        res.json({
            success: true,
            detected: false,
            confidence: 0.70,
            polygons: [mockPolygon],
            detectedPanels,
            panelCount: detectedPanels.length,
            capacityKW: Math.round(((detectedPanels.length * 550) / 1000) * 100) / 100,
            message: "Rooftop geometry mapped (Local Mock Geometric Packer fallback)"
        });

    } catch (error) {
        console.error('Detection error:', error);
        res.status(500).json({ error: 'Failed to process detection' });
    }
});

// HITL Feedback Learning Loop Endpoint
router.post('/detect-feedback', async (req, res) => {
    try {
        const { lat, lng, polygon, aiDetectedCount, userCorrectedCount, missedCount } = req.body;

        const feedbackEntry = {
            timestamp: new Date().toISOString(),
            location: { lat, lng },
            polygon,
            aiDetectedCount,
            userCorrectedCount,
            missedCount,
            deltaPercentage: aiDetectedCount > 0 ? Math.round((missedCount / aiDetectedCount) * 100) : 0
        };

        const dataDir = path.join(__dirname, '..', 'data');
        const filePath = path.join(dataDir, 'feedback_learning_loop.json');

        // Create data directory if it doesn't exist
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (e) {}

        let existingFeedback = [];
        try {
            const fileData = await fs.readFile(filePath, 'utf-8');
            existingFeedback = JSON.parse(fileData);
        } catch (e) {
            // File doesn't exist or is empty
        }

        existingFeedback.push(feedbackEntry);
        await fs.writeFile(filePath, JSON.stringify(existingFeedback, null, 4), 'utf-8');

        console.log(`[LEARNING LOOP] Feedback logged! AI: ${aiDetectedCount}, Corrected: ${userCorrectedCount}, Missed: ${missedCount}`);

        res.json({
            success: true,
            message: "Active learning feedback successfully recorded in training queue.",
            feedbackSaved: feedbackEntry
        });
    } catch (error) {
        console.error('Feedback capture error:', error);
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});

export default router;
