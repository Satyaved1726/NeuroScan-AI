interface MaterialIconProps {
  name: string;
  className?: string;
  fill?: boolean;
}

export default function MaterialIcon({ name, className = '', fill = false }: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-rounded select-none ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {name}
    </span>
  );
}
