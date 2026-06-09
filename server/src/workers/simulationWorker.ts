import { Worker } from 'bullmq';
import prisma from '../prisma';
import { fetchSolarData } from '../services/solarService';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

const worker = new Worker('simulation-queue', async (job) => {
    const { simulationId, lat, lng, bill } = job.data;

    console.log(`Processing simulation ${simulationId}...`);

    try {
        // Update status to RUNNING
        await prisma.simulation.update({
            where: { id: simulationId },
            data: { status: 'RUNNING' },
        });

        // Perform Calculation (Reusing logic for now, ideally shared)
        const { avgGTI, dailyInsolation } = await fetchSolarData(lat, lng);
        const annualGenerationPerKW = dailyInsolation * 365 * 0.8;
        const monthlyUnits = bill / 8;
        const yearlyUnits = monthlyUnits * 12;
        const kWneeded = yearlyUnits / annualGenerationPerKW;
        const systemCost = kWneeded * 55000;
        const annualSavings = yearlyUnits * 8;
        const payback = systemCost / annualSavings;

        // Update Simulation with Results
        await prisma.simulation.update({
            where: { id: simulationId },
            data: {
                status: 'SUCCESS',
                panelCapacityKWp: kWneeded,
                annualGenerationKWh: yearlyUnits,
                annualSavingsINR: annualSavings,
                paybackPeriodYears: payback,
                openMeteoResponseSummary: { avgGTI, dailyInsolation },
            },
        });

        console.log(`Simulation ${simulationId} completed.`);
    } catch (error) {
        console.error(`Simulation ${simulationId} failed:`, error);
        await prisma.simulation.update({
            where: { id: simulationId },
            data: { status: 'FAILED' },
        });
    }
}, { connection });

export default worker;
