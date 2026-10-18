type Child = Node | string | null | undefined | false

/** Tiny element builder: `el('button', { class: 'x', onclick }, 'Label')`. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | number | EventListener | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue
    if (typeof value === 'function') element.addEventListener(name.replace(/^on/, ''), value)
    else if (value === true) element.setAttribute(name, '')
    else element.setAttribute(name, String(value))
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    element.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return element
}

export const replaceChildren = (parent: Element, ...children: Child[]): void => {
  parent.replaceChildren(...children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false))
}
