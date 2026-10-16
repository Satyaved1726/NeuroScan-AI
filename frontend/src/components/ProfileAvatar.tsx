import MaterialIcon from './MaterialIcon';

const UserCircle2 = ({ className }: { className?: string }) => <MaterialIcon name="account_circle" className={className} />;

interface ProfileAvatarProps {
  src?: string | null;
  name?: string | null;
  sizeClassName?: string;
  className?: string;
}

function getInitials(name?: string | null) {
  const initials = (name || 'Patient')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || null;
}

export default function ProfileAvatar({
  src,
  name,
  sizeClassName = 'h-10 w-10',
  className = '',
}: ProfileAvatarProps) {
  return (
    <div
      className={`${sizeClassName} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-medical-blue text-sm font-extrabold text-white ${className}`}
      aria-label={name ? `${name} profile photo` : 'Profile photo'}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name) || <UserCircle2 className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
