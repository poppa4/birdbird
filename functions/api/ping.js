/* POST /api/ping – an anonymous page view or heartbeat; see functions/_lib/stats.js */
import { endpoint } from '../_lib/api.js';
import { ping } from '../_lib/stats.js';
export const onRequest = endpoint({ POST: ping });
