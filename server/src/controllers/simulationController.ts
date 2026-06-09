import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { simulationQueue } from '../queues/simulationQueue';

const simulationSchema = z.object({
    leadId: z.string().uuid(),
    lat: z.number(),
    lng: z.number(),
    bill: z.number(),
});

export const startSimulation = async (req: Request, res: Response) => {
    try {
        const { leadId, lat, lng, bill } = simulationSchema.parse(req.body);

        // Create Simulation Record
        const simulation = await prisma.simulation.create({
            data: {
                leadId,
                status: 'PENDING',
            },
        });

        // Add to Queue
        await simulationQueue.add('run-simulation', {
            simulationId: simulation.id,
            lat,
            lng,
            bill,
        });

        res.status(202).json({ message: 'Simulation started', simulationId: simulation.id });
    } catch (error) {
        res.status(400).json({ error: error instanceof z.ZodError ? error.errors : 'Failed to start simulation' });
    }
};

export const getSimulationStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const simulation = await prisma.simulation.findUnique({ where: { id } });

        if (!simulation) {
            return res.status(404).json({ error: 'Simulation not found' });
        }

        res.json(simulation);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
