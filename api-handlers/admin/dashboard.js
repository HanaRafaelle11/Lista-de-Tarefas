import { AdminDashboardService } from '../../services/admin-dashboard-service.js';
import { logger } from '../../services/logger/index.js';
import { withAdminAuth } from '../../lib/auth/withAdminAuth.js';
import { supabaseAdmin } from '../../lib/supabase.js';

async function handler(req, res) {
  const start = Date.now();
  const targetUserId = req.query?.targetUserId;

  try {
    if (targetUserId) {
      // Securely fetch user events via service_role to bypass client RLS restrictions
      const { data, error } = await supabaseAdmin
        .from('events')
        .select('id, event_type, created_at, metadata')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      logger.info('api.admin.dashboard.user_events.success', { targetUserId, latency: Date.now() - start });
      return res.status(200).json({ success: true, events: data || [] });
    }

    const dashboardData = await AdminDashboardService.getDashboard();
    logger.info('api.admin.dashboard.success', { latency: Date.now() - start });
    return res.status(200).json(dashboardData);
  } catch (err) {
    logger.error('api.admin.dashboard.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default withAdminAuth(handler);
