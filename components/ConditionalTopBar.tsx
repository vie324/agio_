'use client';

import { usePathname } from 'next/navigation';
import TopBar from './TopBar';

export default function ConditionalTopBar() {
  const pathname = usePathname();
  if (pathname.startsWith('/book')) return null;
  return <TopBar />;
}
