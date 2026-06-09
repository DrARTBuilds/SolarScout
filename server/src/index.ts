import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// import authRoutes from './routes/authRoutes';
import feasibilityRoutes from './routes/feasibilityRoutes';
// import simulationRoutes from './routes/simulationRoutes';
import detectionRoutes from './routes/detectionRoutes';
// import './workers/simulationWorker'; // Start Worker - Disabled to avoid Redis dependency

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// app.use('/api/auth', authRoutes);
app.use('/api/feasibility', feasibilityRoutes);
// app.use('/api/simulation', simulationRoutes);
app.use('/api/detection', detectionRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'SolarScout API is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
