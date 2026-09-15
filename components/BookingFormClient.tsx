'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { Staff } from '@/lib/types';

/* ─── サービスカタログ ─── */
interface ServiceItem {
  id: string;
  name: string;
  desc: string;
  duration: number; // 分
  price: number;    // 円（税込）
  icon: string;
}

const SERVICES: ServiceItem[] = [
  { id: 'cut',           name: 'カット',              desc: 'シャンプー・ブロー込み',           duration: 60,  price: 6600,  icon: '✂️' },
  { id: 'cut_color',     name: 'カット＋カラー',       desc: 'フルカラー＋カット　人気No.1',      duration: 120, price: 14300, icon: '🎨' },
  { id: 'highlight',     name: 'ハイライトカラー',     desc: 'デザインハイライト（ブリーチ使用）', duration: 150, price: 18700, icon: '✨' },
  { id: 'gray_color',    name: 'グレイカラー',         desc: '白髪染め（ファッションカラー）',     duration: 90,  price: 9900,  icon: '🌿' },
  { id: 'full_color',    name: 'フルカラー',           desc: 'ブリーチ不使用／リタッチ込み',      duration: 90,  price: 9900,  icon: '🌈' },
  { id: 'digital_perm',  name: 'デジタルパーマ',       desc: 'カット込み／ダメージレス',         duration: 180, price: 24200, icon: '🌀' },
  { id: 'straight',      name: '縮毛矯正',             desc: 'カット込み／自然なストレート',      duration: 180, price: 24200, icon: '💫' },
  { id: 'treatment',     name: 'トリートメント',       desc: 'ダメージケア・集中補修',            duration: 60,  price: 5500,  icon: '💆' },
  { id: 'head_spa',      name: 'ヘッドスパ',           desc: 'スカルプケア＋リラクゼーション',    duration: 60,  price: 8800,  icon: '🛁' },
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
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/* ─── カレンダーヘルパー ─── */
function getCalendarMatrix(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateJP(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${y}年${m}月${d}日（${DAY_NAMES[wd]}）`;
}

function yen(n: number) {
  return '¥' + n.toLocaleString('ja-JP');
}

/* ─── ステップ表示 ─── */
function Steps({ current }: { current: number }) {
  return (
    <div className="bk-steps">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done   = current > num;
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

/* ─── メインコンポーネント ─── */
export default function BookingFormClient({ initialStaff }: { initialStaff: Staff[] }) {
  const [step, setStep]           = useState(1);
  const [service, setService]     = useState<ServiceItem | null>(null);
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

  /* カレンダー */
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const calMatrix = useMemo(() => getCalendarMatrix(calYear, calMonth), [calYear, calMonth]);
  const todayISO  = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  /* 選択日が変わったら埋まり状況を取得 */
  useEffect(() => {
    if (!date || !staffSel) return;
    const staffId = staffSel !== 'any' ? staffSel.id : null;
    const sb = getBrowserSupabase();
    let q = sb.from('bookings').select('start_time').eq('booking_date', date);
    if (staffId) q = q.eq('staff_id', staffId);
    q.then(({ data }) => {
      setTakenSlots((data ?? []).map((r) => r.start_time.slice(0, 5)));
    });
    setTime(null);
  }, [date, staffSel]);

  const timeSlots = useMemo(() => genTimeSlots(service?.duration ?? 60), [service]);

  /* 次へ可否 */
  const canNext = useMemo(() => {
    if (step === 1) return !!service;
    if (step === 2) return staffSel !== null;
    if (step === 3) return !!(date && time);
    if (step === 4) return name.trim().length > 0 && phone.trim().length > 0;
    return false;
  }, [step, service, staffSel, date, time, name, phone]);

  const goBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const goNext = useCallback(() => {
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  }, []);

  /* 予約送信 */
  const submitBooking = async () => {
    if (!service || !date || !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();

      // スタッフ決定（指名なしの場合は当日に空きがある最初のスタッフ）
      let resolvedStaffId: string | null = null;
      if (staffSel !== 'any' && staffSel !== null) {
        resolvedStaffId = staffSel.id;
      } else {
        // 指名なし：その日に予約が少ないスタッフを割り当て
        const { data: bookingsToday } = await sb
          .from('bookings')
          .select('staff_id')
          .eq('booking_date', date);
        const counts = new Map<string, number>();
        for (const s of initialStaff) counts.set(s.id, 0);
        for (const b of bookingsToday ?? []) counts.set(b.staff_id, (counts.get(b.staff_id) ?? 0) + 1);
        const sorted = [...initialStaff].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));
        resolvedStaffId = sorted[0]?.id ?? null;
      }

      if (!resolvedStaffId) {
        setError('スタッフが見つかりませんでした。お電話にてご連絡ください。');
        setSubmitting(false);
        return;
      }

      const startMin  = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
      const endMin    = startMin + service.duration;
      const endTime   = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      const { data, error: dbErr } = await sb.from('bookings').insert({
        customer_name: name.trim(),
        staff_id:      resolvedStaffId,
        booking_date:  date,
        start_time:    time,
        end_time:      endTime,
        menu:          service.name,
        status:        'tentative',
        customer_type: 'new',
        amount:        service.price,
        note:          [note.trim(), email ? `メール: ${email}` : '', `Tel: ${phone}`].filter(Boolean).join(' / ') || null,
      }).select('id').single();

      if (dbErr) throw new Error(dbErr.message);
      setBookingId(data?.id ?? null);
      setStep(6); // done
    } catch (e) {
      setError(e instanceof Error ? e.message : '予約の送信に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── DONE ─── */
  if (step === 6) {
    const shortId = bookingId ? bookingId.slice(0, 8).toUpperCase() : '';
    return (
      <div className="bk-root">
        <header className="bk-header">
          <div className="bk-logo">
            <span className="bk-logo-gem"></span>
            agio hair&amp;spa
            <span className="bk-logo-gem"></span>
          </div>
          <div className="bk-logo-sub">予約フォーム</div>
        </header>
        <div className="bk-body">
          <div className="bk-done">
            <div className="bk-done-icon"><i className="ti ti-check"></i></div>
            <div className="bk-done-title">ご予約を承りました</div>
            <div className="bk-done-sub">
              サロンより確認のご連絡をさせていただく場合がございます。<br />
              お気軽にお問い合わせください。
            </div>
            {shortId && <div className="bk-done-num">予約番号　{shortId}</div>}
            <div style={{ marginTop: 28, background: 'var(--cream)', border: '1px solid var(--sand-d)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-m))', padding: '12px 20px' }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: '#fff', fontWeight: 300, letterSpacing: '0.05em' }}>ご予約内容</span>
              </div>
              {[
                { icon: '✂️', label: 'メニュー', val: service?.name },
                { icon: '📅', label: '日時', val: date && time ? `${formatDateJP(date)}　${time}〜` : '' },
                { icon: '👤', label: 'お客様名', val: `${name} 様` },
              ].map((r) => (
                <div key={r.label} className="bk-summary-row">
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
                別のご予約
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── STEP CONTENT ─── */
  const renderStep = () => {
    /* Step 1 — サービス */
    if (step === 1) return (
      <>
        <div className="bk-section-title">メニューをお選びください</div>
        <div className="bk-section-sub">施術内容・所要時間・料金をご確認の上お選びください（税込）</div>
        <div className="bk-services">
          {SERVICES.map((s) => {
            const sel = service?.id === s.id;
            return (
              <div key={s.id} className={`bk-service-card${sel ? ' selected' : ''}`} onClick={() => setService(s)}>
                <div className="bk-service-icon">{s.icon}</div>
                <div className="bk-service-info">
                  <div className="bk-service-name">{s.name}</div>
                  <div className="bk-service-desc">{s.desc}</div>
                </div>
                <div className="bk-service-right">
                  <div className="bk-service-price">{yen(s.price)}</div>
                  <div className="bk-service-duration">{s.duration}分</div>
                </div>
                <div className="bk-service-check">
                  {sel && <i className="ti ti-check" style={{ fontSize: 11 }}></i>}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );

    /* Step 2 — スタッフ */
    if (step === 2) return (
      <>
        <div className="bk-section-title">担当者をお選びください</div>
        <div className="bk-section-sub">ご希望の担当者をお選びいただけます</div>
        <div className="bk-staffs">
          <div
            className={`bk-staff-card bk-staff-any${staffSel === 'any' ? ' selected' : ''}`}
            onClick={() => setStaffSel('any')}
          >
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
              <div
                key={s.id}
                className={`bk-staff-card${sel ? ' selected' : ''}`}
                onClick={() => setStaffSel(s)}
              >
                <div
                  className="bk-staff-avatar"
                  style={{ background: s.bg_color, color: s.fg_color }}
                >
                  {s.initials}
                </div>
                <div>
                  <div className="bk-staff-name">{s.name}</div>
                  <div className="bk-staff-role">
                    {s.employment_type === 'contract' ? '業務委託スタイリスト' : 'スタイリスト'}
                  </div>
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
        <div className="bk-section-sub">日付を選択後、ご希望の時間帯をお選びください</div>
        <div className="bk-notice">
          <i className="ti ti-info-circle" style={{ marginRight: 6 }}></i>
          定休日：月曜日（祝日の場合は翌火曜日）　営業時間：9:00〜20:00
        </div>
        {/* Calendar */}
        <div className="bk-calendar">
          <div className="bk-cal-head">
            <button
              className="bk-cal-nav"
              onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
              }}
            >
              <i className="ti ti-chevron-left"></i>
            </button>
            <div className="bk-cal-month">{calYear}年 {calMonth + 1}月</div>
            <button
              className="bk-cal-nav"
              onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
              }}
            >
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
              const isMon  = dow === 1;
              const isSun  = dow === 0;
              const isSat  = dow === 6;
              const disabled = past || isMon;
              const cls = [
                'bk-cal-day',
                iso === date    ? 'selected' : '',
                iso === todayISO && iso !== date ? 'today' : '',
                disabled        ? 'disabled past' : '',
                !disabled && isSun ? 'sun' : '',
                !disabled && isSat ? 'sat' : '',
              ].filter(Boolean).join(' ');
              return (
                <div
                  key={idx}
                  className={cls}
                  onClick={() => !disabled && setDate(iso)}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        {date && (
          <>
            <div className="bk-times-title">
              {formatDateJP(date)} の空き時間
            </div>
            <div className="bk-times">
              {timeSlots.map((t) => {
                const taken = takenSlots.includes(t);
                const sel   = time === t;
                return (
                  <div
                    key={t}
                    className={`bk-time-slot${sel ? ' selected' : taken ? ' taken' : ''}`}
                    onClick={() => !taken && setTime(t)}
                  >
                    {t}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-l)', marginTop: 4 }}>
              ※ 取り消し線の時間帯は予約済みです
            </div>
          </>
        )}
      </>
    );

    /* Step 4 — お客様情報 */
    if (step === 4) return (
      <>
        <div className="bk-section-title">お客様情報をご入力ください</div>
        <div className="bk-section-sub">確認のご連絡のため、お名前と電話番号は必須です</div>
        <div className="bk-form">
          <div className="bk-field-group">
            <div className="bk-field">
              <label className="bk-label">お名前<span className="bk-required">＊</span></label>
              <input
                className="bk-input"
                type="text"
                placeholder="山田 花子"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="bk-field">
              <label className="bk-label">電話番号<span className="bk-required">＊</span></label>
              <input
                className="bk-input"
                type="tel"
                placeholder="090-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="bk-field">
            <label className="bk-label">メールアドレス（任意）</label>
            <input
              className="bk-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="bk-field">
            <label className="bk-label">ご要望・ご連絡事項（任意）</label>
            <textarea
              className="bk-textarea"
              placeholder="アレルギーやご要望があればお知らせください"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </>
    );

    /* Step 5 — 確認 */
    if (step === 5) return (
      <>
        <div className="bk-section-title">ご予約内容の確認</div>
        <div className="bk-section-sub">内容をご確認の上、「予約を確定する」を押してください</div>
        <div className="bk-summary">
          <div className="bk-summary-head">
            <i className="ti ti-calendar-check" style={{ fontSize: 20, color: '#fff' }}></i>
            <div className="bk-summary-head-title">予約内容</div>
          </div>
          {[
            { icon: <span>{service?.icon}</span>, label: 'メニュー', val: service ? `${service.name}（${service.duration}分）` : '' },
            { icon: <i className="ti ti-currency-yen"></i>, label: '料金（税込）', val: <span className="bk-price-tag">{yen(service?.price ?? 0)}</span> },
            { icon: <i className="ti ti-user"></i>, label: '担当者', val: staffSel === 'any' ? '指名なし（当日割り当て）' : (staffSel as Staff)?.name ?? '' },
            { icon: <i className="ti ti-calendar"></i>, label: '日付', val: date ? formatDateJP(date) : '' },
            { icon: <i className="ti ti-clock"></i>, label: '時間', val: time ? `${time} 〜（約${service?.duration}分）` : '' },
          ].map((row, i) => (
            <div key={i} className="bk-summary-row">
              <div className="bk-summary-icon">{row.icon}</div>
              <div>
                <div className="bk-summary-label">{row.label}</div>
                <div className="bk-summary-val">{row.val}</div>
              </div>
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
            ...(note ? [{ icon: <i className="ti ti-note"></i>, label: 'ご要望', val: note }] : []),
          ].map((row, i) => (
            <div key={i} className="bk-summary-row">
              <div className="bk-summary-icon">{row.icon}</div>
              <div>
                <div className="bk-summary-label">{row.label}</div>
                <div className="bk-summary-val">{row.val}</div>
              </div>
            </div>
          ))}
        </div>
        {error && <div className="bk-error"><i className="ti ti-alert-circle"></i> {error}</div>}
      </>
    );
  };

  const isConfirmStep = step === 5;

  return (
    <div className="bk-root">
      <header className="bk-header">
        <div className="bk-logo">
          <span className="bk-logo-gem"></span>
          agio hair&amp;spa
          <span className="bk-logo-gem"></span>
        </div>
        <div className="bk-logo-sub">ご予約フォーム</div>
      </header>

      <div className="bk-body">
        <Steps current={step} />

        <div style={{ animation: 'fadeUp 0.3s var(--ease) both' }}>
          {renderStep()}
        </div>

        <div className="bk-nav">
          {step > 1 && (
            <button className="bk-back" onClick={goBack}>
              <i className="ti ti-arrow-left"></i>戻る
            </button>
          )}
          {isConfirmStep ? (
            <button
              className="bk-next"
              disabled={submitting}
              onClick={submitBooking}
            >
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
