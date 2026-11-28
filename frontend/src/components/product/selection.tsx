"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface Selection {
  /** The chosen version's own photo (attributes.imageId), or null for the gallery's own choice. */
  imageId: string | null;
  setImageId: (id: string | null) => void;
}

const SelectionContext = createContext<Selection>({ imageId: null, setImageId: () => {} });

/**
 * Links the version picker and the gallery on a product page: choosing a
 * colour that has its own photo shows that photo.
 */
export function ProductSelection({ initialImageId, children }: { initialImageId: string | null; children: ReactNode }) {
  const [imageId, setImageId] = useState<string | null>(initialImageId);
  return <SelectionContext.Provider value={{ imageId, setImageId }}>{children}</SelectionContext.Provider>;
}

export const useProductSelection = () => useContext(SelectionContext);
