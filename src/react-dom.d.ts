declare module "react-dom" {
  export function createPortal(
    node: import("react").ReactNode,
    container: Element | DocumentFragment,
  ): import("react").ReactNode;
}
