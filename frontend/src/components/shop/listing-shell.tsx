"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";

const NavigateContext = createContext<(href: string) => void>(() => {});

/** Filter changes navigate inside a transition; the grid dims until the new results arrive. */
export function ListingShell({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const navigate = (href: string) => start(() => router.replace(href, { scroll: false }));
  return (
    <NavigateContext.Provider value={navigate}>
      {toolbar}
      <div aria-busy={pending} className={`transition-opacity duration-300 ${pending ? "opacity-40" : "opacity-100"}`}>
        {children}
      </div>
    </NavigateContext.Provider>
  );
}

export const useListingNavigate = () => useContext(NavigateContext);
