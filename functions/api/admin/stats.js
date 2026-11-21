/* GET /api/admin/stats – the owner's overview (admin.html); see functions/_lib/stats.js */
import { endpoint } from '../../_lib/api.js';
import { adminStats } from '../../_lib/stats.js';
export const onRequest = endpoint({ GET: adminStats });
