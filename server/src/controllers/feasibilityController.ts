import { Request, Response } from 'express';
import { z } from 'zod';
import { fetchSolarData } from '../services/solarService';

const feasibilitySchema = z.object({
    lat: z.number(),
    lng: z.number(),
    bill: z.number().optional(),
    capacityKW: z.number().optional(),
    category: z.enum(['Residential', 'Gated Community', 'Commercial', 'Industrial', 'Water Body']).optional().default('Residential')
});

export const calculateFeasibility = async (req: Request, res: Response) => {
    try {
        const { lat, lng, bill, capacityKW: inputCapacity, category } = feasibilitySchema.parse(req.body);

        // Fetch solar data dynamically first
        let solarData = { avgGTI: 0, dailyInsolation: 0 };
        try {
            solarData = await fetchSolarData(lat, lng);
        } catch (solarError) {
            console.warn("Solar API failed, using default values:", solarError);
        }

        // Category-Specific Dynamic Tariffs and Savings per Unit (₹/kWh)
        // Values adapted to typical state utility slabs in India (e.g. TSSPDCL, MSEDCL, BESCOM)
        let costPerUnit = 7.0;
        let savingsPerUnit = 8.5;

        switch (category) {
            case 'Residential':
                costPerUnit = 6.5;
                savingsPerUnit = 8.0;
                break;
            case 'Gated Community':
                costPerUnit = 7.0;
                savingsPerUnit = 8.5;
                break;
            case 'Commercial':
                costPerUnit = 10.0;
                savingsPerUnit = 11.5;
                break;
            case 'Industrial':
                costPerUnit = 8.5;
                savingsPerUnit = 10.0;
                break;
            case 'Water Body':
                costPerUnit = 6.0;
                savingsPerUnit = 7.5;
                break;
        }

        // Dynamically compute Units per kW per Month based on actual tilted solar insolation
        // Formula: dailyInsolation (kWh/m²/day) * 30.4 days * 0.75 Performance Ratio (losses: temperature, inverter, cabling)
        // Fall back to typical default 120 units if insolation is missing or invalid.
        const performanceRatio = 0.75;
        const unitsPerKWMonth = (solarData.dailyInsolation > 0)
            ? Math.round(solarData.dailyInsolation * 30.4 * performanceRatio * 10) / 10
            : 120.0;

        const AREA_PER_KW_SQFT = 118.4; // Sq ft per kW (approx 11 m²/kWp)

        let systemSizeKW = 0;

        if (inputCapacity) {
            // Priority 1: Use capacity from Roof Analysis
            systemSizeKW = inputCapacity;
        } else if (bill) {
            // Priority 2: Estimate from Monthly Bill
            const monthlyUnits = bill / costPerUnit;
            systemSizeKW = monthlyUnits / unitsPerKWMonth;
        } else {
            throw new Error("Either 'capacityKW' or 'bill' must be provided.");
        }

        // Round to 2 decimal places
        systemSizeKW = Math.round(systemSizeKW * 100) / 100;

        // 3. Calculate Financials
        // Pricing Logic: > 2kW = 75k/kW, <= 2kW = 80k/kW
        const costPerKW = systemSizeKW > 2 ? 75000 : 80000;
        const totalCost = systemSizeKW * costPerKW;

        // Subsidy Calculation (PM Surya Ghar Muft Bijli Yojana) - Only for Residential
        let subsidy = 0;
        if (category === 'Residential' || category === 'Gated Community') {
            if (systemSizeKW <= 2) {
                subsidy = systemSizeKW * 30000;
            } else if (systemSizeKW <= 3) {
                subsidy = (2 * 30000) + ((systemSizeKW - 2) * 18000);
            } else {
                subsidy = 78000;
            }
        }

        const netCost = totalCost - subsidy;

        // 4. Savings
        const monthlySavings = systemSizeKW * unitsPerKWMonth * savingsPerUnit;
        const annualSavings = monthlySavings * 12;
        const lifetimeSavings = annualSavings * 25;

        // 5. Payback Period
        const paybackPeriodYears = netCost / annualSavings;

        // 6. Roof Area
        const requiredRoofAreaSqFt = systemSizeKW * AREA_PER_KW_SQFT;
        const requiredRoofAreaSqM = requiredRoofAreaSqFt * 0.092903;

        // 7. Environmental Impact (Mock factors)
        const co2OffsetTons = systemSizeKW * 0.7 * 25; // 0.7 tons per kW per year approx
        const treesPlanted = Math.round(co2OffsetTons * 10); // Approx 10 trees per ton

        res.json({
            location: { lat, lng },
            solarData,
            feasibility: {
                systemSizeKW,
                totalCost: Math.round(totalCost),
                subsidy: Math.round(subsidy),
                netCost: Math.round(netCost),
                monthlySavings: Math.round(monthlySavings),
                annualSavings: Math.round(annualSavings),
                lifetimeSavings: Math.round(lifetimeSavings),
                paybackPeriodYears: Math.round(paybackPeriodYears * 10) / 10,
                requiredRoofAreaSqFt: Math.round(requiredRoofAreaSqFt),
                requiredRoofAreaSqM: Math.round(requiredRoofAreaSqM),
                co2OffsetTons: Math.round(co2OffsetTons),
                treesPlanted,
                category
            }
        });

    } catch (error: any) {
        console.error("Feasibility calculation error:", error);
        res.status(400).json({ error: error instanceof z.ZodError ? error.errors : (error.message || 'Calculation failed') });
    }
};
