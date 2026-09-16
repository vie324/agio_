'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { Staff } from '@/lib/types';

/* ─── LINE / 外部リンク（実際のURLに差し替えてください） ─── */
const LINE_URL        = 'https://lin.ee/y8NUcXU';
const GOOGLE_MAPS_URL = 'https://share.google/4nCMHvyrTJL9jI7Wz';

/* ─── メインメニュー ─── */
interface ServiceItem {
  id: string;
  name: string;
  desc: string;
  duration: number; // 分
  price: number;    // 円（税込）
  icon: string;
}

const SERVICES: ServiceItem[] = [
  { id: '01', name: '似合わせカットシャンプー',              desc: '歴20年以上のスタイリストが担当',              duration: 60,  price: 5500,  icon: '✂️' },
  { id: '02', name: '似合わせカット＋デトックストリートメント', desc: 'デトックス効果でダメージをしっかりケア',        duration: 90,  price: 8800,  icon: '🌿' },
  { id: '03', name: 'HUEヴィーガンフルカラー＋カット',       desc: 'アンモニア・シリコン不使用 / トリートメント付き', duration: 120, price: 10500, icon: '🌈' },
  { id: '04', name: 'HUEヴィーガンリタッチ＋カット',        desc: 'アンモニア・シリコン不使用 / トリートメント付き', duration: 120, price: 9500,  icon: '🌱' },
  { id: '05', name: 'コンシャスフルカラー＋カット',          desc: 'agio基本ケア',                              duration: 120, price: 9500,  icon: '🎨' },
  { id: '06', name: 'コンシャスリタッチカラー＋カット',       desc: '基本白髪染め',                              duration: 120, price: 8500,  icon: '✨' },
  { id: '07', name: '艶マニキュア＋カット',                 desc: 'marbb洗浄付き',                             duration: 120, price: 11500, icon: '💎' },
  { id: '08', name: '似合わせカット＋頭浸浴＋２０分ヘッドスパ', desc: 'PC・スマホで頭が重い方へ',                   duration: 120, price: 9900,  icon: '🛁' },
  { id: '09', name: 'カット＋２０分クレンジングスパ',         desc: '頭皮がスッキリしない方へ',                    duration: 90,  price: 8800,  icon: '💆' },
  { id: '10', name: 'HUEヴィーガンカラー＋カット＋頭浸浴＋marbbスパ', desc: '究極の癒やし',                   duration: 150, price: 12500, icon: '🌸' },
  { id: '11', name: '顔周り縮毛矯正＋カット',               desc: '朝のスタイリングが楽になる',                  duration: 120, price: 8500,  icon: '💫' },
  { id: '12', name: 'ヴィーガンストレート（カット・marbb込）', desc: '自然なストレートに仕上げます',                duration: 210, price: 15500, icon: '🌊' },
  { id: '13', name: '【メンズ限定】パーマカット',             desc: 'メンズ専用メニュー',                         duration: 120, price: 8800,  icon: '🧔' },
  { id: '14', name: 'ダメージレス×低刺激パーマ＋カット',     desc: '質感重視のやさしいパーマ',                    duration: 150, price: 11000, icon: '🌀' },
];

/* ─── 追加オプション ─── */
interface AddonItem { id: string; name: string; desc: string; duration: number; price: number }
const ADDONS: AddonItem[] = [
  { id: '15', name: 'marbbナノバブル頭皮クレンジング',       desc: 'カット・カラーに追加',  duration: 5,  price: 1000 },
  { id: '16', name: '残留薬剤デトックストリートメントライト', desc: 'カラー・パーマに追加',  duration: 5,  price: 1100 },
  { id: '17', name: '残留薬剤デトックストリートメントフル',   desc: 'カラー・パーマに追加',  duration: 10, price: 3300 },
];

/* ─── 定数 ─── */
const STEP_LABELS = ['メニュー', 'スタッフ', '日時', 'お客様情報', '確認'];
const DAY_NAMES   = ['日', '月', '火', '水', '木', '金', '土'];
const OPEN_HOUR   = 9;
const CLOSE_HOUR  = 20;

function genTimeSlots(durationMin: number): string[] {
  const slots: string[] = [];
  const lastStart = CLOSE_HOUR * 60 - durationMin;
  for (let m = OPEN_HOUR * 60; m <= lastStart; m += 30) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

function getCalendarMatrix(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateJP(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${y}年${m}月${d}日（${DAY_NAMES[wd]}）`;
}

function yen(n: number) { return '¥' + n.toLocaleString('ja-JP'); }

function durationLabel(min: number) {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

/* ─── ステップ表示 ─── */
function Steps({ current }: { current: number }) {
  return (
    <div className="bk-steps">
      {STEP_LABELS.map((label, i) => {
        const num  = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={num} className="bk-step">
            <div className="bk-step-wrap">
              <div className={`bk-step-dot${done ? ' done' : active ? ' active' : ''}`}>
                {done ? <i className="ti ti-check" style={{ fontSize: 13 }}></i> : num}
              </div>
              <span className="bk-step-label">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`bk-step-line${done ? ' done' : ''}`}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── ヘッダー ─── */
function Header() {
  return (
    <header className="bk-header">
      <div className="bk-logo">
        <span className="bk-logo-gem"></span>
        agio hair&amp;spa
        <span className="bk-logo-gem"></span>
      </div>
      <div className="bk-logo-sub">ご予約フォーム</div>
    </header>
  );
}

/* ─── LINEゲート ─── */
function LineGate({ onYes }: { onYes: () => void }) {
  const [showNo, setShowNo] = useState(false);

  if (showNo) {
    return (
      <div className="bk-root">
        <Header />
        <div className="bk-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.35s var(--ease) both', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
            <div className="bk-section-title" style={{ marginBottom: 8 }}>LINE限定メニューのご案内</div>
            <div style={{ fontSize: 13, color: 'var(--ink-m)', lineHeight: 1.8, marginBottom: 28 }}>
              このご予約フォームはLINE公式アカウントにご登録いただいたお客様向けの<strong>LINE限定メニュー</strong>専用です。
              <br />ご登録いただくとお得な限定価格でご予約いただけます。
            </div>

            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 24px', borderRadius: 12, marginBottom: 12,
                background: '#06C755', color: '#fff',
                fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
                textDecoration: 'none', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(6,199,85,0.4)',
                transition: 'all 0.2s',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 40 40" fill="white">
                <path d="M20 2C10.06 2 2 9.16 2 17.96c0 7.9 6.63 14.5 15.56 15.73.61.13 1.44.4 1.65.92.19.47.12 1.2.06 1.67l-.27 1.6c-.08.47-.38 1.85 1.62.99 2-.86 10.82-6.37 14.76-10.9C37.74 24.5 38 21.32 38 17.96 38 9.16 29.94 2 20 2z"/>
              </svg>
              LINE公式アカウントを友達追加する
            </a>

            <div style={{ fontSize: 12, color: 'var(--ink-l)', margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--sand-d)' }}></span>
              または
              <span style={{ flex: 1, height: 1, background: 'var(--sand-d)' }}></span>
            </div>

            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 12,
                background: 'var(--cream)', color: 'var(--ink-m)',
                border: '1.5px solid var(--sand-d)',
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                textDecoration: 'none', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s',
              }}
            >
              <i className="ti ti-map-pin" style={{ fontSize: 16, color: '#EA4335' }}></i>
              Googleマップからご予約
            </a>

            <button
              onClick={() => setShowNo(false)}
              style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--ink-l)', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
            >
              ← 戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-root">
      <Header />
      <div className="bk-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.35s var(--ease) both', maxWidth: 420, width: '100%' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg,var(--accent),var(--accent-m))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 30,
            boxShadow: '0 8px 28px rgba(44,74,62,0.25)',
          }}>✂️</div>
          <div className="bk-section-title" style={{ marginBottom: 8 }}>LINEにご登録済みですか？</div>
          <div style={{ fontSize: 13, color: 'var(--ink-l)', lineHeight: 1.8, marginBottom: 32 }}>
            このフォームはLINE公式アカウント登録者向けの<br />LINE限定価格でご案内しています。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="bk-next" onClick={onYes} style={{ width: '100%' }}>
              <i className="ti ti-check" style={{ marginRight: 8 }}></i>
              はい、登録済みです　→ 予約へ進む
            </button>
            <button className="bk-back" onClick={() => setShowNo(true)} style={{ width: '100%', justifyContent: 'center' }}>
              まだ登録していません
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── メインコンポーネント ─── */
export default function BookingFormClient({ initialStaff }: { initialStaff: Staff[] }) {
  const [lineOk, setLineOk]       = useState(false);
  const [step, setStep]           = useState(1);
  const [service, setService]     = useState<ServiceItem | null>(null);
  const [addons, setAddons]       = useState<Set<string>>(new Set());
  const [staffSel, setStaffSel]   = useState<Staff | 'any' | null>(null);
  const [date, setDate]           = useState<string | null>(null);
  const [time, setTime]           = useState<string | null>(null);
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const calMatrix = useMemo(() => getCalendarMatrix(calYear, calMonth), [calYear, calMonth]);
  const todayISO  = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  /* 合計時間・料金 */
  const selectedAddons   = ADDONS.filter((a) => addons.has(a.id));
  const totalDuration    = (service?.duration ?? 0) + selectedAddons.reduce((s, a) => s + a.duration, 0);
  const totalPrice       = (service?.price ?? 0) + selectedAddons.reduce((s, a) => s + a.price, 0);

  useEffect(() => {
    if (!date || !staffSel) return;
    const staffId = staffSel !== 'any' ? staffSel.id : null;
    const sb = getBrowserSupabase();
    let q = sb.from('bookings').select('start_time').eq('booking_date', date);
    if (staffId) q = q.eq('staff_id', staffId);
    q.then(({ data }) => setTakenSlots((data ?? []).map((r) => r.start_time.slice(0, 5))));
    setTime(null);
  }, [date, staffSel]);

  const timeSlots = useMemo(() => genTimeSlots(totalDuration || 60), [totalDuration]);

  const canNext = useMemo(() => {
    if (step === 1) return !!service;
    if (step === 2) return staffSel !== null;
    if (step === 3) return !!(date && time);
    if (step === 4) return name.trim().length > 0 && phone.trim().length > 0;
    return false;
  }, [step, service, staffSel, date, time, name, phone]);

  const goBack = useCallback(() => { setError(null); setStep((s) => Math.max(1, s - 1)); }, []);
  const goNext = useCallback(() => { setError(null); setStep((s) => Math.min(5, s + 1)); }, []);

  const toggleAddon = (id: string) => {
    setAddons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitBooking = async () => {
    if (!service || !date || !time) return;
    setSubmitting(true); setError(null);
    try {
      const sb = getBrowserSupabase();
      let resolvedStaffId: string | null = null;
      if (staffSel !== 'any' && staffSel !== null) {
        resolvedStaffId = staffSel.id;
      } else {
        const { data: bt } = await sb.from('bookings').select('staff_id').eq('booking_date', date);
        const counts = new Map<string, number>();
        for (const s of initialStaff) counts.set(s.id, 0);
        for (const b of bt ?? []) counts.set(b.staff_id, (counts.get(b.staff_id) ?? 0) + 1);
        resolvedStaffId = [...initialStaff].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]?.id ?? null;
      }
      if (!resolvedStaffId) { setError('スタッフが見つかりませんでした。お電話にてご連絡ください。'); setSubmitting(false); return; }

      const startMin = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
      const endMin   = startMin + totalDuration;
      const endTime  = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const menuText = selectedAddons.length > 0
        ? `${service.name}（＋${selectedAddons.map((a) => a.name).join('・')}）`
        : service.name;

      const { data, error: dbErr } = await sb.from('bookings').insert({
        customer_name: name.trim(),
        staff_id:      resolvedStaffId,
        booking_date:  date,
        start_time:    time,
        end_time:      endTime,
        menu:          menuText,
        status:        'tentative',
        customer_type: 'new',
        amount:        totalPrice,
        note: [note.trim(), email ? `メール: ${email}` : '', `Tel: ${phone}`, 'LINE登録済み'].filter(Boolean).join(' / ') || null,
      }).select('id').single();

      if (dbErr) throw new Error(dbErr.message);
      setBookingId(data?.id ?? null);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : '予約の送信に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── LINEゲート ─── */
  if (!lineOk) return <LineGate onYes={() => setLineOk(true)} />;

  /* ─── DONE ─── */
  if (step === 6) {
    const shortId = bookingId ? bookingId.slice(0, 8).toUpperCase() : '';
    return (
      <div className="bk-root">
        <Header />
        <div className="bk-body">
          <div className="bk-done">
            <div className="bk-done-icon"><i className="ti ti-check"></i></div>
            <div className="bk-done-title">ご予約を承りました</div>
            <div className="bk-done-sub">
              確認のご連絡をさせていただく場合がございます。<br />
              ご不明な点はLINEまたはお電話にてお気軽にどうぞ。
            </div>
            {shortId && <div className="bk-done-num">予約番号　{shortId}</div>}
            <div style={{ marginTop: 28, background: 'var(--cream)', border: '1px solid var(--sand-d)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)', textAlign: 'left' }}>
              <div style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-m))', padding: '12px 20px' }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: '#fff', fontWeight: 300, letterSpacing: '0.05em' }}>ご予約内容</span>
              </div>
              {[
                { icon: service?.icon, label: 'メニュー', val: service?.name },
                { icon: '📅', label: '日時', val: date && time ? `${formatDateJP(date)}　${time}〜` : '' },
                { icon: '⏱', label: '所要時間', val: durationLabel(totalDuration) },
                { icon: '💴', label: '料金（税込）', val: yen(totalPrice) },
                { icon: '👤', label: 'お名前', val: `${name} 様` },
              ].map((r, i) => (
                <div key={i} className="bk-summary-row">
                  <div className="bk-summary-icon">{r.icon}</div>
                  <div>
                    <div className="bk-summary-label">{r.label}</div>
                    <div className="bk-summary-val">{r.val}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bk-done-actions">
              <button className="bk-done-btn bk-done-btn-primary" onClick={() => window.location.reload()}>
                別のご予約をする
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── 各ステップ ─── */
  const renderStep = () => {
    /* Step 1 — メニュー */
    if (step === 1) return (
      <>
        <div className="bk-section-title">メニューをお選びください</div>
        <div className="bk-section-sub">LINE限定価格（税込）・所要時間を表示しています</div>
        <div className="bk-services">
          {SERVICES.map((s) => {
            const sel = service?.id === s.id;
            return (
              <div key={s.id} className={`bk-service-card${sel ? ' selected' : ''}`} onClick={() => { setService(s); setAddons(new Set()); }}>
                <div className="bk-service-icon">{s.icon}</div>
                <div className="bk-service-info">
                  <div className="bk-service-name">{s.name}</div>
                  <div className="bk-service-desc">{s.desc}</div>
                </div>
                <div className="bk-service-right">
                  <div className="bk-service-price">{yen(s.price)}</div>
                  <div className="bk-service-duration">{durationLabel(s.duration)}</div>
                </div>
                <div className="bk-service-check">
                  {sel && <i className="ti ti-check" style={{ fontSize: 11 }}></i>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 追加オプション */}
        {service && (
          <div style={{ marginTop: 28, animation: 'fadeUp 0.3s var(--ease) both' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
              追加オプション <span style={{ fontSize: 11, color: 'var(--ink-l)', fontWeight: 400 }}>（任意・複数選択可）</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-l)', marginBottom: 14 }}>選択した場合は料金と所要時間に加算されます</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ADDONS.map((a) => {
                const sel = addons.has(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => toggleAddon(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${sel ? 'var(--gold-d)' : 'var(--sand-d)'}`,
                      background: sel ? 'rgba(201,168,76,0.08)' : 'var(--cream)',
                      transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${sel ? 'var(--gold-d)' : 'var(--sand-d)'}`,
                      background: sel ? 'var(--gold)' : 'var(--cream)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.2s',
                    }}>
                      {sel && <i className="ti ti-check" style={{ fontSize: 11, color: 'var(--ink)' }}></i>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-l)', marginTop: 1 }}>{a.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15 }}>+{yen(a.price)}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-l)' }}>+{a.duration}分</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 合計表示 */}
            <div style={{
              marginTop: 14, padding: '12px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg,var(--accent-l),rgba(232,240,237,0.5))',
              border: '1px solid rgba(44,74,62,0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                合計 — {durationLabel(totalDuration)}
              </span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--accent)' }}>
                {yen(totalPrice)}
              </span>
            </div>
          </div>
        )}
      </>
    );

    /* Step 2 — スタッフ */
    if (step === 2) return (
      <>
        <div className="bk-section-title">担当者をお選びください</div>
        <div className="bk-section-sub">ご希望の担当者をお選びいただけます</div>
        <div className="bk-staffs">
          <div className={`bk-staff-card bk-staff-any${staffSel === 'any' ? ' selected' : ''}`} onClick={() => setStaffSel('any')}>
            <div className="bk-staff-avatar" style={{ background: 'var(--sand)', color: 'var(--ink-m)' }}>
              <i className="ti ti-users" style={{ fontSize: 18 }}></i>
            </div>
            <div>
              <div className="bk-staff-name">指名なし</div>
              <div className="bk-staff-role">空いている担当者にお任せ</div>
            </div>
          </div>
          {initialStaff.map((s) => {
            const sel = staffSel !== 'any' && staffSel?.id === s.id;
            return (
              <div key={s.id} className={`bk-staff-card${sel ? ' selected' : ''}`} onClick={() => setStaffSel(s)}>
                <div className="bk-staff-avatar" style={{ background: s.bg_color, color: s.fg_color }}>{s.initials}</div>
                <div>
                  <div className="bk-staff-name">{s.name}</div>
                  <div className="bk-staff-role">{s.employment_type === 'contract' ? '業務委託スタイリスト' : 'スタイリスト'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );

    /* Step 3 — 日時 */
    if (step === 3) return (
      <>
        <div className="bk-section-title">ご希望の日時をお選びください</div>
        <div className="bk-section-sub">日付を選択後、時間帯をお選びください</div>
        <div className="bk-notice">
          <i className="ti ti-info-circle" style={{ marginRight: 6 }}></i>
          定休日：月曜日　／　営業時間：9:00〜20:00
        </div>
        <div className="bk-calendar">
          <div className="bk-cal-head">
            <button className="bk-cal-nav" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }}>
              <i className="ti ti-chevron-left"></i>
            </button>
            <div className="bk-cal-month">{calYear}年 {calMonth + 1}月</div>
            <button className="bk-cal-nav" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }}>
              <i className="ti ti-chevron-right"></i>
            </button>
          </div>
          <div className="bk-cal-weekdays">
            {DAY_NAMES.map((d) => <div key={d} className="bk-cal-wd">{d}</div>)}
          </div>
          <div className="bk-cal-days">
            {calMatrix.map((day, idx) => {
              if (day === null) return <div key={idx} className="bk-cal-day empty"></div>;
              const iso  = isoDate(calYear, calMonth, day);
              const dow  = idx % 7;
              const past = iso < todayISO;
              const disabled = past || dow === 1;
              const cls = ['bk-cal-day', iso === date ? 'selected' : '', iso === todayISO && iso !== date ? 'today' : '', disabled ? 'disabled past' : '', !disabled && dow === 0 ? 'sun' : '', !disabled && dow === 6 ? 'sat' : ''].filter(Boolean).join(' ');
              return <div key={idx} className={cls} onClick={() => !disabled && setDate(iso)}>{day}</div>;
            })}
          </div>
        </div>

        {date && (
          <>
            <div className="bk-times-title">{formatDateJP(date)} の空き時間</div>
            <div className="bk-times">
              {timeSlots.map((t) => {
                const taken = takenSlots.includes(t);
                return (
                  <div key={t} className={`bk-time-slot${time === t ? ' selected' : taken ? ' taken' : ''}`} onClick={() => !taken && setTime(t)}>
                    {t}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-l)', marginTop: 4 }}>取り消し線の時間帯は予約済みです</div>
          </>
        )}
      </>
    );

    /* Step 4 — お客様情報 */
    if (step === 4) return (
      <>
        <div className="bk-section-title">お客様情報をご入力ください</div>
        <div className="bk-section-sub">お名前と電話番号は必須です</div>
        <div className="bk-form">
          <div className="bk-field-group">
            <div className="bk-field">
              <label className="bk-label">お名前<span className="bk-required">＊</span></label>
              <input className="bk-input" type="text" placeholder="山田 花子" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="bk-field">
              <label className="bk-label">電話番号<span className="bk-required">＊</span></label>
              <input className="bk-input" type="tel" placeholder="090-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
          </div>
          <div className="bk-field">
            <label className="bk-label">メールアドレス（任意）</label>
            <input className="bk-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="bk-field">
            <label className="bk-label">ご要望・アレルギー等（任意）</label>
            <textarea className="bk-textarea" placeholder="アレルギーやご希望のスタイルなどがあればお知らせください" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </>
    );

    /* Step 5 — 確認 */
    if (step === 5) {
      const addonRows = selectedAddons.map((a) => ({ icon: '➕', label: '追加オプション', val: `${a.name}（＋${yen(a.price)}）` }));
      return (
        <>
          <div className="bk-section-title">ご予約内容の確認</div>
          <div className="bk-section-sub">内容をご確認の上、「予約を確定する」を押してください</div>
          <div className="bk-summary">
            <div className="bk-summary-head">
              <i className="ti ti-calendar-check" style={{ fontSize: 20, color: '#fff' }}></i>
              <div className="bk-summary-head-title">予約内容</div>
            </div>
            {[
              { icon: service?.icon, label: 'メニュー', val: service?.name },
              ...addonRows,
              { icon: '⏱', label: '合計所要時間', val: durationLabel(totalDuration) },
              { icon: '💴', label: '料金（税込）', val: <span className="bk-price-tag">{yen(totalPrice)}</span> },
              { icon: <i className="ti ti-user"></i>, label: '担当者', val: staffSel === 'any' ? '指名なし（当日割り当て）' : (staffSel as Staff)?.name ?? '' },
              { icon: <i className="ti ti-calendar"></i>, label: '日付', val: date ? formatDateJP(date) : '' },
              { icon: <i className="ti ti-clock"></i>, label: '時間', val: time ? `${time} 〜（約${durationLabel(totalDuration)}）` : '' },
            ].map((row, i) => (
              <div key={i} className="bk-summary-row">
                <div className="bk-summary-icon">{row.icon}</div>
                <div><div className="bk-summary-label">{row.label}</div><div className="bk-summary-val">{row.val}</div></div>
              </div>
            ))}
          </div>
          <div className="bk-summary" style={{ marginBottom: 0 }}>
            <div className="bk-summary-head">
              <i className="ti ti-id-badge" style={{ fontSize: 20, color: '#fff' }}></i>
              <div className="bk-summary-head-title">お客様情報</div>
            </div>
            {[
              { icon: <i className="ti ti-user"></i>, label: 'お名前', val: `${name} 様` },
              { icon: <i className="ti ti-phone"></i>, label: '電話番号', val: phone },
              ...(email ? [{ icon: <i className="ti ti-mail"></i>, label: 'メール', val: email }] : []),
              ...(note  ? [{ icon: <i className="ti ti-note"></i>, label: 'ご要望', val: note }] : []),
            ].map((row, i) => (
              <div key={i} className="bk-summary-row">
                <div className="bk-summary-icon">{row.icon}</div>
                <div><div className="bk-summary-label">{row.label}</div><div className="bk-summary-val">{row.val}</div></div>
              </div>
            ))}
          </div>
          {error && <div className="bk-error"><i className="ti ti-alert-circle"></i> {error}</div>}
        </>
      );
    }
  };

  return (
    <div className="bk-root">
      <Header />
      <div className="bk-body">
        <Steps current={step} />
        <div style={{ animation: 'fadeUp 0.3s var(--ease) both' }}>
          {renderStep()}
        </div>
        <div className="bk-nav">
          {step > 1 && <button className="bk-back" onClick={goBack}><i className="ti ti-arrow-left"></i>戻る</button>}
          {step === 5 ? (
            <button className="bk-next" disabled={submitting} onClick={submitBooking}>
              {submitting
                ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', marginRight: 6 }}></i>送信中…</>
                : <><i className="ti ti-calendar-check" style={{ marginRight: 6 }}></i>予約を確定する</>
              }
            </button>
          ) : (
            <button className="bk-next" disabled={!canNext} onClick={goNext}>
              次へ <i className="ti ti-arrow-right" style={{ marginLeft: 4 }}></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
