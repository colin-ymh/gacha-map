interface IconProps {
  size?: number;
  className?: string;
}

const CameraIcon = ({ size = 24, className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 15.2C10.23 15.2 8.8 13.77 8.8 12S10.23 8.8 12 8.8 15.2 10.23 15.2 12 13.77 15.2 12 15.2zM20 4h-3.17L15 2H9L7.17 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
  </svg>
);

export default CameraIcon;
