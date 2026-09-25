type InputProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}

export function Input({ label, value, onChange, placeholder, type = 'text' }: InputProps) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
