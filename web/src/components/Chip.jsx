import styles from './Chip.module.css'

/**
 * A pill: a toggle (pass `selected` to make it a pressed/unpressed button), a tag link
 * (as={Link}) or a plain label. `dashed` is the "not sure / general" style.
 */
export function Chip({
  as: Component = 'button',
  selected,
  dashed = false,
  className = '',
  ...props
}) {
  const classes = [styles.chip, dashed ? styles.dashed : '', className].filter(Boolean).join(' ')
  const buttonProps =
    Component === 'button'
      ? { type: 'button', ...(selected === undefined ? {} : { 'aria-pressed': selected }) }
      : {}
  return <Component className={classes} {...buttonProps} {...props} />
}
