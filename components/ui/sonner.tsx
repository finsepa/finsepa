"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

import "sonner/dist/styles.css";

type ToasterProps = ComponentProps<typeof Sonner>;

/** Sonner — see https://ui.shadcn.com/docs/components/radix/sonner */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-[#E4E4E7] group-[.toaster]:bg-white group-[.toaster]:text-[#09090B] group-[.toaster]:shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]",
          title: "group-[.toast]:text-[#09090B] group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-[#71717A] group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:!rounded-lg group-[.toast]:!bg-[#09090B] group-[.toast]:!px-3 group-[.toast]:!py-1.5 group-[.toast]:!text-sm group-[.toast]:!font-medium group-[.toast]:!text-white",
          cancelButton: "group-[.toast]:!rounded-lg group-[.toast]:!text-sm",
        },
      }}
      {...props}
    />
  );
}
