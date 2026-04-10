"use client";

import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

import type { CryptoAssetLinks } from "@/lib/market/crypto-asset";

function iconForLabel(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("website")) return Globe;
  if (l.includes("whitepaper")) return FileText;
  if (l.includes("github")) return FileCode;
  if (l.includes("explorer")) return Search;
  if (l.includes("wallet")) return Wallet;
  if (l.includes("twitter")) return Share2;
  if (l.includes("reddit")) return MessagesSquare;
  if (l.includes("telegram")) return Send;
  if (l.includes("discord")) return MessageCircle;
  return Globe;
}

function LinkPill({ href, label }: { href: string; label: string }) {
  const Icon = iconForLabel(label);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#F4F4F5] px-3 py-2 text-[13px] font-medium text-[#09090B] transition-colors hover:bg-[#ECECEE]"
    >
      {createElement(Icon, {
        className: "h-3.5 w-3.5 shrink-0 text-[#52525B]",
        "aria-hidden": true,
      })}
      <span className="min-w-0 truncate">{label}</span>
    </a>
  );
}

function Column({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-[15px] font-semibold leading-6 text-[#09090B]">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <LinkPill key={item.href + item.label} href={item.href} label={item.label} />
        ))}
      </div>
    </div>
  );
}

function buildLinkColumns(links: CryptoAssetLinks) {
  const official: { label: string; href: string }[] = [];
  if (links.website) official.push({ label: "Website", href: links.website });
  if (links.whitepaper) official.push({ label: "Whitepaper", href: links.whitepaper });
  if (links.github) official.push({ label: "GitHub", href: links.github });

  const network: { label: string; href: string }[] = [];
  links.explorers.forEach((url, i) => {
    network.push({
      label: links.explorers.length > 1 ? `Chain Explorers ${i + 1}` : "Chain Explorers",
      href: url,
    });
  });
  links.wallets.forEach((url, i) => {
    network.push({
      label: links.wallets.length > 1 ? `Supported Wallets ${i + 1}` : "Supported Wallets",
      href: url,
    });
  });

  const social: { label: string; href: string }[] = [];
  if (links.twitter) social.push({ label: "Twitter", href: links.twitter });
  if (links.reddit) social.push({ label: "Reddit", href: links.reddit });
  if (links.telegram) social.push({ label: "Telegram", href: links.telegram });
  if (links.discord) social.push({ label: "Chat", href: links.discord });

  return { official, network, social };
}

export function CryptoLinksSection({ links }: { links: CryptoAssetLinks }) {
  const { official, network, social } = buildLinkColumns(links);
  if (official.length === 0 && network.length === 0 && social.length === 0) return null;

  return (
    <div className="border-t border-[#E4E4E7] pt-8">
      <h2 className="mb-6 text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Links</h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
        <Column title="Official Links" items={official} />
        <Column title="Network information" items={network} />
        <Column title="Socials" items={social} />
      </div>
    </div>
  );
}
