import { Router } from 'express';
import { startSimulation, getSimulationStatus } from '../controllers/simulationController';

const router = Router();

router.post('/start', startSimulation);
router.get('/:id', getSimulationStatus);

export default router;
