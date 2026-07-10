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
      theme="dark"
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
            "group-[.toaster]:relative group-[.toaster]:justify-center group-[.toaster]:text-center group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-[#27272A] group-[.toaster]:bg-[#09090B] group-[.toaster]:px-5 group-[.toaster]:py-3.5 group-[.toaster]:pt-9 group-[.toaster]:pr-11 group-[.toaster]:text-white group-[.toaster]:shadow-[0px_10px_16px_-3px_rgba(0,0,0,0.35),0px_4px_6px_0px_rgba(0,0,0,0.2)]",
          content: "group-[.toast]:items-center group-[.toast]:text-center",
          title: "group-[.toast]:text-white group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:!text-[#A1A1AA] group-[.toast]:text-sm",
          icon: "group-[.toast]:!mx-0 group-[.toast]:!mr-2",
          closeButton:
            "group-[.toast]:!left-auto group-[.toast]:!right-3 group-[.toast]:!top-3 group-[.toast]:!translate-y-0 group-[.toast]:!border-[#3F3F46] group-[.toast]:!bg-[#18181B] group-[.toast]:!text-[#A1A1AA] group-[.toast]:hover:!border-[#52525B] group-[.toast]:hover:!bg-[#27272A] group-[.toast]:hover:!text-white",
          actionButton:
            "group-[.toast]:!rounded-lg group-[.toast]:!bg-white group-[.toast]:!px-3 group-[.toast]:!py-1.5 group-[.toast]:!text-sm group-[.toast]:!font-medium group-[.toast]:!text-[#09090B]",
          cancelButton:
            "group-[.toast]:!rounded-lg group-[.toast]:!border group-[.toast]:!border-[#3F3F46] group-[.toast]:!bg-transparent group-[.toast]:!text-sm group-[.toast]:!text-[#A1A1AA]",
        },
      }}
      {...props}
    />
  );
}
