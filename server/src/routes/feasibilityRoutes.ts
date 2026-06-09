import { Router } from 'express';
import { calculateFeasibility } from '../controllers/feasibilityController';

const router = Router();

router.post('/calculate', calculateFeasibility);

export default router;
