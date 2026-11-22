"use client";

import { createElement, useState } from "react";
import type { AppIcon } from "@/lib/icons";
import {
  FileCode,
  FileText,
  Globe,
  MessageCircle,
  MessagesSquare,
  Search,
  Send,
  Share2,
  Wallet,
} from "@/lib/icons";

import {
  MOBILE_ELEVATED_CARD_CLASS,
  OVERVIEW_SECTION_TITLE_GAP_CLASS,
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
} from "@/components/design-system/card-surface-styles";
import type { CryptoAssetLinks } from "@/lib/market/crypto-asset";
import { cn } from "@/lib/utils";

function iconForLabel(label: string): AppIcon {
  const l = label.toLowerCase();
  if (l.includes("website")) return Globe;
  if (l.includes("whitepaper")) return FileText;
  if (l.includes("github")) return FileCode;
  if (l.includes("explorer")) return Search;
  if (l.includes("wallet")) return Wallet;
  if (l.includes("twitter") || l === "x") return Share2;
  if (l.includes("facebook")) return Share2;
  if (l.includes("reddit")) return MessagesSquare;
  if (l.includes("telegram")) return Send;
  if (l.includes("discord") || l.includes("chat")) return MessageCircle;
  return Globe;
}

function LinkRow({ href, label }: { href: string; label: string }) {
  const Icon = iconForLabel(label);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-2 text-[14px] font-medium text-fg transition-colors hover:text-fg-muted"
    >
      {createElement(Icon, {
        className: "h-4 w-4 shrink-0 text-fg",
        "aria-hidden": true,
      })}
      <span className="min-w-0 truncate">{label}</span>
    </a>
  );
}

function buildLinkItems(links: CryptoAssetLinks) {
  const items: { label: string; href: string }[] = [];
  if (links.website) items.push({ label: "Website", href: links.website });
  if (links.whitepaper) items.push({ label: "Whitepaper", href: links.whitepaper });
  if (links.facebook) items.push({ label: "Facebook", href: links.facebook });
  if (links.twitter) items.push({ label: "X", href: links.twitter });
  if (links.reddit) items.push({ label: "Reddit", href: links.reddit });
  if (links.github) items.push({ label: "Github", href: links.github });
  if (links.telegram) items.push({ label: "Telegram", href: links.telegram });
  if (links.discord) items.push({ label: "Chat", href: links.discord });
  links.explorers.forEach((url, i) => {
    items.push({
      label: links.explorers.length > 1 ? `Explorer ${i + 1}` : "Explorer",
      href: url,
    });
  });
  links.wallets.forEach((url, i) => {
    items.push({
      label: links.wallets.length > 1 ? `Wallet ${i + 1}` : "Wallet",
      href: url,
    });
  });
  return items;
}

function AboutDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsMore = text.length > 220 || text.split(/\n/).length > 3;
  return (
    <div className="space-y-2">
      <p
        className={cn(
          "text-[14px] leading-5 text-fg",
          !expanded && needsMore ? "line-clamp-3" : null,
        )}
      >
        {text}
      </p>
      {needsMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[14px] font-semibold text-fg underline underline-offset-2"
        >
          {expanded ? "Show less" : "Read More"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Crypto Overview About — description + official/social links.
 * Hides empty link rows; hides the whole block when both are empty.
 */
export function CryptoLinksSection({
  links,
  description,
}: {
  links: CryptoAssetLinks;
  description?: string | null;
}) {
  const items = buildLinkItems(links);
  const blurb = description?.trim() ?? "";
  if (!blurb && items.length === 0) return null;

  return (
    <div className="pt-2">
      <h2 className={cn(OVERVIEW_SECTION_TITLE_GAP_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Asset & Team Info</h2>
      <div className={cn("space-y-5 p-4 sm:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
        {blurb ? <AboutDescription text={blurb} /> : null}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {items.map((item) => (
              <LinkRow key={item.href + item.label} href={item.href} label={item.label} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
