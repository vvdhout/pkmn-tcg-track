'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type AssetKind = 'card-small' | 'card-large' | 'set-symbol';

function fallbackChain(kind: AssetKind, src: string): string[] {
  const chain: string[] = [];
  if (kind === 'set-symbol') {
    if (!/\.(webp|png|jpg|jpeg)$/i.test(src)) {
      chain.push(`${src}.webp`, `${src}.png`);
    } else if (src.endsWith('.webp')) {
      chain.push(src.replace(/\.webp$/i, '.png'));
    }
  } else {
    if (src.endsWith('/low.webp')) chain.push(src.replace('/low.webp', '/png'));
    else if (src.endsWith('/high.webp')) chain.push(src.replace('/high.webp', '/png'));
  }
  return chain;
}

type TcgAssetImageProps = Omit<ImageProps, 'src'> & {
  src?: string;
  kind: AssetKind;
};

export function TcgAssetImage({ src, kind, className, alt = '', ...props }: TcgAssetImageProps) {
  const chain = useMemo(() => (src ? [src, ...fallbackChain(kind, src)] : []), [src, kind]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  if (!src || chain.length === 0) {
    return (
      <div
        className={`bg-app-surface ${className ?? ''}`}
        style={{ width: props.width, height: props.height }}
        aria-hidden
      />
    );
  }

  const url = chain[Math.min(index, chain.length - 1)];

  return (
    <Image
      {...props}
      src={url}
      alt={alt}
      className={className}
      unoptimized
      onError={() => {
        setIndex((i) => (i + 1 < chain.length ? i + 1 : i));
      }}
    />
  );
}
