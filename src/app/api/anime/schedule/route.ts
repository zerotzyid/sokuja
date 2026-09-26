export const runtime = 'nodejs';

import { getScheduleHtml } from '@/lib/sokuja/client';
import { parseSchedule } from '@/lib/sokuja/parser';

export async function GET() {
  try {
    const html = await getScheduleHtml();
    const data = parseSchedule(html);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}