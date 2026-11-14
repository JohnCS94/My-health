'use client';

import { useEffect, useState } from 'react';

import Dashboard from './Dashboard';

export default function Page() {
  const [demo, setDemo] = useState<boolean | null>(null);

  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).has('demo'));
  }, []);

  if (demo === null) return null;
  return <Dashboard demo={demo} />;
}
