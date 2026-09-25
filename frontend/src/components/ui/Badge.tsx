type BadgeProps = {
  children: React.ReactNode
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}

export function Badge({ children, tone = 'primary' }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
