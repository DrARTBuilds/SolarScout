interface SolarData {
    avgGTI: number;
    dailyInsolation: number;
}

export const fetchSolarData = async (lat: number, lng: number): Promise<SolarData> => {
    const tilt = Math.round(Math.abs(lat));
    const azimuth = lat >= 0 ? 180 : 0; // facing South in NH, North in SH
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=global_tilted_irradiance&tilt=${tilt}&azimuth=${azimuth}&timezone=auto`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Open-Meteo API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const gti = data.hourly.global_tilted_irradiance as number[];

        // 24-hour average (W/m²)
        const avgGTI = gti.slice(0, 24).reduce((a, b) => a + b, 0) / 24;

        // Daily Insolation (kWh/m²/day)
        const dailyInsolation = gti.slice(0, 24).reduce((a, b) => a + b, 0) / 1000;

        return { avgGTI, dailyInsolation };
    } catch (error) {
        console.error('Error fetching solar data:', error);
        throw new Error('Failed to fetch solar data');
    }
};
