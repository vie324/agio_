import { isSupabaseConfigured, getServerSupabase } from '@/lib/supabase/server';
import BookingFormClient from '@/components/BookingFormClient';
import type { Staff } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ご予約 — agio hair&spa',
  description: 'agio hair&spa のオンライン予約フォーム。ご希望のメニュー・担当者・日時をお選びください。',
};

export default async function BookPage() {
  let staff: Staff[] = [];

  if (isSupabaseConfigured()) {
    const sb = getServerSupabase();
    const { data } = await sb
      .from('staff')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    staff = (data ?? []) as Staff[];
  }

  return <BookingFormClient initialStaff={staff} />;
}
