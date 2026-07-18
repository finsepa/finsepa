"use client";

import type { ComponentProps } from "react";
import { CircleCheck } from "@/lib/icons";
import { Toaster as Sonner } from "sonner";

import "sonner/dist/styles.css";

type ToasterProps = ComponentProps<typeof Sonner>;

/** Matches positive P/L green (`text-[#16A34A]`) used across portfolio and markets tables. */
const successToastIcon = (
  <CircleCheck className="size-4 shrink-0 text-[#16A34A]" strokeWidth={2} aria-hidden />
);

/** Sonner — see https://ui.shadcn.com/docs/components/radix/sonner */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className={[
        "toaster group",
        "[&_[data-sonner-toaster]]:z-[300]",
        "[&_[data-sonner-toaster]]:[--toast-close-button-start:unset]",
        "[&_[data-sonner-toaster]]:[--toast-close-button-end:12px]",
        "[&_[data-sonner-toaster]]:[--toast-close-button-transform:none]",
      ].join(" ")}
      icons={{ success: successToastIcon }}
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:relative group-[.toaster]:justify-start group-[.toaster]:text-left group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-[#E4E4E7] group-[.toaster]:bg-white group-[.toaster]:px-5 group-[.toaster]:py-3.5 group-[.toaster]:pr-11 group-[.toaster]:text-[#0F0F0F] group-[.toaster]:shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]",
          content: "group-[.toast]:items-center group-[.toast]:text-left",
          title:
            "group-[.toast]:text-left group-[.toast]:text-[#0F0F0F] group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-left group-[.toast]:text-[#71717A] group-[.toast]:text-sm",
          icon: "group-[.toast]:!mx-0 group-[.toast]:!mr-2",
          closeButton:
            "group-[.toast]:!left-auto group-[.toast]:!right-3 group-[.toast]:!top-3 group-[.toast]:!translate-y-0 group-[.toast]:!border-[#E4E4E7] group-[.toast]:!bg-white group-[.toast]:!text-[#71717A] group-[.toast]:hover:!border-[#D4D4D8] group-[.toast]:hover:!bg-[#F4F4F5] group-[.toast]:hover:!text-[#0F0F0F]",
          actionButton:
            "group-[.toast]:!rounded-lg group-[.toast]:!bg-[#0F0F0F] group-[.toast]:!px-3 group-[.toast]:!py-1.5 group-[.toast]:!text-sm group-[.toast]:!font-medium group-[.toast]:!text-white",
          cancelButton: "group-[.toast]:!rounded-lg group-[.toast]:!text-sm group-[.toast]:!text-[#71717A]",
        },
      }}
      {...props}
    />
  );
}
