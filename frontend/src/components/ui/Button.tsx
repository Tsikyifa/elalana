type ButtonProps = {
  children: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
}

export function Button({ children, type = 'button', variant = 'primary', className = '' }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`.trim()}>
      {children}
    </button>
  )
}
