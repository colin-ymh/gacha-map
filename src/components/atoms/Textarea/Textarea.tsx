import styles from './Textarea.module.css'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export default function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
