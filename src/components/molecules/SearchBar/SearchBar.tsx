import Input from '@/components/atoms/Input/Input'
import Button from '@/components/atoms/Button/Button'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  defaultValue?: string
  placeholder?: string
}

export default function SearchBar({
  defaultValue,
  placeholder = '지역 또는 샵 이름 검색',
}: SearchBarProps) {
  return (
    <form className={styles.form}>
      <Input name="q" defaultValue={defaultValue} placeholder={placeholder} />
      <Button type="submit">검색</Button>
    </form>
  )
}
