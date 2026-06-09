import { Queue } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const simulationQueue = new Queue('simulation-queue', { connection });
