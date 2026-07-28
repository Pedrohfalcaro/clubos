import styles from './ClubCrest.module.css';

interface ClubCrestProps {
  primary: string;
  secondary: string;
  size?: number;
  className?: string;
  title?: string;
}

export default function ClubCrest({
  primary,
  secondary,
  size = 28,
  className,
  title,
}: ClubCrestProps) {
  return (
    <span
      className={`${styles.crest} ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${primary} 50%, ${secondary} 50%)`,
      }}
      title={title}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
