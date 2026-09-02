'use client';

import { useState } from 'react';

import { TrajectoryExplorer, UploadTrajectory } from '@/components/trajectory-explorer';
import { TrajectoryData } from '@/lib/trajectory';

type LoadedFile = {
  data: TrajectoryData;
  name: string;
  size: number;
};

export default function Home() {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);

  if (!loaded) {
    return (
      <UploadTrajectory
        onLoaded={(data, file) => setLoaded({ data, name: file.name, size: file.size })}
      />
    );
  }

  return (
    <TrajectoryExplorer
      data={loaded.data}
      fileName={loaded.name}
      fileSize={loaded.size}
      onReplace={() => setLoaded(null)}
    />
  );
}
