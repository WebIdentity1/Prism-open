export type EditableElementType = "text" | "image" | "link";

export interface ElementSelection {
  /** CSS-like path from body to the element, e.g. "table>tbody>tr:nth-of-type(2)>td>h1" */
  elementPath: string;
  elementType: EditableElementType;
  /** Text content for text/link elements, src URL for images */
  currentValue: string;
  /** href for link/button elements */
  currentHref?: string;
  /** Relevant inline/computed styles */
  styles: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
  };
}
