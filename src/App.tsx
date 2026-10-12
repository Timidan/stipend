import { useEffect } from 'react';
import { useApp } from '@/hooks';
import { usePath } from '@/router';
import { Header, TabBar } from '@/components/shell';
import { Sheets } from '@/components/sheets';
import { Backdrop } from '@/components/backdrop';
import { Welcome } from '@/screens/welcome';
import { Home } from '@/screens/home';
import { Trade } from '@/screens/trade';
import { Weeks } from '@/screens/weeks';
import { Activity } from '@/screens/activity';

const SCREENS: Record<string, () => React.ReactNode> = { '/': Home, '/trade': Trade, '/weeks': Weeks, '/activity': Activity };

export function App() {
  const s = useApp();
  const path = usePath();
  const Screen = SCREENS[path] ?? Home;
  const signedOut = s.phase === 'signed-out' || (s.phase === 'signing-in' && !s.vault);
  useEffect(() => { if (signedOut) document.title = 'Stipend'; }, [signedOut]);
  // Unknown paths (a trailing slash, a typo) land on Home under the right URL.
  useEffect(() => { if (!SCREENS[path]) { history.replaceState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate')); } }, [path]);
  return (
    <>
      <Backdrop />
      <div inert={!!s.error && !s.busy}>
        {signedOut ? <Welcome /> : (
          <div className="min-h-svh overflow-x-clip">
            <Header />
            <Screen key={path} />
            <TabBar />
          </div>
        )}
      </div>
      <Sheets />
    </>
  );
}
