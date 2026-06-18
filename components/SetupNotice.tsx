export default function SetupNotice() {
  return (
    <div className="inner-page">
      <div className="setup-note">
        <h2>Supabase の設定が必要です</h2>
        <p>
          環境変数 <code>NEXT_PUBLIC_SUPABASE_URL</code> と{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> が未設定のため、データを読み込めません。
        </p>
        <p>
          1. Supabase でプロジェクトを作成し、SQL Editor で{' '}
          <code>supabase/schema.sql</code> → <code>supabase/seed.sql</code> を順に実行します。
        </p>
        <p>
          2. Project Settings → API から URL と anon キーを取得し、ローカルでは{' '}
          <code>.env.local</code>、Vercel では環境変数に設定します。
        </p>
        <p>
          詳しい手順は <code>README.md</code> を参照してください。
        </p>
      </div>
    </div>
  );
}
