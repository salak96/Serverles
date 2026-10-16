import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './users/users.routes';
import healthRoutes from './health/health.routes';
import licenseRoutes from './licenses/licenses.routes';
import planRoutes from './plans/plans.routes';
import notificationRoutes from './notifications/notifications.routes';
import adminRoutes from './admin/admin.routes';
import subsRoutes from './subs/subs.routes';
import toolRoutes from './tools/tools.routes';
import toolAdminRoutes from './tools/tools.admin.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/plans', planRoutes);
router.use('/subscriptions', subsRoutes);
router.use('/licenses', licenseRoutes);
router.use('/tools', toolRoutes);
router.use('/tools', toolAdminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
