interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  strokeWidth?: number;
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  stroke = 'currentColor',
  fill = 'none',
  className,
  strokeWidth = 1.5,
}: SparklineProps) {
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }

  const padX = 1.5;
  const padY = strokeWidth + 1;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${padX.toFixed(2)},${(padY + innerH).toFixed(2)} ${linePath} ${(padX + innerW).toFixed(2)},${(padY + innerH).toFixed(2)}`;
  const hasFill = fill && fill !== 'none';
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {hasFill && <polygon points={areaPath} fill={fill} opacity={0.15} />}
      <polyline
        points={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={Math.max(1.5, strokeWidth + 0.5)} fill={stroke} />
    </svg>
  );
}
