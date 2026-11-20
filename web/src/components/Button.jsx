import styles from './Button.module.css'

const VARIANTS = { primary: styles.primary, secondary: styles.secondary, quiet: styles.quiet }

/**
 * The site's button. `as` renders it as another element (a link: as={Link} to="/add").
 * variant: primary (filled terracotta) | secondary (terracotta outline) | quiet (ink outline)
 * size: default (56px, big actions) | small (44px pill, header actions)
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'default',
  block = false,
  className = '',
  ...props
}) {
  const classes = [
    styles.button,
    VARIANTS[variant] ?? styles.primary,
    size === 'small' ? styles.small : '',
    block ? styles.block : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const typeProp = Component === 'button' ? { type: props.type ?? 'button' } : {}
  return <Component className={classes} {...typeProp} {...props} />
}
