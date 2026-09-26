import { getSchedule } from '@/lib/worker';

export async function GET() {
  const data = await getSchedule();
  return Response.json(data);
}