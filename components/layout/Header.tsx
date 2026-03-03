"use client";

import { Bell, Search, Settings } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-surface-300 bg-white sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-gray-900 leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="relative ml-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-400 bg-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent w-48"
          />
        </div>
        <button className="p-2 rounded-lg hover:bg-surface-200 text-gray-500 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
        <button className="p-2 rounded-lg hover:bg-surface-200 text-gray-500">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
